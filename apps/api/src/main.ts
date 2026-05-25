import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Socket.IO adapter (must be set before listen)
  app.useWebSocketAdapter(new IoAdapter(app));

  // CORS — will be tightened per environment in later stints
  app.enableCors({
    origin: process.env['NODE_ENV'] === 'production' ? false : '*',
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    credentials: true,
  });

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

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);

  logger.log(`🚀 Turnos API running at http://localhost:${port}/api`);
  logger.log(`🏥 Health check: http://localhost:${port}/api/health`);
  logger.log(`📦 Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
}

bootstrap();
