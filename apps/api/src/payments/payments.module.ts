import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsService } from './payments.service';
import { WagePaymentsService } from './wage-payments.service';
import { WageReminderProcessor } from './processors/wage-reminder.processor';
import { PaymentsController } from './payments.controller';
import { PaymentRecord } from './entities/payment-record.entity';
import { WagePayment } from './entities/wage-payment.entity';
import { Employer } from '../users/entities/employer.entity';
import { Worker } from '../users/entities/worker.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentRecord, WagePayment, Employer, Worker, Shift]),
    BullModule.registerQueue({ name: 'wage-reminders' }),
    NotificationsModule,
  ],
  controllers: [PaymentsController],
  providers:   [PaymentsService, WagePaymentsService, WageReminderProcessor],
  exports:     [PaymentsService, WagePaymentsService],
})
export class PaymentsModule {}
