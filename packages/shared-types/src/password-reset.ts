import { z } from 'zod';

import { emailSchema, passwordSchema } from './auth';
import type { AuthValidationKey } from './auth';
import { otpCodeSchema } from './otp';

/**
 * Forgotten-password recovery: prove the address by email, then choose a new
 * password.
 *
 * Three steps, three endpoints, and the middle one is where this flow differs
 * from email verification in the way that matters:
 *
 * 1. `POST /auth/forgot-password` — emails a code. **Always answers the same
 *    thing** (see {@link ForgotPasswordResponse}).
 * 2. `POST /auth/verify-reset-otp` — checks the code and hands back a
 *    short-lived reset token. It does **not** sign anyone in; verifying a code
 *    proves the address is reachable, which is not the same as proving intent
 *    to sign in, and someone who never finishes the flow should not end up with
 *    a session they did not ask for.
 * 3. `POST /auth/reset-password` — spends that token to set the new password,
 *    and still does not sign anyone in. The user goes back to the login form
 *    and enters the password they just chose, which is also the only proof that
 *    it is the password they think it is.
 */

/** `POST /auth/forgot-password` */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/** `POST /auth/verify-reset-otp` */
export const verifyResetOtpSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
});

/**
 * The **form** behind `POST /auth/reset-password`.
 *
 * `resetToken` is deliberately absent: it is not something a user types, it is
 * held in the modal's state between step 2 and step 3. This schema validates
 * the part a human fills in, against the same {@link passwordSchema} the signup
 * form uses — a password chosen here has to clear exactly the policy a password
 * chosen at registration does, or the reset flow becomes a way around it.
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

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyResetOtpInput = z.infer<typeof verifyResetOtpSchema>;
export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;

/** The wire body for `POST /auth/reset-password`. */
export type ResetPasswordInput = {
  /** From {@link VerifyResetOtpResponse}. Never persisted anywhere durable. */
  resetToken: string;
  newPassword: string;
};

/**
 * The timings the reset code screen counts down from.
 *
 * **These are policy constants, not this account's remaining time**, and that
 * is the whole point. `OtpChallenge` reports what is left for one specific
 * user, which is exactly the kind of per-account detail
 * `POST /auth/forgot-password` must not disclose — a shorter-than-full
 * `resendAvailableInSeconds` would confirm that a code had recently been sent
 * to that address, i.e. that the account exists. So the server returns the same
 * two figures to everyone, and they still come from the server rather than
 * being mirrored client-side, so retuning `OTP_TTL_MS` moves the UI with it.
 *
 * The cost: if a code really was sent 30 seconds ago, the resend button says 60
 * rather than 30. Pressing it early is a silent no-op that answers the same
 * way, so nothing breaks — the clock is just conservative.
 */
export type PasswordResetChallenge = {
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
};

/**
 * `POST /auth/forgot-password`, for **every** input.
 *
 * Unknown address, known-but-unverified address, and a real send all produce
 * this identical body. Signup already answers "User already exists", so account
 * enumeration is not fully closed in this app — but that is a reason to stop
 * widening it, not a licence to add a second, quieter oracle. Password reset is
 * the more sensitive of the two: signup's disclosure at least costs the
 * attacker an attempt at taking the address.
 *
 * `emailSent` is absent for the same reason, and so is any hint about
 * verification state. A user whose account is unverified sees this response and
 * is pointed at the signup verification flow by the client's copy, which says
 * so for everyone rather than only for them.
 */
export type ForgotPasswordResponse = {
  status: 'if_account_exists_code_sent';
  challenge: PasswordResetChallenge;
};

/**
 * `POST /auth/verify-reset-otp`.
 *
 * `resetToken` is a JWT signed with the same secret as a session token but is
 * **not one**: it carries `purpose: 'password_reset'`, expires in minutes
 * rather than days, and is returned in the body instead of being set as a
 * cookie — precisely so it cannot be mistaken for, or used as, a session. The
 * guard reads sessions from the cookie only, so this token authenticates
 * nothing but the one request it was minted for.
 */
export type VerifyResetOtpResponse = {
  status: 'reset_token_issued';
  resetToken: string;
  /** How long the client has to submit the new password. */
  expiresInSeconds: number;
};

/** `POST /auth/reset-password`. No session, no cookie — go and sign in. */
export type ResetPasswordResponse = {
  status: 'password_updated';
};
