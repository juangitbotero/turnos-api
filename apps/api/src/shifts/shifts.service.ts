import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift, ShiftStatus } from './entities/shift.entity';
import { ShiftApplication, ApplicationStatus } from './entities/shift-application.entity';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private shiftRepository: Repository<Shift>,
    @InjectRepository(ShiftApplication)
    private applicationRepository: Repository<ShiftApplication>,
  ) {}

  async create(employerId: string, data: Partial<Shift> & { lat: number; lng: number }) {
    const shift = this.shiftRepository.create({
      ...data,
      status: ShiftStatus.OPEN,
      employer: { id: employerId } as any,
      location: {
        type: 'Point',
        coordinates: [data.lng, data.lat], // GeoJSON order is Longitude, Latitude
      },
    });
    return this.shiftRepository.save(shift);
  }

  async search(filters: {
    lat?: number;
    lng?: number;
    radiusMeters?: number;
    category?: string;
    subcategory?: string;
    employerId?: string;
  }) {
    const query = this.shiftRepository
      .createQueryBuilder('shift')
      .leftJoinAndSelect('shift.employer', 'employer')
      .where('shift.status = :status', { status: ShiftStatus.OPEN });

    if (filters.lat !== undefined && filters.lng !== undefined) {
      const radius = filters.radiusMeters || 20000;
      query.andWhere(
        `ST_DWithin(
          shift.location::geography, 
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, 
          :radius
        )`
      ).setParameters({ lng: filters.lng, lat: filters.lat, radius });
    }

    if (filters.category) {
      query.andWhere('shift.category = :category', { category: filters.category });
    }

    if (filters.subcategory) {
      query.andWhere('shift.subcategory = :subcategory', { subcategory: filters.subcategory });
    }

    if (filters.employerId) {
      query.andWhere('employer.id = :employerId', { employerId: filters.employerId });
    }

    return query.getMany();
  }

  async apply(workerId: string, shiftId: string) {
    const shift = await this.shiftRepository.findOne({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.status !== ShiftStatus.OPEN) throw new BadRequestException('Shift is not open');

    const existingApplication = await this.applicationRepository.findOne({
      where: { shift: { id: shiftId }, worker: { id: workerId } },
    });

    if (existingApplication) {
      throw new BadRequestException('Already applied for this shift');
    }

    const application = this.applicationRepository.create({
      shift: { id: shiftId } as any,
      worker: { id: workerId } as any,
      status: ApplicationStatus.PENDING,
    });

    return this.applicationRepository.save(application);
  }

  async approveApplication(employerId: string, shiftId: string, applicationId: string) {
    const shift = await this.shiftRepository.findOne({
      where: { id: shiftId },
      relations: ['employer'],
    });

    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.employer.id !== employerId) throw new UnauthorizedException('Not your shift');
    if (shift.status !== ShiftStatus.OPEN) throw new BadRequestException('Shift is no longer open');

    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ['worker'],
    });

    if (!application) throw new NotFoundException('Application not found');

    // Approve the chosen one
    application.status = ApplicationStatus.APPROVED;
    await this.applicationRepository.save(application);

    // Assign worker to shift and change status
    shift.assignedWorker = application.worker;
    shift.status = ShiftStatus.FILLED;
    await this.shiftRepository.save(shift);

    // Reject all other pending applications for this shift
    await this.applicationRepository
      .createQueryBuilder()
      .update(ShiftApplication)
      .set({ status: ApplicationStatus.REJECTED })
      .where('shiftId = :shiftId AND id != :applicationId', { shiftId, applicationId })
      .execute();

    return shift;
  }
}
