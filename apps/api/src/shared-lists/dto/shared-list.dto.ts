import { ApiProperty } from '@nestjs/swagger';
import type {
  ListShare,
  SharedList,
  SharedListMovie,
} from '@moviex/shared-types';

import { UserMovieStatusEnum } from 'src/entity/user-movie.entity';

/*
 * Response shapes only. `implements` the shared types so a drift between what
 * Swagger documents and what the web app is typed against fails to compile —
 * the same trick `GenreDto` uses.
 */

export class ListShareDto implements ListShare {
  @ApiProperty({
    nullable: true,
    example: 'q3Zr8m1Xb0VtKp2YwLs9Ea',
    description: 'The secret part of `/shared/<token>`; null when not shared.',
  })
  token!: string | null;
}

export class SharedListMovieDto implements SharedListMovie {
  @ApiProperty({ example: 693134 }) tmdbId!: number;
  @ApiProperty({ enum: UserMovieStatusEnum }) status!: UserMovieStatusEnum;
  @ApiProperty({ example: 'Dune: Part Two' }) title!: string;
  @ApiProperty({ nullable: true }) posterUrl!: string | null;
  @ApiProperty({ nullable: true, example: '2024' }) releaseYear!: string | null;
  @ApiProperty({ nullable: true, example: 878 })
  primaryGenreId!: number | null;
  @ApiProperty() createdAt!: string;
}

export class SharedListDto implements SharedList {
  @ApiProperty({ example: 'najaf' }) userName!: string;
  @ApiProperty({ type: [SharedListMovieDto] }) movies!: SharedListMovieDto[];
}
