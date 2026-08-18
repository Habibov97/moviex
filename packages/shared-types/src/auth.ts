import { z } from 'zod';

/**
 * Single source of truth for auth validation, shared between `apps/api` and
 * `apps/web`. The UI (password strength meter included) derives its rules from
 * these schemas rather than re-implementing them.
 */

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 50;
export const PASSWORD_MIN_LENGTH = 8;

export const nameSchema = z
  .string()
  .trim()
  .min(NAME_MIN_LENGTH, `Ad ən azı ${NAME_MIN_LENGTH} simvol olmalıdır`)
  .max(NAME_MAX_LENGTH, `Ad ${NAME_MAX_LENGTH} simvoldan uzun ola bilməz`);

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'E-poçt ünvanını daxil et')
  .pipe(z.email('Düzgün e-poçt ünvanı daxil et'));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Şifrə ən azı ${PASSWORD_MIN_LENGTH} simvol olmalıdır`);

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
    confirmPassword: z.string().min(1, 'Şifrəni təkrar daxil et'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Şifrələr uyğun gəlmir',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
