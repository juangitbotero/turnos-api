import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class StorageService {
  private s3: S3Client | null = null;
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;
  private readonly useLocal: boolean;
  private readonly uploadsDir: string;

  constructor(private readonly config: ConfigService) {
    const accountId    = config.get<string>('R2_ACCOUNT_ID', '');
    const accessKeyId  = config.get<string>('R2_ACCESS_KEY_ID', '');
    const secretKey    = config.get<string>('R2_SECRET_ACCESS_KEY', '');
    this.bucket        = config.get<string>('R2_BUCKET_NAME', 'turnos-files');
    this.uploadsDir    = path.join(process.cwd(), 'uploads');

    const hasR2 =
      accountId && accountId !== 'replace_me' &&
      accessKeyId && accessKeyId !== 'replace_me';

    if (hasR2) {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey: secretKey },
        // SDK ≥3.729 adds integrity checksums by default; Cloudflare's guidance
        // for R2 is to send them only when an operation requires them.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
      this.useLocal = false;
      this.logger.log('Storage: Cloudflare R2 initialized');
    } else {
      this.useLocal = true;
      if (!fs.existsSync(this.uploadsDir)) {
        fs.mkdirSync(this.uploadsDir, { recursive: true });
      }
      this.logger.warn('R2 credentials absent — using local disk storage');
    }
  }

  /**
   * File extension for a MIME type. Document types are mapped explicitly —
   * splitting on '/' would turn a .docx into the whole
   * "vnd.openxmlformats-officedocument..." subtype.
   */
  private static extFor(mimeType: string): string {
    const map: Record<string, string> = {
      'application/pdf':  'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    };
    return map[mimeType] ?? mimeType.split('/')[1] ?? 'bin';
  }

  /** Store a profile photo. Thin wrapper kept for call-site readability. */
  async uploadPhoto(buffer: Buffer, mimeType: string, folder = 'photos'): Promise<string> {
    return this.upload(buffer, mimeType, folder);
  }

  /**
   * Store any file (photos, payment proofs — images or PDF) and return its
   * public URL. R2 in production, local disk in dev.
   */
  async upload(buffer: Buffer, mimeType: string, folder = 'files'): Promise<string> {
    const filename = `${folder}/${crypto.randomUUID()}.${StorageService.extFor(mimeType)}`;

    if (this.useLocal) {
      const localPath = path.join(this.uploadsDir, filename);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, buffer);
      return `${this.apiUrl()}/uploads/${filename}`;
    }

    await this.s3!.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: filename,
      Body: buffer,
      ContentType: mimeType,
    }));

    // Same address as local disk: the bucket is private and the API streams
    // the object (main.ts → `/uploads`). So stored URLs never change between
    // storage backends, and CVs, proofs and licence documents are never in a
    // public bucket.
    return `${this.apiUrl()}/uploads/${filename}`;
  }

  private apiUrl(): string {
    return this.config.get<string>('API_URL', 'http://localhost:3001').replace(/\/+$/, '');
  }

  get isR2(): boolean {
    return !this.useLocal;
  }

  /** Keys are always `<folder>/<uuid>.<ext>` — anything else is refused before reaching R2. */
  static isValidKey(key: string): boolean {
    return /^[a-z-]+\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/.test(key);
  }

  /** Read one object from R2 for the `/uploads` route; null when it doesn't exist. */
  async read(key: string): Promise<{ body: NodeJS.ReadableStream; contentType: string; length?: number } | null> {
    if (this.useLocal || !StorageService.isValidKey(key)) return null;
    try {
      const out = await this.s3!.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        body: out.Body as NodeJS.ReadableStream,
        contentType: out.ContentType ?? 'application/octet-stream',
        length: out.ContentLength,
      };
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name !== 'NoSuchKey' && name !== 'NotFound') {
        this.logger.error(`R2 read failed for ${key}: ${(err as Error).message}`);
      }
      return null;
    }
  }

  /**
   * Delete a stored file by the public URL `upload()` returned.
   *
   * Needed for account deletion: clearing `photoUrl` on the row is not
   * erasure while the object is still fetchable at a guessable URL.
   *
   * Never throws — a failed delete must not abort the account deletion the
   * user asked for. Returns whether the object is gone, so the caller can log
   * what was left behind.
   */
  async deleteByUrl(url: string | null | undefined): Promise<boolean> {
    if (!url) return true;

    // Both branches of `upload()` end in `<base>/<folder>/<uuid>.<ext>`, so the
    // last two segments are the storage key wherever the file actually lives.
    const parts = url.split('/').filter(Boolean);
    const key = parts.slice(-2).join('/');
    if (!key.includes('/')) {
      this.logger.warn(`Cannot derive a storage key from URL: ${url}`);
      return false;
    }

    try {
      if (this.useLocal) {
        const localPath = path.join(this.uploadsDir, key);
        // Guard against a crafted URL walking out of the uploads directory.
        if (!localPath.startsWith(this.uploadsDir)) {
          this.logger.warn(`Refusing to delete outside uploads dir: ${key}`);
          return false;
        }
        await fs.promises.rm(localPath, { force: true });
        return true;
      }

      await this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err) {
      this.logger.error(`Failed to delete ${key}: ${(err as Error).message}`);
      return false;
    }
  }
}
