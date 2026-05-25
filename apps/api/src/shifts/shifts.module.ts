import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { Shift } from './entities/shift.entity';
import { ShiftApplication } from './entities/shift-application.entity';
import { Employer } from '../users/entities/employer.entity';
import { Worker } from '../users/entities/worker.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shift, ShiftApplication, Employer, Worker]),
    BullModule.registerQueue({ name: 'shift-notifications' }),
    GatewayModule,
    NotificationsModule,
  ],
  providers: [ShiftsService],
  controllers: [ShiftsController],
})
export class ShiftsModule {}
