import { API_BASE_URL } from "@/lib/api";
import type { WakeStatus } from "@/lib/server-status";

/**
 * `GET /api/wake` — "is the API awake yet?", answered quickly.
 *
 * Render stops the free-tier API after 15 minutes idle, and the first request
 * afterwards is held open for the ~30–50s cold start. Asking the API directly
 * from the browser would mean a fetch that hangs for that long with no way to
 * tell "slow" from "starting". This route asks on the browser's behalf with a
 * short timeout and returns a verdict either way, so `ServerStatus` can poll it
 * and explain the wait.
 *
 * The request still reaches Render even when it times out here, so calling
 * this is also what *starts* the wake-up — hence the name.
 *
 * It lives at `app/api/wake` rather than under `[locale]` because it is not a
 * page, and it is not swallowed by the `/api/:path*` → Render rewrite: route
 * handlers are filesystem routes, which Next resolves before `afterFiles`
 * rewrites. `proxy.ts` excludes `api`, so next-intl never sees it either.
 */

/**
 * How long to wait for `/health`. A warm API answers in well under a second;
 * anything slower is a cold start, and the client polls again rather than
 * holding a request open for the whole boot.
 */
const HEALTH_TIMEOUT_MS = 5_000;

// Never cached: the whole point is a fresh answer on every poll.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let status: WakeStatus = "waking";

  try {
    // `API_BASE_URL` is the absolute `API_URL` on the server — see lib/api.ts.
    const response = await fetch(`${API_BASE_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (response.ok) status = "up";
  } catch {
    // Timeout or connection refused: both mean "not up yet". Render answers a
    // booting service with a slow response or a 502/503, never with detail
    // worth surfacing, so nothing is logged or passed through.
  }

  return Response.json(
    { status },
    {
      // 503 while waking keeps the status code honest for anything that only
      // looks at it; the client reads the body either way.
      status: status === "up" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
