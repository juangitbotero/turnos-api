import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { ReNotificationProcessor } from './processors/re-notification.processor';
import { QuarterlySsReminderProcessor } from './processors/quarterly-ss-reminder.processor';
import { QuarterlySsSchedulerService } from './quarterly-ss-scheduler.service';
import { RedisModule } from '../redis/redis.module';
import { Worker } from '../users/entities/worker.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { ShiftApplication } from '../shifts/entities/shift-application.entity';
import { FavouriteWorker } from '../ratings/entities/favourite-worker.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Worker, Shift, ShiftApplication, FavouriteWorker]),
    BullModule.registerQueue({ name: 'shift-notifications' }),
    // Quarterly SS reminder — repeatable cron job, one per quarter
    BullModule.registerQueue({ name: 'quarterly-ss' }),
    RedisModule,
  ],
  providers: [
    NotificationsService,
    ReNotificationProcessor,
    QuarterlySsReminderProcessor,
    QuarterlySsSchedulerService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
