import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum ComplianceEvent {
  CONTRACT_CREATED                = 'CONTRACT_CREATED',
  SS_EMAIL_SENT                   = 'SS_EMAIL_SENT',
  SS_SUBMITTED                    = 'SS_SUBMITTED',
  SS_FAILED                       = 'SS_FAILED',
  SS_RETRY                        = 'SS_RETRY',
  DEPENDENCY_FLAG_40              = 'DEPENDENCY_FLAG_40',
  DEPENDENCY_BLOCK_50             = 'DEPENDENCY_BLOCK_50',
  REST_PERIOD_VIOLATION_ATTEMPT   = 'REST_PERIOD_VIOLATION_ATTEMPT',
  MCD_LIMIT_ATTEMPT               = 'MCD_LIMIT_ATTEMPT',
}

/**
 * Immutable, append-only audit trail for all compliance events.
 * Used for ACT (Autoridade para as Condições do Trabalho) inspections.
 * Never update or delete rows — new events only.
 */
@Entity('compliance_audit_logs')
export class ComplianceAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ComplianceEvent })
  event: ComplianceEvent;

  @Column({ type: 'varchar', nullable: true })
  workerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  employerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  shiftId: string | null;

  @Column({ type: 'varchar', nullable: true })
  contractId: string | null;

  @Column({ type: 'jsonb', default: {} })
  details: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
  // No updatedAt — this log is immutable by design
}
