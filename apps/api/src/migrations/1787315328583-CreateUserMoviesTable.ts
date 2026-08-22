import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserMoviesTable1787315328583 implements MigrationInterface {
    name = 'CreateUserMoviesTable1787315328583'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_movies_status_enum" AS ENUM('watchlist', 'watched')`);
        await queryRunner.query(`CREATE TABLE "user_movies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" integer NOT NULL, "tmdbId" integer NOT NULL, "status" "public"."user_movies_status_enum" NOT NULL DEFAULT 'watchlist', "title" character varying NOT NULL, "posterUrl" character varying, "releaseYear" character varying(4), "primaryGenre" character varying(60), "watchedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, "updatedAt" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone, CONSTRAINT "UQ_user_movies_user_tmdb" UNIQUE ("userId", "tmdbId"), CONSTRAINT "PK_907a29c02ccac473d188dad7fb7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_user_movies_user_status" ON "user_movies"  ("userId", "status") `);
        await queryRunner.query(`ALTER TABLE "user_movies" ADD CONSTRAINT "FK_149d8bac146ea70af063a84e5dd" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_movies" DROP CONSTRAINT "FK_149d8bac146ea70af063a84e5dd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_movies_user_status"`);
        await queryRunner.query(`DROP TABLE "user_movies"`);
        await queryRunner.query(`DROP TYPE "public"."user_movies_status_enum"`);
    }

}
