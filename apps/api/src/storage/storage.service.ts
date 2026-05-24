import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

  async uploadPhoto(buffer: Buffer, mimeType: string, folder = 'photos'): Promise<string> {
    const ext = mimeType.split('/')[1] ?? 'jpg';
    const filename = `${folder}/${crypto.randomUUID()}.${ext}`;

    if (this.useLocal) {
      const localPath = path.join(this.uploadsDir, filename);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, buffer);
      const apiUrl = this.config.get<string>('API_URL', 'http://localhost:3001');
      return `${apiUrl}/uploads/${filename}`;
    }

    await this.s3!.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: filename,
      Body: buffer,
      ContentType: mimeType,
    }));

    const publicUrl = this.config.get<string>(
      'R2_PUBLIC_URL',
      `https://pub-placeholder.r2.dev`,
    );
    return `${publicUrl}/${filename}`;
  }
}
