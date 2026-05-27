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

@Module({
  imports: [
    TypeOrmModule.forFeature([ShiftAttendance, Shift, Worker, Employer]),
    GatewayModule,
    ComplianceModule,
  ],
  controllers: [AttendanceController],
  providers:   [AttendanceService],
  exports:     [AttendanceService],
})
export class AttendanceModule {}
