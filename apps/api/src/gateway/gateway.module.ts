import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftsGateway } from './shifts.gateway';
import { Employer } from '../users/entities/employer.entity';
import { Worker } from '../users/entities/worker.entity';

@Module({
  imports: [
    // JwtModule with no static secret — secret is passed at verify() time via ConfigService
    JwtModule.register({}),
    TypeOrmModule.forFeature([Employer, Worker]),
  ],
  providers: [ShiftsGateway],
  exports: [ShiftsGateway],
})
export class GatewayModule {}
