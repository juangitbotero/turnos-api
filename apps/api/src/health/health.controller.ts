import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  check() {
    return {
      status: 'ok',
      service: 'turnos-api',
      version: '0.0.1',
      environment: this.config.get<string>('NODE_ENV', 'development'),
      /**
       * Which commit is actually serving. Railway injects
       * RAILWAY_GIT_COMMIT_SHA at build time.
       *
       * Added after a long afternoon of inferring the running build from its
       * behaviour: a failed build left the previous image serving, a redeploy
       * brought that same old image back, and from outside the two were
       * indistinguishable except by which bug reproduced. Never again.
       */
      commit: (this.config.get<string>('RAILWAY_GIT_COMMIT_SHA') ?? 'unknown').slice(0, 7),
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }
}
