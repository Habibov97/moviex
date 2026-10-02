import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `users.listShareToken`: the secret behind a user's public list link.
 *
 * Nullable — `null` means "not shared", which is every existing account until
 * its owner chooses to share, so there is nothing to backfill. The unique
 * constraint is named to match `@Unique('UQ_users_list_share_token', …)` on
 * the entity; Postgres allows any number of NULLs under it.
 *
 * Purely additive, so `down()` loses only share links, never list data.
 */
export class AddListShareToken1790935200000 implements MigrationInterface {
  name = 'AddListShareToken1790935200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "listShareToken" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_list_share_token" UNIQUE ("listShareToken")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_users_list_share_token"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "listShareToken"`);
  }
}
