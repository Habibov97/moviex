import { randomInt } from 'node:crypto';

import type { AuthErrorCode } from '@moviex/shared-types';

/**
 * Recovery-code policy, in one place.
 *
 * The alphabet and the length are mirrored from `@moviex/shared-types` rather
 * than imported: `apps/api` may only import **types** from that package (it
 * ships raw `.ts` that `node dist/main` cannot parse), so the values are
 * restated here and checked against the shared type where possible. Edit both
 * together — a mismatch means the client's own validation would reject a code
 * this file just generated.
 */

/** Characters per code. Mirrors `RECOVERY_CODE_LENGTH`. */
export const RECOVERY_CODE_LENGTH = 6;

/**
 * A–Z minus `I`, `O` and `L`. Mirrors `RECOVERY_CODE_ALPHABET`.
 *
 * Those three are the classic hand-transcription failures (`I`/`1`, `O`/`0`,
 * `l`/`1`), and this is a code someone reads off a screen and types back weeks
 * later. Digits are excluded entirely so no `0` can be confused with an `O`.
 */
export const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * How long the reset token minted by `POST /auth/verify-recovery-code` lives.
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
 * Unchanged from the OTP flow this replaced — the token's job did not change,
 * only what has to be proven before it is issued.
 */
export const RESET_TOKEN_TTL_SECONDS = 10 * 60;

/** The purpose claim that separates a reset token from a session token. */
export const PASSWORD_RESET_PURPOSE = 'password_reset';

/**
 * Machine-readable failure reasons, mirrored from `@moviex/shared-types`.
 *
 * `satisfies` against the imported **type** is what keeps the two in step: the
 * type is erased at build time but still fails the compile if a string here is
 * not a member of the shared union.
 */
export const AUTH_ERROR_CODE = {
  RECOVERY_CODE_INVALID: 'RECOVERY_CODE_INVALID',
  RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',
} as const satisfies Record<string, AuthErrorCode>;

/**
 * A fresh recovery code.
 *
 * `randomInt` from `node:crypto`, not `Math.random`: this is a credential that
 * never expires, and `Math.random` is a seeded PRNG whose output is predictable
 * from previous draws — one leaked code would leak its neighbours.
 *
 * `randomInt` with an exclusive upper bound is uniform over the alphabet, so
 * there is no modulo bias to correct for.
 */
export function generateRecoveryCode(): string {
  let code = '';

  for (let index = 0; index < RECOVERY_CODE_LENGTH; index += 1) {
    code += RECOVERY_CODE_ALPHABET[randomInt(RECOVERY_CODE_ALPHABET.length)];
  }

  return code;
}
