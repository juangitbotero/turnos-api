import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';
import { SsDiretaProcessor } from './processors/ss-direta.processor';
import { McdContract } from './entities/mcd-contract.entity';
import { ComplianceAuditLog } from './entities/compliance-audit-log.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { Worker } from '../users/entities/worker.entity';
import { Employer } from '../users/entities/employer.entity';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      McdContract,
      ComplianceAuditLog,
      Shift,
      Worker,
      Employer,
    ]),

    // BullMQ queue — SS Direta email notifications (fires 24h before each confirmed shift)
    BullModule.registerQueue({ name: 'ss-direta' }),

    MailModule,
  ],
  controllers: [ComplianceController],
  providers:   [ComplianceService, SsDiretaProcessor],
  exports:     [ComplianceService],
})
export class ComplianceModule {}
