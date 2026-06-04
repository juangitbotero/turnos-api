import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentRecord } from './entities/payment-record.entity';
import { Employer } from '../users/entities/employer.entity';
import { Worker } from '../users/entities/worker.entity';
import { Shift } from '../shifts/entities/shift.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentRecord, Employer, Worker, Shift]),
  ],
  controllers: [PaymentsController],
  providers:   [PaymentsService],
  exports:     [PaymentsService],
})
export class PaymentsModule {}
