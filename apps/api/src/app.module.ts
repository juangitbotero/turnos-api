import { Module } from '@nestjs/common';
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
import { User } from './users/entities/user.entity';
import { Worker } from './users/entities/worker.entity';
import { Employer } from './users/entities/employer.entity';
import { Shift } from './shifts/entities/shift.entity';
import { ShiftApplication } from './shifts/entities/shift-application.entity';
import { McdContract } from './compliance/entities/mcd-contract.entity';
import { ComplianceAuditLog } from './compliance/entities/compliance-audit-log.entity';
import { ShiftAttendance } from './attendance/entities/shift-attendance.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 60 },
    ]),

    // BullMQ — Redis-backed job queues (re-notification, compliance jobs in later stints)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD', '') || undefined,
        },
      }),
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'turnos'),
        password: configService.get<string>('DB_PASSWORD', 'turnos_dev_password'),
        database: configService.get<string>('DB_NAME', 'turnos_db'),
        entities: [User, Worker, Employer, Shift, ShiftApplication, McdContract, ComplianceAuditLog, ShiftAttendance],
        synchronize: true,
      }),
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
    ShiftsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
