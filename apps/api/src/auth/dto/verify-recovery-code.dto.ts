import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';

/**
 * Mirrors `verifyRecoveryCodeSchema` in `@moviex/shared-types`.
 *
 * The pattern is restated by hand for the usual reason — the API may import
 * types from that package but never values — so the alphabet appears here and
 * in `recovery.constants.ts` and in the shared schema. Edit them together: a
 * mismatch means a code the server generated fails its own validation.
 */
const RECOVERY_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

export class VerifyRecoveryCodeDto {
  @IsEmail()
  @ApiProperty({ required: true, example: 'user@moviex.dev' })
  email!: string;

  @IsString()
  @Matches(RECOVERY_CODE_PATTERN, {
    /*
     * The only field message in this flow that describes the *format* rather
     * than the outcome. It is safe because it says nothing about the account:
     * a malformed code is rejected before any lookup happens, so this cannot
     * be used to distinguish a real address from an unknown one.
     */
    message: 'Recovery code must be 6 letters',
  })
  @ApiProperty({
    required: true,
    description:
      'The 6-character code shown once at signup. Uppercase letters only, ' +
      'excluding I, O and L.',
    example: 'HBKMNP',
  })
  recoveryCode!: string;
}
