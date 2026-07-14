import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { ShiftAutoCompleteProcessor } from './processors/shift-autocomplete.processor';
import { ShiftAttendance } from './entities/shift-attendance.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { Worker } from '../users/entities/worker.entity';
import { Employer } from '../users/entities/employer.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { PaymentsModule } from '../payments/payments.module';
import { RatingsModule } from '../ratings/ratings.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShiftAttendance, Shift, Worker, Employer]),
    BullModule.registerQueue({ name: 'shift-autocomplete' }),
    GatewayModule,
    ComplianceModule,
    PaymentsModule,
    RatingsModule,
    NotificationsModule,
  ],
  controllers: [AttendanceController],
  providers:   [AttendanceService, ShiftAutoCompleteProcessor],
  exports:     [AttendanceService],
})
export class AttendanceModule {}
