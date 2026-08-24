import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/**
 * Mirrors `forgotPasswordSchema` in `@moviex/shared-types` — restated rather
 * than imported for the usual reason (that package ships raw `.ts` Node cannot
 * parse at runtime, so the API may import its types but never its values).
 *
 * Nothing but the address: this endpoint deliberately has no way to say which
 * account it is for beyond the email, and no field whose presence could change
 * what it answers.
 */
export class ForgotPasswordDto {
  @IsEmail()
  @ApiProperty({ required: true, example: 'user@moviex.dev' })
  email!: string;
}
