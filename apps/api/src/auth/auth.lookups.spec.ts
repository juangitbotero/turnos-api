import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtStrategy } from './jwt.strategy';

/**
 * A missing request field must never reach a TypeORM lookup: the condition
 * is dropped and the first user in the table comes back (common/lookup-key.ts).
 * Found 2026-10-11 — an empty POST /auth/verify-otp signed in as that user
 * while the mock OTP was live.
 */
describe('auth lookups fail closed on missing input', () => {
  const firstUser = { id: 'first-user', role: 'EMPLOYER', password: 'hash' };

  function makeUsers() {
    const userRepo = { findOne: jest.fn().mockResolvedValue(firstUser) };
    const users = Object.create(UsersService.prototype) as UsersService;
    (users as any).userRepo = userRepo;
    return { users, userRepo };
  }

  function makeAuth(users: UsersService) {
    const auth = Object.create(AuthService.prototype) as AuthService;
    Object.assign(auth as any, {
      usersService: users,
      twilioClient: null,
      twilioServiceSid: '',
      mockOtpStore: new Map<string, string>(),
      redis: { get: jest.fn().mockResolvedValue(null), del: jest.fn() },
      generateTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
    });
    return auth;
  }

  it('UsersService lookups return null without querying for an empty key', async () => {
    const { users, userRepo } = makeUsers();
    for (const key of [undefined, null, '', '   ', {} as any]) {
      expect(await users.findByPhone(key)).toBeNull();
      expect(await users.findByEmail(key)).toBeNull();
      expect(await users.findById(key)).toBeNull();
      expect(await users.findByGoogleId(key)).toBeNull();
      expect(await users.findByIdWithPassword(key)).toBeNull();
    }
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it('verify-otp with no phone and no code is refused under the mock', async () => {
    const { users } = makeUsers();
    const auth = makeAuth(users);
    await expect(auth.verifyOtp(undefined as any, undefined as any)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(auth.verifyOtp('+351912345678', undefined as any)).rejects.toBeInstanceOf(UnauthorizedException);
    expect((auth as any).generateTokens).not.toHaveBeenCalled();
  });

  it('verify-otp with a code for a phone that never asked for one is refused', async () => {
    const { users } = makeUsers();
    const auth = makeAuth(users);
    await expect(auth.verifyOtp('+351912345678', '123456')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('employer login without an email is refused before any lookup', async () => {
    const { users, userRepo } = makeUsers();
    const auth = makeAuth(users);
    await expect(auth.employerLogin(undefined as any, 'secret')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it('refresh without a user id is refused', async () => {
    const { users } = makeUsers();
    const auth = makeAuth(users);
    await expect(auth.refreshTokens(undefined as any, 'token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('Google sign-in without a verified email is refused', async () => {
    const { users, userRepo } = makeUsers();
    const auth = makeAuth(users);
    const realFetch = global.fetch;
    for (const profile of [
      { id: 'g1', verified_email: true },                    // no email scope
      { id: 'g1', email: 'a@b.pt', verified_email: false },  // unverified
      { email: 'a@b.pt', verified_email: true },             // no id
    ]) {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => profile }) as any;
      await expect(auth.googleLogin('token', 'WORKER')).rejects.toBeInstanceOf(UnauthorizedException);
    }
    global.fetch = realFetch;
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it('a JWT without sub is not a session', async () => {
    const strategy = Object.create(JwtStrategy.prototype) as JwtStrategy;
    await expect(strategy.validate({ role: 'EMPLOYER' })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(strategy.validate({ sub: 'u1', role: 'WORKER' })).resolves.toEqual({ userId: 'u1', role: 'WORKER' });
  });
});
