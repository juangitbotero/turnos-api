import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { MailService } from '../mail/mail.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test'),
          },
        },
        { provide: MailService, useValue: { status: 'log-only' } },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return status ok', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('turnos-api');
    expect(result.timestamp).toBeDefined();
  });
});
