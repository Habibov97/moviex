import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Email verification: the `isEmailVerified` gate plus the fields that run the
 * one-time-code flow.
 *
 * **The backfill below is not optional.** `isEmailVerified` defaults to `false`
 * because that is right for every account created from here on, but applying
 * that default to rows that already exist would mean every current user fails
 * `AuthService.login`'s new check and is locked out of their own account, with
 * no way back in: the only route to verified is a code emailed by signup, and
 * signup refuses an address that is already registered. Those accounts predate
 * the requirement, so they are grandfathered in.
 *
 * The `UPDATE` is safe to run exactly once, here, because at this moment no row
 * can legitimately be unverified — the column did not exist a statement ago.
 */
export class AddEmailVerification1787498626807 implements MigrationInterface {
    name = 'AddEmailVerification1787498626807'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "isEmailVerified" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD "otpCode" character varying(8)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "otpExpiresAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "otpAttempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "otpLastSentAt" TIMESTAMP`);

        // Grandfather every pre-existing account. See the note above.
        await queryRunner.query(`UPDATE "users" SET "isEmailVerified" = true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otpLastSentAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otpAttempts"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otpExpiresAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otpCode"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isEmailVerified"`);
    }

}
