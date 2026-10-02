import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Liveness probe for keeping the Render free-tier instance awake.
 *
 * Render spins a free web service down after 15 minutes without inbound
 * traffic, and the next request then waits ~30–50s for a cold start. Two
 * things call this to prevent and to explain that:
 *
 * - `.github/workflows/keep-awake.yml` pings it every 10 minutes, so the
 *   instance never sits idle long enough to sleep.
 * - The web app's `/api/wake` route calls it on page load, so `ServerStatus`
 *   can tell a visitor the server is waking up rather than leave them staring
 *   at a spinner when the cron has not kept up.
 *
 * **Deliberately touches nothing** — no database, no TMDB. It answers "is the
 * process up", which is all either caller needs, and it must stay cheap
 * because it is hit constantly. A probe that queried the database would also
 * fail whenever Supabase hiccuped, which is not what "awake" means here.
 *
 * **`@SkipThrottle()` because every web-app call to it arrives from Vercel's
 * address** (see the throttler notes in CLAUDE.md), so all visitors share one
 * bucket. Under the default 100/min, a busy minute would start answering
 * 429, and `/api/wake` would report a healthy server as still waking. It
 * returns a constant, so there is nothing to protect by limiting it.
 */
@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe — is the API process up?' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
