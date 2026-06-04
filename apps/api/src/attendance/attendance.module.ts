import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { ShiftAttendance } from './entities/shift-attendance.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { Worker } from '../users/entities/worker.entity';
import { Employer } from '../users/entities/employer.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { PaymentsModule } from '../payments/payments.module';
import { RatingsModule } from '../ratings/ratings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShiftAttendance, Shift, Worker, Employer]),
    GatewayModule,
    ComplianceModule,
    PaymentsModule,
    RatingsModule,
  ],
  controllers: [AttendanceController],
  providers:   [AttendanceService],
  exports:     [AttendanceService],
})
export class AttendanceModule {}
