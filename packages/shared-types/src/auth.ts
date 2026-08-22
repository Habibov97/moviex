import { z } from 'zod';

/**
 * Single source of truth for auth validation, shared between `apps/api` and
 * `apps/web`. The UI (password strength meter included) derives its rules from
 * these schemas rather than re-implementing them.
 */

/** Matches `RegisterDto`'s `@MinLength(4)` on `userName`; if these drift, a
 *  name passes client validation and then 400s server-side. */
export const NAME_MIN_LENGTH = 4;
export const NAME_MAX_LENGTH = 50;
export const PASSWORD_MIN_LENGTH = 8;

export const nameSchema = z
  .string()
  .trim()
  .min(NAME_MIN_LENGTH, `Name must be at least ${NAME_MIN_LENGTH} characters`)
  .max(NAME_MAX_LENGTH, `Name must be ${NAME_MAX_LENGTH} characters or fewer`);

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .pipe(z.email('Enter a valid email address'));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);

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
    confirmPassword: z.string().min(1, 'Re-enter your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
