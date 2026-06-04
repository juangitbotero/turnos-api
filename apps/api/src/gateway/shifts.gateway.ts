import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employer } from '../users/entities/employer.entity';
import { Worker } from '../users/entities/worker.entity';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env['NODE_ENV'] === 'production' ? false : '*',
    credentials: true,
  },
})
export class ShiftsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ShiftsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as Record<string, string>)?.token ??
        (client.handshake.query as Record<string, string>)?.token;

      if (!token) {
        // Anonymous connection — no room joined, still connected (for public feed)
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET', 'dev-secret');
      const payload = this.jwtService.verify<{ userId: string; role: string }>(token, { secret });
      const { userId, role } = payload;

      client.data.userId = userId;
      client.data.role = role;

      if (role === 'EMPLOYER') {
        const employer = await this.employerRepo.findOne({ where: { user: { id: userId } } });
        if (employer) {
          await client.join(`employer:${employer.id}`);
          this.logger.log(`Employer ${employer.id} joined WS room`);
        }
      } else if (role === 'WORKER') {
        const worker = await this.workerRepo.findOne({ where: { user: { id: userId } } });
        if (worker) {
          await client.join(`worker:${worker.id}`);
          this.logger.log(`Worker ${worker.id} joined WS room`);
        }
      }
    } catch {
      // Invalid token — stay connected but no private room
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client ${client.id} disconnected`);
  }

  // ── Emit helpers (called by ShiftsService) ────────────────────────────────

  /**
   * Employer dashboard: a worker just applied to one of their shifts.
   * Updates the live applicant count without page refresh.
   */
  notifyNewApplication(
    employerId: string,
    payload: {
      shiftId: string;
      shiftTitle: string;
      applicationId: string;
      workerName: string | null;
      workerScore: number;
    },
  ) {
    this.server
      .to(`employer:${employerId}`)
      .emit('shift:new_application', payload);
  }

  /**
   * Worker app: their application was approved or rejected by the employer.
   */
  notifyApplicationStatus(
    targetId: string,
    payload: {
      shiftId: string;
      shiftTitle: string;
      applicationId: string;
      status: 'APPROVED' | 'REJECTED' | 'PRE_SELECTED' | 'DECLINED_BY_WORKER';
    },
  ) {
    this.server
      .to(`worker:${targetId}`)
      .to(`employer:${targetId}`)
      .emit('shift:status_changed', payload);
  }

  notifyShiftFilled(
    employerId: string,
    payload: { shiftId: string; shiftTitle: string },
  ) {
    this.server
      .to(`employer:${employerId}`)
      .emit('shift:filled', payload);
  }

  /**
   * Worker app: a shift they applied to was cancelled by the employer.
   */
  notifyShiftCancelled(
    workerIds: string[],
    payload: { shiftId: string; shiftTitle: string },
  ) {
    for (const workerId of workerIds) {
      this.server
        .to(`worker:${workerId}`)
        .emit('shift:cancelled', payload);
    }
  }

  /**
   * Attendance events — sent to employer room OR worker room depending on event.
   * Events: 'checked_in' | 'checked_out' | 'shift_completed'
   */
  notifyAttendance(
    roomId: string,  // employer.id → employer:X room; worker.id → worker:X room
    payload: {
      event:          string;
      shiftId:        string;
      shiftTitle?:    string;
      workerName?:    string;
      checkInAt?:     string;
      checkOutAt?:    string;
      scheduledHours?: number;
    },
  ) {
    // Determine correct room prefix from context — service passes raw entity ID;
    // gateway decides prefix based on payload event type
    const room = payload.event === 'shift_completed'
      ? `worker:${roomId}`
      : `employer:${roomId}`;

    this.server.to(room).emit('attendance:update', payload);
  }
}
