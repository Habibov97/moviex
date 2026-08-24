import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';

/**
 * Mirrors `verifyOtpSchema` in `@moviex/shared-types` — same reason as
 * `RegisterDto`: the shared package ships raw `.ts` that Node cannot parse at
 * runtime, so the rules are restated here rather than imported. Four digits,
 * as a string, so a leading zero is not lost to numeric coercion.
 */
const OTP_CODE_PATTERN = /^\d{4}$/;

export class VerifyOtpDto {
  @IsEmail()
  @ApiProperty({ required: true, example: 'user@moviex.dev' })
  email!: string;

  @IsString()
  @Matches(OTP_CODE_PATTERN, {
    message: 'Code must be 4 digits',
  })
  @ApiProperty({
    required: true,
    description: 'The 4-digit code from the verification email.',
    example: '4821',
  })
  code!: string;
}
