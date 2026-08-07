import {
  Controller, Post, Delete, Query, Headers, HttpCode, HttpStatus,
  ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators';
import { DemoSeedService } from './demo-seed.service';

/**
 * Demo data endpoints, for filling a test account before recording a video.
 *
 * ⚠️ This writes to whatever database the API is pointed at, including
 * production. Three things keep that safe:
 *
 *   1. **Off by default.** With `DEMO_SEED_TOKEN` unset, every route here 404s
 *      as if it did not exist. Unset the variable in Railway when you are done
 *      and the endpoints disappear without a code change.
 *   2. **Token required.** The token is compared in full; there is no default
 *      value and no fallback. It is deliberately NOT the JWT — the point is to
 *      run this without an admin account existing yet.
 *   3. **Reversible.** DELETE removes every row the seeder wrote, matched on a
 *      deterministic `dede…` id prefix that no real row can have.
 *
 * It is `@Public()` because it is guarded by the token, not by a session.
 */
@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoSeedService) {}

  private assertEnabled(token: string | undefined): void {
    const expected = process.env['DEMO_SEED_TOKEN'];
    // Absent variable → behave as if the route does not exist, so a probe
    // cannot tell demo seeding from a typo in the path.
    if (!expected) throw new NotFoundException('Cannot POST /api/demo/seed');
    if (!token || token !== expected) throw new ForbiddenException('Invalid demo token');
  }

  /**
   * Fill a worker account with demo history.
   *
   * curl -X POST "$API/demo/seed?phone=%2B33767560422" -H "x-demo-token: <token>"
   */
  @Public()
  @Post('seed')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async seed(
    @Headers('x-demo-token') headerToken: string | undefined,
    @Query('token') queryToken: string | undefined,
    @Query('phone') phone: string,
    @Query('history') history?: string,
  ) {
    this.assertEnabled(headerToken ?? queryToken);
    if (!phone) throw new ForbiddenException('phone query parameter is required');

    const historyCount = history ? Math.max(0, Math.min(60, Number(history))) : 20;
    const summary = await this.demo.seed(phone, historyCount);
    return { ok: true, ...summary };
  }

  /** Remove every demo row. The worker account itself is kept. */
  @Public()
  @Delete('seed')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async reset(
    @Headers('x-demo-token') headerToken: string | undefined,
    @Query('token') queryToken: string | undefined,
    @Query('phone') phone: string,
  ) {
    this.assertEnabled(headerToken ?? queryToken);
    if (!phone) throw new ForbiddenException('phone query parameter is required');
    return { ok: true, removed: await this.demo.reset(phone) };
  }
}
