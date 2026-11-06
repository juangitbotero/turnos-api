import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { corsOriginCheck, allowedOrigins } from './cors';
import * as path from 'path';
import type { Request, Response } from 'express';
import { StorageService } from './storage/storage.service';

/** Types a browser may render in place; anything else downloads. */
const INLINE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']);

/**
 * GET /uploads/<folder>/<uuid>.<ext> from the private R2 bucket. Access is by
 * unguessable key, exactly as with the local static files before.
 */
async function serveFromR2(storage: StorageService, req: Request, res: Response): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.status(405).end(); return; }
  const key = decodeURIComponent(req.path.replace(/^\/+/, ''));
  const file = StorageService.isValidKey(key) ? await storage.read(key) : null;
  if (!file) { res.status(404).end(); return; }

  res.setHeader('Content-Type', file.contentType);
  if (file.length !== undefined) res.setHeader('Content-Length', String(file.length));
  // The content type was claimed by the uploader: never let a browser sniff
  // or render anything but images and PDFs (no SVG/HTML on the API origin).
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', INLINE_TYPES.has(file.contentType) ? 'inline' : 'attachment');
  // Keys are never reused, so a cached copy is never stale. Private: CVs and
  // payment proofs must not sit in shared caches.
  res.setHeader('Cache-Control', 'private, max-age=86400');
  if (req.method === 'HEAD') { res.end(); return; }
  (file.body as NodeJS.ReadableStream).pipe(res);
}

async function bootstrap() {
  // rawBody: true is required for Stripe webhook signature verification
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');

  // Railway's edge proxy sits in front of the app. Without this, req.ip is the
  // address of whichever internal proxy forwarded the request — it changed on
  // almost every request, so ThrottlerGuard (keyed on req.ip) gave each request
  // a fresh bucket and never returned a 429. Measured 2026-10-05:
  // X-RateLimit-Remaining stuck at 59/58 across 15 sequential requests.
  //
  // Two hops, read off production: client → Railway edge (152.233.x.x, appends
  // itself to X-Forwarded-For) → internal proxy (100.64.x.x, the socket) → app.
  // The edge discards any X-Forwarded-For the client sends, so the first entry
  // is the real client and cannot be spoofed. Not `true`: that would trust
  // whatever leftmost value arrives if the topology ever changes. Override with
  // TRUST_PROXY_HOPS if it does.
  app.set('trust proxy', Number(process.env['TRUST_PROXY_HOPS'] ?? 2));

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Socket.IO adapter (must be set before listen)
  app.useWebSocketAdapter(new IoAdapter(app));

  // CORS — allowlisted browser origins, plus every request that carries no
  // Origin header at all (the mobile app, Stripe webhooks, curl). See cors.ts
  // for why that exception is correct rather than a loophole.
  app.enableCors({
    origin: corsOriginCheck,
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    // Auth is a Bearer token, not a cookie, so credentialed requests are not
    // needed — and leaving this false keeps the allowlist from ever being
    // relaxed into `*` with credentials, which browsers reject anyway.
    credentials: false,
  });
  logger.log(`🔐 CORS origins: ${allowedOrigins().join(', ')} (+ requests with no Origin)`);

  // Global validation pipe — rejects invalid DTOs automatically
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,         // strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,         // auto-transform payloads to DTO classes
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Uploaded files live at /uploads/<folder>/<uuid>.<ext> on both backends.
  // R2 (production): the bucket is private and this route streams the object.
  // Local disk (dev, or R2 not configured): served as static files.
  const storage = app.get(StorageService);
  if (storage.isR2) {
    app.use('/uploads', (req: Request, res: Response) => serveFromR2(storage, req, res));
  } else {
    app.useStaticAssets(path.join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  }

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);

  logger.log(`🚀 Turnos API running at http://localhost:${port}/api`);
  logger.log(`🏥 Health check: http://localhost:${port}/api/health`);
  logger.log(`📦 Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
}

bootstrap();
