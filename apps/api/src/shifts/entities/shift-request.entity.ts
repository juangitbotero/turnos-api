import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Employer } from '../../users/entities/employer.entity';

/**
 * Several roles posted in one go ("Publicar vários turnos") — e.g. a hotel's
 * Saturday: 2 waiters, 1 barman, 1 dishwasher.
 *
 * Only a label and an owner. Every slot is still a normal `Shift` row carrying
 * `requestId` (this request) and `lineId` (the row of the request it came
 * from); check-in, compliance, fees and payment run per shift, unchanged.
 */
@Entity('shift_requests')
export class ShiftRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employer, { onDelete: 'CASCADE' })
  @JoinColumn()
  employer: Employer;

  /** Written by the company ("Casamento sábado") — displayed, not translated. */
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @CreateDateColumn()
  createdAt: Date;
}
