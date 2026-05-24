import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { Shift } from './entities/shift.entity';
import { ShiftApplication } from './entities/shift-application.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Shift, ShiftApplication])],
  providers: [ShiftsService],
  controllers: [ShiftsController]
})
export class ShiftsModule {}
