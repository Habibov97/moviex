import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { JwtPayload } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UserMoviesService } from './user-movies.service';
import {
  AddUserMovieDto,
  ListUserMoviesQueryDto,
  MovieStatusQueryDto,
  UpdateUserMovieStatusDto,
  UserMovieResponseDto,
  UserMovieStatusEntryDto,
} from './dto/user-movie.dto';

/** Every route is the caller's own list — `userId` always comes from the token. */
@ApiTags('user-movies')
@ApiCookieAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('user-movies')
export class UserMoviesController {
  constructor(private readonly userMoviesService: UserMoviesService) {}

  @Get()
  @ApiOperation({
    summary: "List the caller's saved movies",
    description:
      'Newest-updated first. Optionally filtered by status. Backs the future "My List" page.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['watchlist', 'watched'],
  })
  @ApiResponse({ status: 200, type: [UserMovieResponseDto] })
  @ApiResponse({ status: 401, description: 'Not signed in.' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListUserMoviesQueryDto,
  ) {
    return this.userMoviesService.list(user.sub, query.status);
  }

  /**
   * Declared before `:tmdbId`-style routes would matter — `status` is a fixed
   * segment on a different verb here, but keeping it above the parameterised
   * routes matches the ordering rule the TMDB controller had to learn.
   */
  @Get('status')
  @ApiOperation({
    summary: 'Batch status lookup',
    description:
      'Given the ids currently on screen, returns an entry for each one the ' +
      'caller has saved. Ids with no entry are **omitted** rather than ' +
      'returned as null — the client reads "absent" as "not in list". One ' +
      'request per grid instead of one per card.',
  })
  @ApiQuery({
    name: 'tmdbIds',
    required: true,
    type: String,
    example: '693134,335984',
  })
  @ApiResponse({ status: 200, type: [UserMovieStatusEntryDto] })
  @ApiResponse({ status: 400, description: 'No valid ids supplied.' })
  statuses(
    @CurrentUser() user: JwtPayload,
    @Query() query: MovieStatusQueryDto,
  ) {
    const tmdbIds = query.tmdbIds
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (tmdbIds.length === 0) {
      throw new BadRequestException('tmdbIds must contain at least one id');
    }

    return this.userMoviesService.statusesFor(user.sub, tmdbIds);
  }

  @Post()
  @ApiOperation({
    summary: 'Save a movie (idempotent)',
    description:
      'Creates the entry, or updates status and the denormalised snapshot if ' +
      'the caller already has this movie. Re-adding is not an error, so a ' +
      'double-clicked button never 409s.',
  })
  @ApiResponse({ status: 201, type: UserMovieResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid body.' })
  @ApiResponse({ status: 401, description: 'Not signed in.' })
  add(@CurrentUser() user: JwtPayload, @Body() dto: AddUserMovieDto) {
    return this.userMoviesService.add(user.sub, dto);
  }

  @Patch(':tmdbId')
  @ApiOperation({
    summary: 'Change status of an existing entry',
    description:
      'Stamps `watchedAt` on the way into `watched` and clears it on the way ' +
      'back. 404 when nothing is saved — use POST to create.',
  })
  @ApiParam({ name: 'tmdbId', type: Number, example: 693134 })
  @ApiResponse({ status: 200, type: UserMovieResponseDto })
  @ApiResponse({ status: 404, description: 'No saved entry for that movie.' })
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Body() dto: UpdateUserMovieStatusDto,
  ) {
    return this.userMoviesService.updateStatus(user.sub, tmdbId, dto);
  }

  @Delete(':tmdbId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a movie from the caller’s list' })
  @ApiParam({ name: 'tmdbId', type: Number, example: 693134 })
  @ApiResponse({ status: 204, description: 'Removed.' })
  @ApiResponse({ status: 404, description: 'No saved entry for that movie.' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
  ) {
    return this.userMoviesService.remove(user.sub, tmdbId);
  }
}
