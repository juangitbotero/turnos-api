import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';
import { RatingReminderProcessor } from './rating-reminder.processor';
import { Rating } from './entities/rating.entity';
import { NoShowFlag } from './entities/no-show-flag.entity';
import { FavouriteWorker } from './entities/favourite-worker.entity';
import { Worker } from '../users/entities/worker.entity';
import { Employer } from '../users/entities/employer.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { User } from '../users/entities/user.entity';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rating, NoShowFlag, FavouriteWorker, Worker, Employer, Shift, User]),
    BullModule.registerQueue({ name: 'rating-reminder' }),
    MailModule,
  ],
  controllers: [RatingsController],
  providers:   [RatingsService, RatingReminderProcessor],
  exports:     [RatingsService],
})
export class RatingsModule {}
