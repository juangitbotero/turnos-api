import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { ReNotificationProcessor } from './processors/re-notification.processor';
import { RedisModule } from '../redis/redis.module';
import { Worker } from '../users/entities/worker.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { ShiftApplication } from '../shifts/entities/shift-application.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Worker, Shift, ShiftApplication]),
    BullModule.registerQueue({ name: 'shift-notifications' }),
    RedisModule,
  ],
  providers: [NotificationsService, ReNotificationProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
