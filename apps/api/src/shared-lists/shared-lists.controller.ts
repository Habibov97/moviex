import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { SharedList } from '@moviex/shared-types';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { JwtPayload } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SharedListsService } from './shared-lists.service';
import { ListShareDto, SharedListDto } from './dto/shared-list.dto';

/**
 * The owner's side: turn sharing on, read the link, turn it off.
 *
 * Its own path rather than `/user-movies/share`, because `UserMoviesController`
 * has `DELETE /user-movies/:tmdbId` behind a `ParseIntPipe` — a fixed `share`
 * segment there would depend on declaration order to avoid a 400.
 */
@ApiTags('shared-lists')
@ApiCookieAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('list-share')
export class ListShareController {
  constructor(private readonly sharedListsService: SharedListsService) {}

  @Get()
  @ApiOperation({ summary: "The caller's share link token, or null" })
  @ApiResponse({ status: 200, type: ListShareDto })
  @ApiResponse({ status: 401, description: 'Not signed in.' })
  async get(@CurrentUser() user: JwtPayload): Promise<ListShareDto> {
    return { token: await this.sharedListsService.getToken(user.sub) };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Share the caller’s list (idempotent)',
    description:
      'Returns the existing token if the list is already shared, so a ' +
      'repeated call never invalidates a link someone has copied.',
  })
  @ApiResponse({ status: 200, type: ListShareDto })
  @ApiResponse({ status: 401, description: 'Not signed in.' })
  async enable(@CurrentUser() user: JwtPayload): Promise<ListShareDto> {
    return { token: await this.sharedListsService.enable(user.sub) };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Stop sharing',
    description:
      'The current link stops working; sharing again mints a new one.',
  })
  @ApiResponse({ status: 204, description: 'Revoked (or was not shared).' })
  @ApiResponse({ status: 401, description: 'Not signed in.' })
  disable(@CurrentUser() user: JwtPayload): Promise<void> {
    return this.sharedListsService.disable(user.sub);
  }
}

/**
 * The visitor's side. **Public — no guard**: the token in the path is the
 * whole permission check, which is why it is 128 random bits.
 */
@ApiTags('shared-lists')
@Controller('shared-lists')
export class SharedListsController {
  constructor(private readonly sharedListsService: SharedListsService) {}

  @Get(':token')
  @ApiOperation({
    summary: 'A shared list, by its link token',
    description:
      "The owner's username plus both tabs of their list. Malformed, unknown " +
      'and revoked tokens all answer the same 404.',
  })
  @ApiParam({ name: 'token', example: 'q3Zr8m1Xb0VtKp2YwLs9Ea' })
  @ApiResponse({ status: 200, type: SharedListDto })
  @ApiResponse({ status: 404, description: 'No list is shared under it.' })
  get(@Param('token') token: string): Promise<SharedList> {
    return this.sharedListsService.getPublicList(token);
  }
}
