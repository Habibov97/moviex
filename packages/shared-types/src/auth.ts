import { z } from 'zod';

/**
 * Single source of truth for auth validation, shared between `apps/api` and
 * `apps/web`. The UI (password strength meter included) derives its rules from
 * these schemas rather than re-implementing them.
 *
 * **Each `message` is a message *key*, not English text.** The rule lives here
 * so both apps agree on it; the wording lives in
 * `apps/web/messages/{en,tr,ru}.json` under `auth.validation`, like every other
 * string in the UI. `LoginRegisterModal` runs each key through `t()` with the
 * length constants below as parameters, so "at least 8 characters" is written
 * once per language rather than once per schema.
 */

/** The `auth.validation.*` keys these schemas can produce. */
export const AUTH_VALIDATION_KEYS = [
  'nameTooShort',
  'nameTooLong',
  'emailRequired',
  'emailInvalid',
  'passwordTooShort',
  'confirmRequired',
  'passwordsDoNotMatch',
] as const;

export type AuthValidationKey = (typeof AUTH_VALIDATION_KEYS)[number];

/** Matches `RegisterDto`'s `@MinLength(4)` on `userName`; if these drift, a
 *  name passes client validation and then 400s server-side. */
export const NAME_MIN_LENGTH = 4;
export const NAME_MAX_LENGTH = 50;
export const PASSWORD_MIN_LENGTH = 8;

export const nameSchema = z
  .string()
  .trim()
  .min(NAME_MIN_LENGTH, 'nameTooShort' satisfies AuthValidationKey)
  .max(NAME_MAX_LENGTH, 'nameTooLong' satisfies AuthValidationKey);

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'emailRequired' satisfies AuthValidationKey)
  .pipe(z.email('emailInvalid' satisfies AuthValidationKey));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'passwordTooShort' satisfies AuthValidationKey);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  rememberMe: z.boolean(),
});

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z
      .string()
      .min(1, 'confirmRequired' satisfies AuthValidationKey),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'passwordsDoNotMatch' satisfies AuthValidationKey,
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
