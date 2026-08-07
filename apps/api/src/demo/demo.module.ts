import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DemoController } from './demo.controller';
import { DemoSeedService } from './demo-seed.service';
import { User } from '../users/entities/user.entity';
import { Worker } from '../users/entities/worker.entity';
import { Employer } from '../users/entities/employer.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { ShiftApplication } from '../shifts/entities/shift-application.entity';
import { ShiftAttendance } from '../attendance/entities/shift-attendance.entity';
import { PaymentRecord } from '../payments/entities/payment-record.entity';
import { WagePayment } from '../payments/entities/wage-payment.entity';
import { Rating } from '../ratings/entities/rating.entity';

/**
 * Demo seeding — a self-contained module so it can be deleted in one commit
 * once the marketing material is recorded.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, Worker, Employer, Shift, ShiftApplication,
      ShiftAttendance, PaymentRecord, WagePayment, Rating,
    ]),
  ],
  controllers: [DemoController],
  providers: [DemoSeedService],
})
export class DemoModule {}
