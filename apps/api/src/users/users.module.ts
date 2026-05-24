import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Worker } from './entities/worker.entity';
import { Employer } from './entities/employer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Worker, Employer])],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
