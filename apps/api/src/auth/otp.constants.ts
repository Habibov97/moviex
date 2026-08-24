import { randomInt } from 'node:crypto';

import type { AuthErrorCode, OtpPurpose } from '@moviex/shared-types';

/**
 * Email-verification policy, in one place.
 *
 * These are the *server's* numbers and there is no client-side copy of them:
 * every endpoint that issues a code returns the remaining seconds alongside it
 * (`OtpChallenge`), so the modal's countdown is driven by this file even though
 * it cannot import it.
 */

/** Codes run 1000–9999, so every one is exactly four digits. */
const OTP_MIN = 1000;
const OTP_MAX = 9999;

/** How long an issued code stays valid. */
export const OTP_TTL_MS = 10 * 60 * 1000;

/** Minimum gap between two sends to the same account. */
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Wrong guesses allowed against one code before it is refused outright.
 *
 * Five of ten thousand is a 0.05% chance of a blind hit, and the counter resets
 * only when a *new* code is issued — so an attacker cannot buy more guesses at
 * the same secret, and a real user who fat-fingered it five times has an
 * obvious way forward.
 */
export const OTP_MAX_ATTEMPTS = 5;

/**
 * How long the reset token minted by `POST /auth/verify-reset-otp` lives.
 *
 * **Ten minutes, and it is not a session.** It exists only to carry proof
 * between two consecutive requests the user makes seconds apart — verify the
 * code, then submit the new password — so its lifetime is sized to "someone
 * choosing a password, possibly consulting a password manager", not to a
 * browsing session. The short expiry is most of what makes returning it in a
 * response body acceptable: unlike the session cookie, it is readable by client
 * JavaScript, so the mitigation is that there is almost nothing to steal and
 * almost no time in which to steal it.
 *
 * Expressed in seconds because that is what `jwt.sign`'s `expiresIn` takes as a
 * number, and what the response reports to the client.
 */
export const RESET_TOKEN_TTL_SECONDS = 10 * 60;

/**
 * The two things a code can be issued for, mirroring `OTP_PURPOSES` in
 * `@moviex/shared-types` — same `satisfies`-against-the-imported-type trick as
 * `AUTH_ERROR_CODE` below, because this package's values cannot be imported.
 *
 * These strings are also the Postgres enum's labels (see the migration), so
 * renaming one is a schema change, not just a refactor.
 */
export const OTP_PURPOSE = {
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
} as const satisfies Record<string, OtpPurpose>;

/** The same values as an array, for the entity's `enum` column definition. */
export const OTP_PURPOSE_VALUES = Object.values(OTP_PURPOSE);

/**
 * Machine-readable failure reasons, mirrored from `@moviex/shared-types`.
 *
 * `satisfies` against the imported **type** is what keeps the two in step:
 * `apps/api` may not import values from that package (it ships raw `.ts` Node
 * cannot parse), but the type is erased at build time and still fails the
 * compile if a string here is not a member of the shared union.
 */
export const AUTH_ERROR_CODE = {
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  OTP_RESEND_COOLDOWN: 'OTP_RESEND_COOLDOWN',
  RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',
} as const satisfies Record<string, AuthErrorCode>;

/**
 * A fresh code.
 *
 * `randomInt` from `node:crypto`, not `Math.random`: this is a credential, and
 * `Math.random` is a seeded PRNG whose output is predictable from previous
 * draws. The range is small enough that the difference only matters alongside
 * the expiry and attempt limits above — but it costs nothing to get right.
 */
export function generateOtpCode(): string {
  // Upper bound is exclusive.
  return String(randomInt(OTP_MIN, OTP_MAX + 1));
}

/** Whole seconds remaining until `date`, floored at 0. `null` reads as 0. */
export function secondsUntil(date: Date | null): number {
  if (!date) return 0;

  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
}
