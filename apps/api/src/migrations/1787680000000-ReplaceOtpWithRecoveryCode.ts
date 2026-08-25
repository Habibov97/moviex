import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the emailed-OTP system with a recovery code.
 *
 * The OTP flow depended on outbound SMTP, which the deployment host blocks at
 * the network level — so no code this app generated could ever reach a user.
 * Every column that existed to run that flow goes, and one column arrives to
 * run its replacement.
 *
 * **`isEmailVerified` is dropped, not preserved.** It was the login gate, and
 * the only thing that could ever flip it was entering an emailed code. With no
 * email there is no way to verify an address and nothing left for the flag to
 * mean: keeping it would leave every new account permanently locked out by a
 * gate with no key. `AuthService.login` no longer reads it.
 *
 * **`recoveryCodeHash` is nullable purely for rows that predate this
 * migration.** There is deliberately **no backfill**, and this is the opposite
 * choice from `AddEmailVerification`, which backfilled `isEmailVerified = true`
 * so existing accounts were not locked out. The difference is that a recovery
 * code cannot be invented on a user's behalf — the whole security property is
 * that exactly one person has ever seen it, and a value generated here would be
 * one nobody has. Pre-migration accounts are being **deleted manually** rather
 * than migrated; they cannot reset a password and there is no honest way to
 * give them one.
 *
 * **Irreversible in practice.** `down()` restores the columns so the schema can
 * be walked back, but every OTP value in them is gone and `isEmailVerified`
 * comes back defaulted to `true` — matching what the old backfill did, so a
 * rollback does not lock existing accounts out of a gate this migration removed.
 */
export class ReplaceOtpWithRecoveryCode1787680000000 implements MigrationInterface {
  name = 'ReplaceOtpWithRecoveryCode1787680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "recoveryCodeHash" character varying`,
    );

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otpPurpose"`);
    await queryRunner.query(`DROP TYPE "public"."users_otppurpose_enum"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otpLastSentAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otpAttempts"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otpExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otpCode"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "isEmailVerified"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // `true`, not the entity's `false` default: this mirrors the backfill in
    // `AddEmailVerification`. Rolling back must not leave every account
    // failing a login check whose only remedy was an email that cannot be sent.
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isEmailVerified" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "otpCode" character varying(8)`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "otpExpiresAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "otpAttempts" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "otpLastSentAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_otppurpose_enum" AS ENUM('email_verification', 'password_reset')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "otpPurpose" "public"."users_otppurpose_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "recoveryCodeHash"`,
    );
  }
}
