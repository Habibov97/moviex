import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * `otpPurpose`: what the code currently sitting in `otpCode` is for.
 *
 * Password reset reuses the four `otp*` columns email verification already
 * added, because one account is only ever part-way through one of those flows
 * at a time. Sharing the storage is only safe with this column beside it — it
 * is what stops a code emailed to verify an address from also being spendable
 * at `POST /auth/verify-reset-otp`, which would quietly turn "confirm your
 * email" into "reset this account's password".
 *
 * **The backfill matters for the same reason the last migration's did**, though
 * it is much narrower: `otpPurpose` is nullable and null in every existing row,
 * and both verify endpoints reject a code whose purpose is not the one they
 * handle. Any account holding a live verification code at the moment this runs
 * would therefore find it rejected as invalid — recoverable via Resend, but a
 * confusing dead end for someone who has the email open in front of them. Rows
 * with no outstanding code are deliberately left null: there is nothing there
 * to describe, and inventing a purpose for an absent code would be noise.
 */
export class AddOtpPurpose1787572800000 implements MigrationInterface {
    name = 'AddOtpPurpose1787572800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_otppurpose_enum" AS ENUM('email_verification', 'password_reset')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "otpPurpose" "public"."users_otppurpose_enum"`);

        // Every code outstanding right now predates password reset, so it can
        // only ever have been an email-verification code. See the note above.
        await queryRunner.query(`UPDATE "users" SET "otpPurpose" = 'email_verification' WHERE "otpCode" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otpPurpose"`);
        await queryRunner.query(`DROP TYPE "public"."users_otppurpose_enum"`);
    }

}
