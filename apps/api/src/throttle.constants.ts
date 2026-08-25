/**
 * IP-based rate limits, in one place.
 *
 * For most routes these are a **backstop against abuse**. For two of them they
 * are the *only* defence, and that distinction matters when retuning a number:
 * `POST /auth/login` has no account lockout behind it, and
 * `POST /auth/verify-recovery-code` guards a credential that never expires and
 * has no per-code attempt ceiling. Loosening either is not a tuning decision,
 * it is a security one.
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
 * Nothing else limits password guesses against a known address — there is no
 * account lockout anywhere in this app.
 * Five a minute is far below what a guessing run needs and well above what a
 * person typing their own password needs, including a couple of typos and a
 * password-manager retry.
 */
export const LOGIN_LIMIT = 5;

/**
 * `POST /auth/verify-recovery-code`.
 *
 * **This is the tightest limit in the app for a reason, and it is the primary
 * defence rather than a supplementary one.** A recovery code is 6 characters
 * from a 23-letter alphabet — about 1.5×10^8 possibilities — and, unlike the
 * emailed OTP it replaced, it has **no expiry and no per-code attempt
 * ceiling**. There is nothing else standing between an attacker and an
 * unlimited guessing run against a known address.
 *
 * Five a minute per IP puts a single-address exhaustive search at roughly 58
 * years. That is not a proof (an attacker with many source addresses divides
 * it), which is why the code is bcrypt-hashed at rest as well — but it is what
 * turns "guessable in an afternoon" into "not worth attempting".
 *
 * Five is also the same budget `LOGIN_LIMIT` gives a password, and for the same
 * reason: a person entering a credential they believe is correct needs a couple
 * of typos' worth of headroom and no more.
 */
export const RECOVERY_CODE_LIMIT = 5;

/**
 * `POST /auth/signup`.
 *
 * Blunts scripted mass account creation without punishing a shared egress IP —
 * an office, a university, or CGNAT can put a lot of genuine people behind one
 * address, and ten new accounts a minute from one of those is plausible where a
 * hundred is not.
 */
export const SIGNUP_LIMIT = 10;
