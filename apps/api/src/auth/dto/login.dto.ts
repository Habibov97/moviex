import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Sign-in, not sign-up — so the password rules here are deliberately **not**
 * `RegisterDto`'s.
 *
 * Applying the new-password policy at login would lock every account created
 * before that policy out of its own login form. The `@MinLength(6)` below is
 * the floor accounts were created under and is left as-is for the same reason:
 * raising it would reject a password that is genuinely correct. Whether the
 * credentials match is the service's answer to give, not the validator's.
 */
export class LoginDto {
  @IsEmail()
  @ApiProperty({ required: true })
  email!: string;

  @IsString()
  @MinLength(6, {
    message: 'Password must be at least 6 characters',
  })
  @ApiProperty({ required: true })
  password!: string;

  /**
   * Opts this session into the long expiry. Optional, and **absent means
   * `false`** — the short session stays the default for any caller that does
   * not ask, which is what keeps existing clients unaffected.
   *
   * It reaches the wire now. It previously did not: the field existed only in
   * the client's form state, and the global `forbidNonWhitelisted` rejected it
   * with `400 "property rememberMe should not exist"` if anything sent it.
   */
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    default: false,
    description:
      'Lengthens this session (JWT expiry and cookie maxAge together). ' +
      'Omitted or false gives the normal short session.',
  })
  rememberMe?: boolean;
}
