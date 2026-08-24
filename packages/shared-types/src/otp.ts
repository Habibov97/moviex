import { z } from 'zod';

import { emailSchema } from './auth';

/**
 * Email verification: the one-time code a new account has to enter before it
 * becomes usable.
 *
 * **The timing values are deliberately not here.** How long a code lives and
 * how long the resend cooldown runs are the *server's* facts, and the server
 * sends them back on every call that issues a code (`OtpChallenge` below), so
 * the modal's countdown reads real remaining time rather than counting down a
 * constant that a deployed API may no longer agree with. `apps/api` also
 * cannot import runtime values from this package (see the note on
 * `passwordSchema`), so a shared constant would have had to be mirrored by
 * hand anyway — and a mirrored *timer* drifts silently, unlike a mirrored
 * validation rule, which fails loudly on the next request.
 */

/** Digits in the emailed code. Also the number of input boxes rendered. */
export const OTP_CODE_LENGTH = 4;

/**
 * What an outstanding code is *for*.
 *
 * The `otp*` columns on `users` are shared by both flows — one account can only
 * be mid-flow on one of them at a time, so a second set of columns would be
 * four nullable fields that are null in every row. What makes sharing them safe
 * is that the purpose is stored alongside the code and checked on the way back
 * in: a code emailed to verify an address cannot be spent to reset a password,
 * and vice versa. Without that check, "verify your email" and "prove you own
 * this account" would be the same four digits.
 *
 * `apps/api` mirrors these strings in `otp.constants.ts` under a `satisfies`
 * against this type — it may not import values from this package.
 */
export const OTP_PURPOSES = ['email_verification', 'password_reset'] as const;

export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/** The `auth.validation.*` keys the schemas below can produce. */
export const OTP_VALIDATION_KEYS = ['otpIncomplete'] as const;

export type OtpValidationKey = (typeof OTP_VALIDATION_KEYS)[number];

/**
 * Exactly `OTP_CODE_LENGTH` digits.
 *
 * One message for every failure mode — too short, too long, non-numeric — on
 * purpose: from the user's side they are all "that isn't the code yet", and
 * the boxed input makes each of them hard to reach in the first place.
 */
export const otpCodeSchema = z
  .string()
  .regex(
    new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`),
    'otpIncomplete' satisfies OtpValidationKey,
  );

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
});

export const resendOtpSchema = z.object({
  email: emailSchema,
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;

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
  /** Correct password, but the address was never verified. Not a 401. */
  'EMAIL_NOT_VERIFIED',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_TOO_MANY_ATTEMPTS',
  'OTP_RESEND_COOLDOWN',
  /**
   * The password-reset token was missing, malformed, expired, or signed for a
   * different purpose. One code for all four: they are the same instruction to
   * the user ("that reset session is over, start again"), and telling them
   * apart would describe the token to whoever is probing it.
   */
  'RESET_TOKEN_INVALID',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/**
 * What the client needs to run the OTP screen, returned by every endpoint that
 * issues or re-issues a code.
 *
 * Both figures are *remaining* seconds at the moment of the response, not
 * fixed policy values — which is what lets the modal show a truthful clock
 * after a resend that the server declined to reset.
 */
export type OtpChallenge = {
  email: string;
  /** Seconds until the emailed code stops being accepted. */
  expiresInSeconds: number;
  /** Seconds until "Resend code" becomes available. `0` when it already is. */
  resendAvailableInSeconds: number;
  /**
   * Whether the code actually reached the mail server.
   *
   * `false` means the account exists and is waiting on a code that was never
   * sent — the client should say so and point at Resend, rather than showing a
   * countdown for a code that will never arrive.
   */
  emailSent: boolean;
};

/** `POST /auth/signup` and `POST /auth/resend-otp`. */
export type OtpChallengeResponse = {
  status: 'pending_verification';
  challenge: OtpChallenge;
};

/** The error body carried by a failed auth call that has a code for it. */
export type AuthErrorResponse = {
  statusCode: number;
  message: string;
  code: AuthErrorCode;
  /** Present on `OTP_RESEND_COOLDOWN`: seconds left before another send. */
  retryAfterSeconds?: number;
};
