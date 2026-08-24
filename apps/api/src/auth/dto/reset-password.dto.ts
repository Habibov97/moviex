import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

/**
 * **A hand-kept mirror of `passwordSchema` in `@moviex/shared-types`, exactly
 * like `RegisterDto`'s copy — edit all three together.**
 *
 * The package ships raw `.ts` that Node refuses to parse at runtime, so the API
 * may import its *types* but never its values; the zod schema stays the source
 * of truth for what the rules *are* and this is the server-side enforcement of
 * them. `RegisterDto` and this file having separate copies is not ideal, and it
 * is the direct consequence of that constraint — the alternative would be a
 * shared base DTO in `apps/api`, which is a reasonable follow-up but does not
 * remove the mirror, only the duplication of it.
 *
 * Applying the *choosing* policy here rather than the *entering* one is the
 * whole point: this is a new password, so it must clear the same bar signup
 * sets. A reset that accepted a weaker password would be a documented way
 * around the policy.
 */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_UPPERCASE_PATTERN = /[A-Z]/;
const PASSWORD_SPECIAL_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export class ResetPasswordDto {
  /**
   * The token from `POST /auth/verify-reset-otp`.
   *
   * Only checked for being a non-empty string here — whether it is genuine,
   * unexpired and signed for this purpose is a signature question, and belongs
   * in the service with the secret, not in a validation decorator.
   */
  @IsString()
  @MinLength(1, { message: 'A reset token is required' })
  @ApiProperty({
    required: true,
    description:
      'The short-lived token returned by `POST /auth/verify-reset-otp`. Not a ' +
      'session token: it is never accepted as the `access_token` cookie.',
  })
  resetToken!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  @Matches(PASSWORD_UPPERCASE_PATTERN, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(PASSWORD_SPECIAL_PATTERN, {
    message: 'Password must contain at least one special character',
  })
  @ApiProperty({
    required: true,
    description:
      'At least 8 characters, including one uppercase letter and one special ' +
      'character — the same policy `POST /auth/signup` applies.',
    example: 'Passw0rd!',
  })
  newPassword!: string;
}
