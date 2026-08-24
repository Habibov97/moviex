import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';

/**
 * Mirrors `verifyResetOtpSchema` in `@moviex/shared-types`, and is structurally
 * identical to `VerifyOtpDto` — same two fields, same four-digit rule.
 *
 * It is a separate class rather than a reuse of that one because the two are
 * only *currently* the same shape: they answer different endpoints with
 * different purposes attached, and collapsing them would mean a later change to
 * one silently changing the other. The four digits are a string so a leading
 * zero survives (`0421` is a code, `421` is not the same thing).
 */
const OTP_CODE_PATTERN = /^\d{4}$/;

export class VerifyResetOtpDto {
  @IsEmail()
  @ApiProperty({ required: true, example: 'user@moviex.dev' })
  email!: string;

  @IsString()
  @Matches(OTP_CODE_PATTERN, {
    message: 'Code must be 4 digits',
  })
  @ApiProperty({
    required: true,
    description: 'The 4-digit code from the password-reset email.',
    example: '4821',
  })
  code!: string;
}
