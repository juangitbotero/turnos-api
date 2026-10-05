import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';
import { McdContract } from './entities/mcd-contract.entity';
import { ComplianceAuditLog } from './entities/compliance-audit-log.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { Worker } from '../users/entities/worker.entity';
import { Employer } from '../users/entities/employer.entity';

// The `ss-direta` queue and its processor — an email of each hire's data to
// the company's accountant — were removed on 2026-10-05; the company now
// downloads that data from the dashboard (see ComplianceService.onShiftApproved).
// Delayed jobs left in Redis under bull:ss-direta:* are never consumed.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      McdContract,
      ComplianceAuditLog,
      Shift,
      Worker,
      Employer,
    ]),
  ],
  controllers: [ComplianceController],
  providers:   [ComplianceService],
  exports:     [ComplianceService],
})
export class ComplianceModule {}
