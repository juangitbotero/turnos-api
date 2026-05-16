import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Turnos API v0.1.0 — Work Today. Staff Today.';
  }
}
