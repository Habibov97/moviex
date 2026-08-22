import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import {
  UserMovieEntity,
  UserMovieStatusEnum,
} from 'src/entity/user-movie.entity';
import {
  AddUserMovieDto,
  UpdateUserMovieStatusDto,
} from './dto/user-movie.dto';

@Injectable()
export class UserMoviesService {
  constructor(
    @InjectRepository(UserMovieEntity)
    private readonly userMovieRepository: Repository<UserMovieEntity>,
  ) {}

  /**
   * Adds a movie, or updates it if the user already has it.
   *
   * Deliberately idempotent rather than a 409: the UI's "Add" button can be
   * clicked twice, and re-adding something already saved is not a user error —
   * it just means "make sure this is in my list with this status".
   */
  async add(userId: number, dto: AddUserMovieDto): Promise<UserMovieEntity> {
    const status = dto.status ?? UserMovieStatusEnum.WATCHLIST;
    const existing = await this.find(userId, dto.tmdbId);

    const entity =
      existing ??
      this.userMovieRepository.create({ userId, tmdbId: dto.tmdbId });

    entity.status = status;
    // The snapshot is refreshed on every write, so re-adding an entry saved
    // long ago picks up a corrected title or a newly available poster.
    entity.title = dto.title;
    entity.posterUrl = dto.posterUrl ?? null;
    entity.releaseYear = dto.releaseYear ?? null;
    entity.primaryGenre = dto.primaryGenre ?? null;
    entity.watchedAt = this.watchedAtFor(status, entity.watchedAt ?? null);

    return this.userMovieRepository.save(entity);
  }

  /** 404 when the user has no entry — `POST` is what creates one. */
  async updateStatus(
    userId: number,
    tmdbId: number,
    dto: UpdateUserMovieStatusDto,
  ): Promise<UserMovieEntity> {
    const entity = await this.requireEntry(userId, tmdbId);

    entity.status = dto.status;
    entity.watchedAt = this.watchedAtFor(dto.status, entity.watchedAt);

    return this.userMovieRepository.save(entity);
  }

  async remove(userId: number, tmdbId: number): Promise<void> {
    const entity = await this.requireEntry(userId, tmdbId);
    await this.userMovieRepository.remove(entity);
  }

  list(
    userId: number,
    status?: UserMovieStatusEnum,
  ): Promise<UserMovieEntity[]> {
    return this.userMovieRepository.find({
      where: status ? { userId, status } : { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * Batch status lookup for the ids currently on screen.
   *
   * One query for a whole grid instead of one per card. Movies the user has no
   * entry for are simply absent from the result — the client treats "missing"
   * as "not in list", so there is nothing to encode for them.
   */
  async statusesFor(
    userId: number,
    tmdbIds: number[],
  ): Promise<{ tmdbId: number; status: UserMovieStatusEnum }[]> {
    if (tmdbIds.length === 0) return [];

    const rows = await this.userMovieRepository.find({
      where: { userId, tmdbId: In(tmdbIds) },
      select: { tmdbId: true, status: true },
    });

    return rows.map((row) => ({ tmdbId: row.tmdbId, status: row.status }));
  }

  private async find(
    userId: number,
    tmdbId: number,
  ): Promise<UserMovieEntity | null> {
    return this.userMovieRepository.findOne({ where: { userId, tmdbId } });
  }

  private async requireEntry(
    userId: number,
    tmdbId: number,
  ): Promise<UserMovieEntity> {
    const entity = await this.find(userId, tmdbId);

    if (!entity) {
      throw new NotFoundException(`No saved entry for movie ${tmdbId}`);
    }

    return entity;
  }

  /**
   * `watchedAt` tracks the status transition: stamped on the way into
   * `watched`, cleared on the way back out. An existing timestamp is preserved
   * so re-saving a watched entry does not move the date the user actually
   * watched it.
   */
  private watchedAtFor(
    status: UserMovieStatusEnum,
    current: Date | null,
  ): Date | null {
    if (status !== UserMovieStatusEnum.WATCHED) return null;
    return current ?? new Date();
  }
}
