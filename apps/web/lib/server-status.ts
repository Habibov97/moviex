/**
 * What `GET /api/wake` answers. Shared by the route (which produces it) and
 * `useServerStatus` (which reads it), so the two cannot disagree on a spelling.
 *
 * - `up` — the API answered its health check inside the timeout.
 * - `waking` — it did not: Render is cold-starting it (or it is down; from here
 *   the two look the same, which is why the client gives up after a while).
 */
export type WakeStatus = "up" | "waking";

/**
 * Same-origin path of the wake route — **served by Next, not proxied.**
 *
 * Every other `/api/*` path is rewritten to Render by `next.config.js`, but
 * a route handler is a filesystem route and Next checks those before
 * `afterFiles` rewrites, so `app/api/wake/route.ts` wins for this one path.
 * Deliberately relative, never `API_BASE_URL`: it must reach this Next server
 * even in local dev, where the browser otherwise talks to Nest directly.
 */
export const WAKE_PATH = "/api/wake";
