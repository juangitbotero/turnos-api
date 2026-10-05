import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { corsOriginCheck, allowedOrigins } from './cors';
import * as path from 'path';

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
  // Exactly one hop, not `true`: with `true` Express takes the LEFTMOST
  // X-Forwarded-For entry, which the client writes — anyone could send a random
  // value per request and get a new bucket each time. With 1 it takes the entry
  // appended by the edge itself. Override with TRUST_PROXY_HOPS if Railway's
  // topology ever changes (0 locally if you want req.ip to be the socket).
  app.set('trust proxy', Number(process.env['TRUST_PROXY_HOPS'] ?? 1));

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

  // Serve uploaded files (dev only — production uses Cloudflare R2)
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);

  logger.log(`🚀 Turnos API running at http://localhost:${port}/api`);
  logger.log(`🏥 Health check: http://localhost:${port}/api/health`);
  logger.log(`📦 Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
}

bootstrap();
