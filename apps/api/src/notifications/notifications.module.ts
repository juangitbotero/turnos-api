import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { ReNotificationProcessor } from './processors/re-notification.processor';
import { RedisModule } from '../redis/redis.module';
import { Worker } from '../users/entities/worker.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { ShiftApplication } from '../shifts/entities/shift-application.entity';
import { FavouriteWorker } from '../ratings/entities/favourite-worker.entity';
import { WorkerNotification } from './entities/worker-notification.entity';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Worker, Shift, ShiftApplication, FavouriteWorker, WorkerNotification]),
    BullModule.registerQueue({ name: 'shift-notifications' }),
    // The quarterly "declare your SS" push to every worker was removed on
    // 2026-09-27: a worker's SS obligations are theirs, not the marketplace's.
    RedisModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    ReNotificationProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
