import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * `primaryGenreId`: the TMDB genre id behind My List's "top genre" stat.
 *
 * It replaces `primaryGenre`, which stored the resolved genre *name*. A name is
 * language-specific, so the stat froze in whatever language the user was
 * browsing when they saved the film — save something in Russian and the stat
 * still read "Мультфильм" after switching the site to English. An id carries no
 * language, so the name is now resolved at render time against the genre list
 * the page already fetches for the active locale.
 *
 * **No backfill, deliberately.** The old column cannot be mapped back to an id:
 * its values are in whichever of the three languages each row was saved under,
 * so recovering them would mean fuzzy-matching names across three locales'
 * genre lists to guess an id. Pre-existing rows therefore contribute nothing to
 * the tally until they are re-saved, which is the same "missing data is not
 * counted" treatment null ratings already get elsewhere in this app — and every
 * `POST /user-movies` rewrites the row, so normal use repairs them.
 *
 * **`primaryGenre` is kept, not dropped.** Nothing reads it, and leaving it
 * costs one nullable column; dropping it is destructive and would make this
 * migration irreversible in practice. A later, deliberate migration can remove
 * it once no deployed client sends it.
 */
export class AddPrimaryGenreId1787594400000 implements MigrationInterface {
    name = 'AddPrimaryGenreId1787594400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_movies" ADD "primaryGenreId" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_movies" DROP COLUMN "primaryGenreId"`);
    }

}
