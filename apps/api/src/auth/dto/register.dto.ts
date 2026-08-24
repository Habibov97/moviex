import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

/**
 * **These rules are a hand-kept mirror of `passwordSchema` / `nameSchema` in
 * `@moviex/shared-types`, and must be edited in step with them.**
 *
 * They are not imported, and cannot be: that package ships raw `.ts`, which
 * Node refuses to parse at runtime (`node dist/main` dies on the type syntax),
 * so `apps/api` may import *types* from it but never values. The zod schema
 * stays the source of truth for what the rules *are*; this file is the
 * server-side enforcement of the same rules, because a browser is not the only
 * thing that can POST here.
 *
 * They had already drifted once before this comment existed — the schema said 8
 * characters while this said 6, so any non-browser caller could create an
 * account with a password the UI would have refused.
 */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_UPPERCASE_PATTERN = /[A-Z]/;
const PASSWORD_SPECIAL_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

const USERNAME_MIN_LENGTH = 4;

export class RegisterDto {
  @IsString()
  @MinLength(USERNAME_MIN_LENGTH, {
    message: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
  })
  @ApiProperty({ required: true })
  userName!: string;

  @IsEmail()
  @ApiProperty({ required: true })
  email!: string;

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
      'At least 8 characters, including one uppercase letter and one special character.',
    example: 'Passw0rd!',
  })
  password!: string;
}
