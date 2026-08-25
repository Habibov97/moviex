import { z } from 'zod';

import { emailSchema, passwordSchema } from './auth';
import type { AuthValidationKey } from './auth';

/**
 * Account recovery: a code shown once at signup, and the only way back into an
 * account whose password has been forgotten.
 *
 * This replaced an emailed-OTP flow entirely. The reason was operational — the
 * deployment host blocks outbound SMTP at the network level, so no code this
 * app generates can ever leave it — but the security model is genuinely
 * different and worth stating rather than inferring:
 *
 * - **An emailed code proves control of an address.** Recovery therefore
 *   depended on the mailbox, and the account could be recovered from any
 *   device as long as that mailbox was reachable.
 * - **A recovery code proves possession of a secret handed over once.** Nothing
 *   is sent anywhere, there is no address to verify, and there is no second
 *   channel to fall back on.
 *
 * The consequence is deliberate and must be stated plainly in the UI: **a user
 * who loses both their password and their recovery code has permanently lost
 * the account.** There is no reset-by-email, no support path, and no way to
 * regenerate the code from the stored hash. That is the accepted trade, not an
 * omission to be quietly patched later.
 */

/**
 * Characters in a recovery code.
 *
 * Six from a 23-letter alphabet is ~23^6 ≈ 1.5×10^8 possibilities. That is far
 * weaker than a password hash's usual threat model, and it is why **rate
 * limiting is the defence here** rather than an expiry: unlike the OTP it
 * replaced, this code has no lifetime and no per-code attempt ceiling, so the
 * only thing standing between an attacker and an offline-speed guessing run is
 * the throttler on `POST /auth/verify-recovery-code`.
 */
export const RECOVERY_CODE_LENGTH = 6;

/**
 * The alphabet a code is drawn from: A–Z minus `I`, `O` and `L`.
 *
 * Those three are excluded because this is a code a human reads off a screen,
 * writes down, and types back weeks later — `I`/`1`, `O`/`0` and `l`/`1` are
 * the classic transcription failures, and a wrong character here is
 * indistinguishable from a wrong code. Digits are left out entirely for the
 * same reason: an all-letter code cannot contain a `0` to confuse with an `O`.
 *
 * Shrinking the alphabet costs about 0.4 bits per character against a random
 * 26-letter one. That is a real cost and it is worth it — a code that is
 * mistyped is not more secure, it is just unusable.
 */
export const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';

/** The `auth.validation.*` keys the schemas below can produce. */
export const RECOVERY_VALIDATION_KEYS = ['recoveryCodeIncomplete'] as const;

export type RecoveryValidationKey = (typeof RECOVERY_VALIDATION_KEYS)[number];

/**
 * Exactly {@link RECOVERY_CODE_LENGTH} characters from
 * {@link RECOVERY_CODE_ALPHABET}.
 *
 * One message for every failure mode — too short, too long, a character
 * outside the alphabet — because from the user's side they are all "that is
 * not the code yet". The input upper-cases as it goes, so a lowercase entry
 * never reaches this.
 */
export const recoveryCodeSchema = z
  .string()
  .regex(
    new RegExp(`^[${RECOVERY_CODE_ALPHABET}]{${RECOVERY_CODE_LENGTH}}$`),
    'recoveryCodeIncomplete' satisfies RecoveryValidationKey,
  );

/** `POST /auth/verify-recovery-code` — step 1 of the two-step reset. */
export const verifyRecoveryCodeSchema = z.object({
  email: emailSchema,
  recoveryCode: recoveryCodeSchema,
});

/**
 * The **form** behind `POST /auth/reset-password` — step 2.
 *
 * `resetToken` is deliberately absent: it is not something a user types, it is
 * held in the modal's state between the two steps. This validates the part a
 * human fills in, against the same {@link passwordSchema} the signup form uses
 * — a password chosen here has to clear exactly the policy a password chosen at
 * registration does, or the reset flow becomes a way around it.
 */
export const resetPasswordFormSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z
      .string()
      .min(1, 'confirmRequired' satisfies AuthValidationKey),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'passwordsDoNotMatch' satisfies AuthValidationKey,
    path: ['confirmPassword'],
  });

export type VerifyRecoveryCodeInput = z.infer<typeof verifyRecoveryCodeSchema>;
export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;

/** The wire body for `POST /auth/reset-password`. */
export type ResetPasswordInput = {
  /** From {@link VerifyRecoveryCodeResponse}. Never persisted anywhere. */
  resetToken: string;
  newPassword: string;
};

/**
 * Machine-readable reasons an auth call can fail, so the client branches on a
 * code rather than pattern-matching English prose.
 *
 * `apps/api` may only import **types** from this package, so it declares its
 * own frozen object of the same strings and checks it with
 * `satisfies Record<…, AuthErrorCode>` — adding a code here fails the API's
 * compile until it is handled there too.
 */
export const AUTH_ERROR_CODES = [
  /**
   * The email/recovery-code pair did not match — **or** the address has no
   * account, **or** the account has no recovery code stored. One code for all
   * three, deliberately: any distinction turns this endpoint into an account
   * oracle, and there is one action to take either way.
   */
  'RECOVERY_CODE_INVALID',
  /**
   * The password-reset token was missing, malformed, expired, or signed for a
   * different purpose. One code for all four: they are the same instruction to
   * the user ("that reset session is over, start again"), and telling them
   * apart would describe the token to whoever is probing it.
   */
  'RESET_TOKEN_INVALID',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/** The error body carried by a failed auth call that has a code for it. */
export type AuthErrorResponse = {
  statusCode: number;
  message: string;
  code: AuthErrorCode;
};

/**
 * `POST /auth/signup`.
 *
 * **`recoveryCode` is plaintext, and this response is the only place it ever
 * exists outside the user's own notes.** The server keeps a bcrypt hash and
 * nothing else, so it cannot be re-sent, re-read or recovered — which is the
 * entire point, and also why the client must not treat this like an ordinary
 * field: it is never logged, never cached, and never persisted anywhere.
 *
 * Signup also establishes the session (the cookie is set on this response), so
 * the client shows the code and then continues into the app already signed in.
 */
export type SignupResponse = {
  user: {
    id: number;
    userName: string;
    email: string;
  };
  recoveryCode: string;
};

/**
 * `POST /auth/verify-recovery-code`.
 *
 * `resetToken` is a JWT signed with the same secret as a session token but is
 * **not one**: it carries `purpose: 'password_reset'`, expires in minutes
 * rather than days, and is returned in the body instead of being set as a
 * cookie — precisely so it cannot be mistaken for, or used as, a session. The
 * guard reads sessions from the cookie only, so this token authenticates
 * nothing but the one request it was minted for.
 */
export type VerifyRecoveryCodeResponse = {
  status: 'reset_token_issued';
  resetToken: string;
  /** How long the client has to submit the new password. */
  expiresInSeconds: number;
};

/** `POST /auth/reset-password`. No session, no cookie — go and sign in. */
export type ResetPasswordResponse = {
  status: 'password_updated';
};
