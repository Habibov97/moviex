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
  'passwordNeedsUppercase',
  'passwordNeedsSpecial',
  'passwordRequired',
  'confirmRequired',
  'passwordsDoNotMatch',
] as const;

export type AuthValidationKey = (typeof AUTH_VALIDATION_KEYS)[number];

/** Matches `RegisterDto`'s `@MinLength(4)` on `userName`; if these drift, a
 *  name passes client validation and then 400s server-side. */
export const NAME_MIN_LENGTH = 4;
export const NAME_MAX_LENGTH = 50;
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Complexity rules for a **newly chosen** password.
 *
 * Exported as patterns rather than being inlined into the schema so the
 * strength meter can test the same expressions the validator does, instead of
 * keeping a second, quietly diverging copy of "what counts as a special
 * character".
 *
 * `apps/api` cannot import these — the package ships raw `.ts` that Node
 * refuses to parse, so its DTOs restate the rules with `class-validator` and
 * must be edited in step. See the note in CLAUDE.md.
 */
export const PASSWORD_UPPERCASE_PATTERN = /[A-Z]/;
export const PASSWORD_SPECIAL_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

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

/**
 * The rule for **choosing** a password: length, an uppercase letter and a
 * special character. Used by `registerSchema` and by the strength meter.
 *
 * Each check reports separately, so someone missing only a symbol is told
 * exactly that rather than being handed the whole policy again.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'passwordTooShort' satisfies AuthValidationKey)
  .regex(
    PASSWORD_UPPERCASE_PATTERN,
    'passwordNeedsUppercase' satisfies AuthValidationKey,
  )
  .regex(
    PASSWORD_SPECIAL_PATTERN,
    'passwordNeedsSpecial' satisfies AuthValidationKey,
  );

/**
 * The rule for **entering** an existing password: that there is one.
 *
 * Deliberately *not* `passwordSchema`. Sign-in must never re-apply the
 * policy a password was chosen under — every account created before these
 * complexity rules existed would fail validation in the browser and be locked
 * out of its own login form, without a request ever being sent. Whether the
 * password is right is the server's answer to give, not the form's.
 */
export const loginPasswordSchema = z
  .string()
  .min(1, 'passwordRequired' satisfies AuthValidationKey);

export const loginSchema = z.object({
  email: emailSchema,
  // Presence only — see `loginPasswordSchema`.
  password: loginPasswordSchema,
  /**
   * Opts the session into the long expiry. **Optional, defaulting to `false`**
   * so a caller that omits it gets the short session — the same rule
   * `LoginDto` applies server-side.
   *
   * Unlike every other field here this is not a validation rule, it is a
   * preference: it has no invalid value, and it now travels on the wire rather
   * than living only in the form's state.
   */
  rememberMe: z.boolean().optional().default(false),
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
