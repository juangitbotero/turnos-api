import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ShiftsModule } from './shifts/shifts.module';
import { AdminModule } from './admin/admin.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';
import { GatewayModule } from './gateway/gateway.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ComplianceModule } from './compliance/compliance.module';
import { AttendanceModule } from './attendance/attendance.module';
import { PaymentsModule } from './payments/payments.module';
import { RatingsModule } from './ratings/ratings.module';
import { Rating } from './ratings/entities/rating.entity';
import { NoShowFlag } from './ratings/entities/no-show-flag.entity';
import { FavouriteWorker } from './ratings/entities/favourite-worker.entity';
import { User } from './users/entities/user.entity';
import { Worker } from './users/entities/worker.entity';
import { Employer } from './users/entities/employer.entity';
import { Shift } from './shifts/entities/shift.entity';
import { ShiftApplication } from './shifts/entities/shift-application.entity';
import { McdContract } from './compliance/entities/mcd-contract.entity';
import { ComplianceAuditLog } from './compliance/entities/compliance-audit-log.entity';
import { ShiftAttendance } from './attendance/entities/shift-attendance.entity';
import { PaymentRecord } from './payments/entities/payment-record.entity';
import { LanguageMiddleware } from './i18n/language.middleware';
import { DemoModule } from './demo/demo.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 60 },
    ]),

    // BullMQ — supports REDIS_URL (Railway) or individual vars (local dev)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          return { connection: { url: redisUrl, tls: redisUrl.startsWith('rediss://') ? {} : undefined } };
        }
        return {
          connection: {
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
            password: config.get<string>('REDIS_PASSWORD', '') || undefined,
          },
        };
      },
    }),

    // PostgreSQL — supports DATABASE_URL (Railway) or individual vars (local dev)
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const isProduction = configService.get('NODE_ENV') === 'production';
        const baseConfig = {
          type: 'postgres' as const,
          entities: [User, Worker, Employer, Shift, ShiftApplication, McdContract, ComplianceAuditLog, ShiftAttendance, PaymentRecord, Rating, NoShowFlag, FavouriteWorker],
          synchronize: true, // Safe for beta — switch to migrations before real launch
        };
        if (databaseUrl) {
          return { ...baseConfig, url: databaseUrl, ssl: isProduction ? { rejectUnauthorized: false } : false };
        }
        return {
          ...baseConfig,
          host:     configService.get<string>('DB_HOST', 'localhost'),
          port:     configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USER', 'turnos'),
          password: configService.get<string>('DB_PASSWORD', 'turnos_dev_password'),
          database: configService.get<string>('DB_NAME', 'turnos_db'),
        };
      },
    }),

    // Serve local uploads in dev
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),

    RedisModule,
    MailModule,
    StorageModule,
    HealthModule,
    UsersModule,
    AuthModule,
    GatewayModule,
    NotificationsModule,
    ComplianceModule,
    AttendanceModule,
    PaymentsModule,
    RatingsModule,
    ShiftsModule,
    AdminModule,
    // Demo data for marketing recordings. Inert unless DEMO_SEED_TOKEN is set.
    DemoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  // Resolves the request's language from Accept-Language and makes it readable
  // from any service via `t()` — see i18n/request-language.ts.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LanguageMiddleware).forRoutes('*');
  }
}
