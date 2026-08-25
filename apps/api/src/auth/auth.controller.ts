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
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import {
  LOGIN_LIMIT,
  RECOVERY_CODE_LIMIT,
  SIGNUP_LIMIT,
  THROTTLE_WINDOW_MS,
} from '../throttle.constants';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyRecoveryCodeDto } from './dto/verify-recovery-code.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { JwtPayload } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
} from './auth.constants';

/**
 * The body every endpoint that establishes a session returns. Declared once so
 * `POST /auth/login` documents the same shape signup's session does — they are
 * the same event reached two ways.
 */
const SESSION_RESPONSE_SCHEMA = {
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
} as const;

/**
 * `POST /auth/signup`'s body.
 *
 * **`recoveryCode` is the plaintext, and this response is the only place it
 * ever appears.** Only a bcrypt hash is stored, so it cannot be re-read or
 * re-sent by any later call — which is exactly what makes "save it now" a real
 * instruction rather than a suggestion.
 */
const SIGNUP_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', example: 'success' },
    user: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        email: { type: 'string', example: 'user@moviex.dev' },
        userName: { type: 'string', example: 'najaf' },
      },
    },
    recoveryCode: {
      type: 'string',
      example: 'HBKMNP',
      description:
        'Shown to the user once and never retrievable again. Do not log, ' +
        'cache or persist this value anywhere.',
    },
  },
} as const;

/**
 * Per-route rate limits, tightening the global 100/minute default from
 * `throttle.constants.ts`. Each is a full override of the `default` throttler
 * for that handler, keyed per route per IP, so these budgets are independent of
 * one another and of the rest of the API.
 *
 * The endpoint-specific reasoning lives beside each constant; what matters here
 * is that they are named rather than inlined, so the policy is readable in one
 * place instead of scattered across decorator literals.
 */
const throttleLogin = Throttle({
  default: { limit: LOGIN_LIMIT, ttl: THROTTLE_WINDOW_MS },
});
const throttleSignup = Throttle({
  default: { limit: SIGNUP_LIMIT, ttl: THROTTLE_WINDOW_MS },
});
const throttleRecoveryCode = Throttle({
  default: { limit: RECOVERY_CODE_LIMIT, ttl: THROTTLE_WINDOW_MS },
});

/**
 * Documented on every throttled route, because the body is the throttler's own
 * and not one of ours: `{ statusCode: 429, message: 'ThrottlerException: Too
 * Many Requests' }`. Deliberately left as-is — it names no account, echoes no
 * input and carries no `code`, so there is nothing in it to leak.
 */
const THROTTLED_RESPONSE = {
  status: 429,
  description:
    'IP rate limit exceeded. The body is the throttler’s generic message with ' +
    'no `code` field — distinguishable from this module’s own 429s, which ' +
    'always carry one.',
} as const;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @throttleSignup
  @ApiOperation({
    summary: 'Create an account',
    description:
      'Creates the account, generates its recovery code, and **signs the user ' +
      'in** — the session cookie is set on this response, exactly as `POST ' +
      '/auth/login` sets it. There is no verification step: the emailed-OTP ' +
      'gate this replaced is gone, so there is nothing left to wait for.\n\n' +
      '**The `recoveryCode` in the body is plaintext and is never retrievable ' +
      'again.** Only its bcrypt hash is stored. It is the only way to reset a ' +
      'forgotten password, and a user who loses both is permanently locked out.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Account created and signed in. Sets the `access_token` cookie and ' +
      'returns the one-time recovery code.',
    schema: SIGNUP_RESPONSE_SCHEMA,
  })
  @ApiResponse({ status: 404, description: 'Email or username already taken.' })
  @ApiResponse(THROTTLED_RESPONSE)
  async signUp(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, recoveryCode, accessToken, expiresInMs } =
      await this.authService.signUp(dto);

    this.setSessionCookie(res, accessToken, expiresInMs);

    return { status: 'success', user, recoveryCode };
  }

  @Post('verify-recovery-code')
  @HttpCode(HttpStatus.OK)
  @throttleRecoveryCode
  @ApiOperation({
    summary: 'Step 1 of 2 — prove ownership with the recovery code',
    description:
      'Checks the email/recovery-code pair and returns a short-lived reset ' +
      'token. **Sets no cookie and creates no session**: proving possession of ' +
      'the code is not the same as intending to sign in, and an abandoned ' +
      'reset should not leave anyone holding a session for an account whose ' +
      'password they still do not know.\n\n' +
      'An unknown address, an account with no recovery code stored, and a ' +
      'genuine mismatch all answer identically — any distinction would make ' +
      'this an account oracle.\n\n' +
      'Rate-limited hard, and that limit is the primary defence: unlike the ' +
      'code it replaced, a recovery code has no expiry and no per-code attempt ' +
      'ceiling.',
  })
  @ApiResponse({
    status: 200,
    description: 'Code accepted; a reset token was issued.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'reset_token_issued' },
        resetToken: { type: 'string' },
        expiresInSeconds: { type: 'number', example: 600 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'The email and recovery code do not match. Carries `code: ' +
      '"RECOVERY_CODE_INVALID"`.',
  })
  @ApiResponse(THROTTLED_RESPONSE)
  verifyRecoveryCode(@Body() dto: VerifyRecoveryCodeDto) {
    return this.authService.verifyRecoveryCode(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set a new password',
    description:
      'Spends the `resetToken` from `POST /auth/verify-recovery-code`. The new ' +
      'password must clear the same policy signup applies.\n\n' +
      '**Does not sign the user in** — sign in with the new password. Note that ' +
      'sessions already issued on other devices are *not* invalidated: this app ' +
      'has no refresh tokens, session store or denylist, so an existing token ' +
      'stays valid until its own expiry, the same limitation logout has.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed. No cookie is set.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'password_updated' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Either the new password failed the policy, or the token was missing, ' +
      'malformed, expired or signed for another purpose — `code: ' +
      '"RESET_TOKEN_INVALID"`, one answer for all four so the token is not ' +
      'described back to the caller.',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @throttleLogin
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
    schema: SESSION_RESPONSE_SCHEMA,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse(THROTTLED_RESPONSE)
  async login(
    @Body() dto: LoginDto,
    // passthrough: Nest still serialises the returned object; we only reach for
    // `res` to set the cookie, not to send the response ourselves.
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, expiresInMs } =
      await this.authService.login(dto);

    this.setSessionCookie(res, accessToken, expiresInMs);

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
    description:
      'The signed-in user. `userName` is joined from the `users` row — the ' +
      'token itself carries only `sub` and `email`.',
    schema: {
      type: 'object',
      properties: {
        sub: { type: 'number', example: 1 },
        email: { type: 'string', example: 'user@moviex.dev' },
        userName: { type: 'string', example: 'najaf' },
        iat: { type: 'number', example: 1786973312 },
        exp: { type: 'number', example: 1787059712 },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description:
      'Missing, invalid or expired cookie — or a valid token whose account no ' +
      'longer exists.',
  })
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user);
  }

  /**
   * The one place the session cookie is written.
   *
   * Both ways of establishing a session — password login and signup — go
   * through here, so the attributes cannot diverge between them. They must
   * also match `accessTokenCookieOptions()` exactly at logout, or the browser
   * scopes the clear to a different cookie and leaves the original in place.
   */
  private setSessionCookie(
    res: Response,
    accessToken: string,
    expiresInMs: number,
  ) {
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...accessTokenCookieOptions(),
      maxAge: expiresInMs,
    });
  }
}
