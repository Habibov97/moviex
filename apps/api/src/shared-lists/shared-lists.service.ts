import { randomBytes } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SharedList } from '@moviex/shared-types';

import { UserEntity } from 'src/entity/user.entity';
import { UserMovieEntity } from 'src/entity/user-movie.entity';

/**
 * 16 bytes = 128 bits, encoded base64url → exactly 22 URL-safe characters.
 * Far beyond guessing or enumeration, which matters because possession of the
 * link is the *only* permission check on the public route.
 */
const TOKEN_BYTES = 16;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

@Injectable()
export class SharedListsService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserMovieEntity)
    private readonly userMovieRepository: Repository<UserMovieEntity>,
  ) {}

  /** The caller's current token, or `null` while their list is not shared. */
  async getToken(userId: number): Promise<string | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      // `listShareToken` is `select: false` on the entity, so ask for it.
      select: { id: true, listShareToken: true },
    });
    return user?.listShareToken ?? null;
  }

  /**
   * Idempotent: returns the existing token if there is one. A double-clicked
   * "Create link" must not mint two links and silently kill the first one
   * someone may already have copied.
   */
  async enable(userId: number): Promise<string> {
    const existing = await this.getToken(userId);
    if (existing) return existing;

    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    await this.userRepository.update({ id: userId }, { listShareToken: token });
    return token;
  }

  /**
   * Revokes the link. The old token is gone for good — sharing again mints a
   * new one — so a link someone forwarded further than intended stays dead.
   */
  async disable(userId: number): Promise<void> {
    await this.userRepository.update({ id: userId }, { listShareToken: null });
  }

  /**
   * The public view of a shared list.
   *
   * **Every failure is the same 404** — malformed token, unknown token, and a
   * revoked one. Distinguishing them would only describe the token back to
   * whoever is probing it; the visitor's next step is the same in each case.
   *
   * Exposes `userName` and the list, nothing else — no email, no ids. The
   * select lists below are the allow-list.
   */
  async getPublicList(token: string): Promise<SharedList> {
    if (!TOKEN_PATTERN.test(token)) throw this.notFound();

    const owner = await this.userRepository.findOne({
      where: { listShareToken: token },
      select: { id: true, userName: true },
    });
    if (!owner) throw this.notFound();

    const rows = await this.userMovieRepository.find({
      where: { userId: owner.id },
      select: {
        tmdbId: true,
        status: true,
        title: true,
        posterUrl: true,
        releaseYear: true,
        primaryGenreId: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' },
    });

    return {
      userName: owner.userName,
      movies: rows.map((row) => ({
        tmdbId: row.tmdbId,
        status: row.status,
        title: row.title,
        posterUrl: row.posterUrl,
        releaseYear: row.releaseYear,
        primaryGenreId: row.primaryGenreId,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private notFound() {
    return new NotFoundException('Shared list not found');
  }
}
