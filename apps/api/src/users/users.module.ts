import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Worker } from './entities/worker.entity';
import { Employer } from './entities/employer.entity';
// Read-only, for the account-deletion guard: a worker with a confirmed shift
// or an unpaid wage cannot delete yet. Entity registration only — no
// dependency on ShiftsModule or PaymentsModule, so no circular import.
import { Shift } from '../shifts/entities/shift.entity';
import { WagePayment } from '../payments/entities/wage-payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Worker, Employer, Shift, WagePayment])],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
