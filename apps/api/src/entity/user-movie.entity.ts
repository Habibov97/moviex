import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { UserEntity } from './user.entity';

export enum UserMovieStatusEnum {
  WATCHLIST = 'watchlist',
  WATCHED = 'watched',
}

/**
 * One movie saved by one user.
 *
 * `title` / `posterUrl` / `releaseYear` are a **denormalised snapshot** of the
 * card the user acted on. The client already holds them at that moment, so
 * storing them means saving costs no TMDB round trip, and "My List" can render
 * from our own database rather than re-fetching TMDB once per saved row. The
 * trade-off is accepted: a retitled or re-postered film keeps the values as of
 * when it was saved until something refreshes them.
 */
@Entity('user_movies')
// A user cannot hold the same film twice; `POST` upserts against this.
@Unique('UQ_user_movies_user_tmdb', ['userId', 'tmdbId'])
// The batch status lookup filters on exactly this pair.
@Index('IDX_user_movies_user_status', ['userId', 'status'])
export class UserMovieEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Integer, matching `users.id` (`PrimaryGeneratedColumn('increment')`). */
  @Column({ type: 'int' })
  userId!: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'int' })
  tmdbId!: number;

  @Column({
    type: 'enum',
    enum: UserMovieStatusEnum,
    default: UserMovieStatusEnum.WATCHLIST,
  })
  status!: UserMovieStatusEnum;

  @Column()
  title!: string;

  @Column({ type: 'varchar', nullable: true })
  posterUrl!: string | null;

  /** Four-digit year as text, mirroring `MovieSummary.releaseYear`. */
  @Column({ type: 'varchar', length: 4, nullable: true })
  releaseYear!: string | null;

  /**
   * TMDB genre id of the movie's primary genre — one id, not a list. Enough to
   * tally a "top genre" on My List without a relation table or a TMDB call.
   *
   * **Explicitly not part of the snapshot above, and that is the point.** An id
   * carries no language, so My List resolves it to a word at render time from
   * the genre list the page already has. Storing the resolved *name* is what
   * this replaced: it froze in whatever language the user happened to be
   * browsing in, so a film saved in Russian still read "Мультфильм" after
   * switching the site to English.
   *
   * Null for rows saved before this column existed. They contribute nothing to
   * the tally until re-saved — the old name cannot be mapped back to an id,
   * because it could be in any of the three languages.
   */
  @Column({ type: 'int', nullable: true })
  primaryGenreId!: number | null;

  /**
   * @deprecated The resolved genre name at save time. Superseded by
   * `primaryGenreId`; **nothing reads this** and the client no longer sends it,
   * so it nulls out on the next write to a row. Kept only so the fix needed no
   * destructive migration — safe to drop in a later, deliberate one.
   */
  @Column({ type: 'varchar', length: 60, nullable: true })
  primaryGenre!: string | null;

  /** Set when status becomes `watched`, cleared on the way back. */
  @Column({ type: 'timestamp', nullable: true })
  watchedAt!: Date | null;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt!: Date;
}
