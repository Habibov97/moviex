import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { JwtPayload } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
} from './auth.constants';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({
    summary: 'Create an account',
    description:
      'Does not issue a token — sign in through POST /auth/login afterwards.',
  })
  @ApiResponse({ status: 201, description: 'User created.' })
  @ApiResponse({ status: 404, description: 'Email or username already taken.' })
  signUp(@Body() dto: RegisterDto) {
    return this.authService.signUp(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in',
    description:
      'On success the access token is set as an httpOnly `access_token` cookie. ' +
      'It is deliberately absent from the response body — client JavaScript ' +
      'never sees the raw token. The browser attaches it to subsequent requests ' +
      'automatically, so no Authorization header is needed.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Signed in. Sets the httpOnly `access_token` cookie; the body carries the user only, with no token field.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            email: { type: 'string', example: 'user@moviex.dev' },
            userName: { type: 'string', example: 'najaf' },
            role: { type: 'string', example: 'user' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(
    @Body() dto: LoginDto,
    // passthrough: Nest still serialises the returned object; we only reach for
    // `res` to set the cookie, not to send the response ourselves.
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, expiresInMs } =
      await this.authService.login(dto);

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...accessTokenCookieOptions(),
      maxAge: expiresInMs,
    });

    return { status: 'success', user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign out',
    description:
      'Clears the `access_token` cookie. The token itself is not revoked — ' +
      'there is no server-side session or denylist — so it stays valid until ' +
      'its own expiry; this only removes the browser copy.',
  })
  @ApiResponse({
    status: 200,
    description: 'Signed out and cookie cleared.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Logged out successfully' },
      },
    },
  })
  logout(@Res({ passthrough: true }) res: Response) {
    // Same attributes as when it was set, or the browser scopes this to a
    // different cookie and the original survives.
    res.clearCookie(ACCESS_TOKEN_COOKIE, accessTokenCookieOptions());

    return { status: 'success', message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access-token')
  @ApiOperation({
    summary: 'Current user',
    description:
      'Authenticated by the `access_token` cookie, which the browser sends automatically.',
  })
  @ApiResponse({
    status: 200,
    description: 'The decoded token payload for the signed-in user.',
    schema: {
      type: 'object',
      properties: {
        sub: { type: 'number', example: 1 },
        email: { type: 'string', example: 'user@moviex.dev' },
        iat: { type: 'number', example: 1786973312 },
        exp: { type: 'number', example: 1787059712 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing, invalid or expired cookie.' })
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
