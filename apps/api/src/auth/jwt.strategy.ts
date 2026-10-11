import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'dev-secret'),
    });
  }

  async validate(payload: any) {
    // The payload is what we signed in auth.service.ts ({ sub: userId, role })
    // Return as userId so all controllers can access req.user.userId.
    // Refuse a token without them: an undefined userId reaching a
    // `where: { user: { id } }` matches the first row (common/lookup-key.ts).
    if (typeof payload?.sub !== 'string' || !payload.sub || typeof payload?.role !== 'string') {
      throw new UnauthorizedException();
    }
    return {
      userId: payload.sub,
      role: payload.role,
    };
  }
}

