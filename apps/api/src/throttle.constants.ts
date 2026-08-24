/**
 * IP-based rate limits, in one place.
 *
 * These are a **backstop against abuse**, not the app's real defences: the OTP
 * flow already counts attempts per *account* (`OTP_MAX_ATTEMPTS`) and enforces a
 * per-account resend cooldown, which is what actually stops someone grinding at
 * one inbox. What none of that covers is a single IP hammering many different
 * addresses, or guessing passwords at `POST /auth/login` — which had no ceiling
 * of any kind before this file existed.
 *
 * Two things are worth knowing before retuning any of these numbers.
 *
 * **The window is per route, not per app.** `ThrottlerGuard`'s key is
 * `sha256(<Controller>-<handler>-<throttler name>-<ip>)`, so `DEFAULT_LIMIT`
 * below is 100 requests/minute *to each endpoint* from one IP, not 100 across
 * the whole API. That is deliberate and it is why the default can be generous:
 * a busy Discover session paginating and typing in the search box spends its
 * budget on `/tmdb/discover` and `/tmdb/search` separately, and neither can eat
 * into the allowance the next request to `/auth/login` gets. Making the default
 * a single app-wide bucket would also break the per-route overrides, since the
 * stricter routes reuse the same throttler name and would then share that one
 * bucket at their own much smaller limit.
 *
 * **The tracker is `req.ip`**, which is only the true client address when
 * Express is told to trust the proxy in front of it — see `TRUST_PROXY` in
 * `main.ts`. Deployed behind a load balancer without that, every request looks
 * like it came from the balancer and the whole world shares one bucket.
 */

/** One minute, in ms — the window every limit below is expressed against. */
export const THROTTLE_WINDOW_MS = 60 * 1000;

/**
 * The app-wide floor, applied to every route by the global `ThrottlerGuard`.
 *
 * Sized to be invisible to one real person. Discover, search, the typeahead and
 * the batch status lookup are all well inside it — the typeahead is debounced
 * and its per-keystroke queries are superseded rather than sent — so from a
 * browser this only bites on scripted traffic.
 *
 * **Revisit this number before scaling past one frontend instance.** The
 * `/tmdb/*` routes are called from Next's *server*, not the visitor's browser:
 * every server-rendered Discover, Search and movie page is one request from the
 * Next process's own address, so in production all visitors share a single
 * bucket per route here. `TRUST_PROXY` does not help — that traffic genuinely
 * originates there. At real traffic the choice is to raise this substantially
 * or to `@SkipThrottle()` the public catalogue routes and rely on TMDB's own
 * rate limit plus Next's `fetch` cache. Left as-is for now because it is a
 * capacity decision that depends on deployment shape, and browser-side traffic
 * (auth, `user-movies`, the typeahead) is correctly per-visitor either way.
 */
export const DEFAULT_LIMIT = 100;

/**
 * `POST /auth/login` — the gap this whole file was added to close.
 *
 * Nothing else limits password guesses against a known address: the OTP attempt
 * ceiling protects a *code*, not a password, and there is no account lockout.
 * Five a minute is far below what a guessing run needs and well above what a
 * person typing their own password needs, including a couple of typos and a
 * password-manager retry.
 */
export const LOGIN_LIMIT = 5;

/**
 * `POST /auth/forgot-password` and `POST /auth/resend-otp`.
 *
 * Both already refuse to send more than one mail per minute *per account*, so
 * this adds nothing against a single target. It exists for the case that
 * cooldown cannot see: one IP walking a list of addresses to farm mail sends
 * (`forgot-password` answers identically either way, but the send still costs a
 * Gmail quota slot) or to probe which ones exist (`resend-otp` 404s on an
 * unknown email). Ten a minute leaves an ordinary user — who might legitimately
 * resend once or twice and mistype their address — untouched.
 */
export const EMAIL_DISPATCH_LIMIT = 10;

/**
 * `POST /auth/signup`.
 *
 * Blunts scripted mass account creation without punishing a shared egress IP —
 * an office, a university, or CGNAT can put a lot of genuine people behind one
 * address, and ten new accounts a minute from one of those is plausible where a
 * hundred is not.
 */
export const SIGNUP_LIMIT = 10;
