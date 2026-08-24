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
  EMAIL_DISPATCH_LIMIT,
  LOGIN_LIMIT,
  SIGNUP_LIMIT,
  THROTTLE_WINDOW_MS,
} from '../throttle.constants';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { JwtPayload } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
} from './auth.constants';

/**
 * The body every endpoint that establishes a session returns. Declared once so
 * `POST /auth/login` and `POST /auth/verify-otp` document the same shape — they
 * are the same event reached two ways.
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
        isEmailVerified: { type: 'boolean', example: true },
      },
    },
  },
} as const;

/** What the OTP screen needs. Never includes the code itself. */
const CHALLENGE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', example: 'pending_verification' },
    challenge: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@moviex.dev' },
        expiresInSeconds: { type: 'number', example: 600 },
        resendAvailableInSeconds: { type: 'number', example: 60 },
        emailSent: { type: 'boolean', example: true },
      },
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
const throttleEmailDispatch = Throttle({
  default: { limit: EMAIL_DISPATCH_LIMIT, ttl: THROTTLE_WINDOW_MS },
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
      'Creates the account **unverified** and emails a 4-digit code. Issues ' +
      'no token and sets no cookie — `POST /auth/verify-otp` is what signs the ' +
      'user in. The code is never present in the response.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Account created; a verification code has been emailed. `emailSent: ' +
      'false` means the account exists but delivery failed — the client should ' +
      'offer Resend rather than a countdown.',
    schema: CHALLENGE_RESPONSE_SCHEMA,
  })
  @ApiResponse({ status: 404, description: 'Email or username already taken.' })
  @ApiResponse(THROTTLED_RESPONSE)
  signUp(@Body() dto: RegisterDto) {
    return this.authService.signUp(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify the emailed code',
    description:
      'Marks the address verified and signs the user in, setting the same ' +
      'httpOnly `access_token` cookie `POST /auth/login` does. Five wrong ' +
      'attempts against one code lock it; requesting a new code resets that.',
  })
  @ApiResponse({
    status: 200,
    description: 'Verified and signed in. Sets the `access_token` cookie.',
    schema: SESSION_RESPONSE_SCHEMA,
  })
  @ApiResponse({
    status: 400,
    description:
      'Body carries `code: "OTP_INVALID"` or `"OTP_EXPIRED"` so the client can ' +
      'tell a mistyped code from a stale one.',
  })
  @ApiResponse({
    status: 403,
    description: 'Attempt limit reached — `code: "OTP_TOO_MANY_ATTEMPTS"`.',
  })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, expiresInMs } =
      await this.authService.verifyOtp(dto);

    this.setSessionCookie(res, accessToken, expiresInMs);

    return { status: 'success', user };
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @throttleEmailDispatch
  @ApiOperation({
    summary: 'Send a fresh verification code',
    description:
      'At most one send per 60 seconds per account. Issuing a new code resets ' +
      'the attempt counter, which is what makes this the way out of a lockout.',
  })
  @ApiResponse({
    status: 200,
    description:
      'A new code has been sent — or, for an already-verified account, ' +
      '`status: "already_verified"` and nothing is sent.',
    schema: CHALLENGE_RESPONSE_SCHEMA,
  })
  @ApiResponse({ status: 404, description: 'No account for that email.' })
  @ApiResponse({
    status: 429,
    description:
      'Two different limits answer here. The per-account cooldown carries ' +
      '`code: "OTP_RESEND_COOLDOWN"` and `retryAfterSeconds`; the per-IP rate ' +
      'limit carries neither. Branch on `code`, not on the status.',
  })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @throttleEmailDispatch
  @ApiOperation({
    summary: 'Start a password reset',
    description:
      'Emails a 4-digit reset code. **Answers identically for every input** — ' +
      'unknown address, unverified account, a real send, and a request inside ' +
      'the 60s cooldown all return the same body, so this cannot be used to ' +
      'discover whether an address has an account. A code is only actually ' +
      'sent for an existing, already-verified account. Unverified accounts are ' +
      'declined silently: they have never proven they can receive mail there, ' +
      'and their route in is the signup verification flow.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Always. `challenge` carries the **policy** window (code lifetime, resend ' +
      'cooldown), not this account’s remaining time — per-account seconds are ' +
      'exactly what would leak.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'if_account_exists_code_sent' },
        challenge: {
          type: 'object',
          properties: {
            expiresInSeconds: { type: 'number', example: 600 },
            resendAvailableInSeconds: { type: 'number', example: 60 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description:
      'Per-IP rate limit. This does **not** weaken the non-disclosure above: ' +
      'the limit is counted per caller address, never per submitted email, so ' +
      'the answer to any given address is still identical whether or not it ' +
      'has an account. (The per-account cooldown deliberately stays silent ' +
      'here and returns 200 — a 429 for *that* would confirm the account.)',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify a password-reset code',
    description:
      'Same attempt ceiling and expiry handling as `POST /auth/verify-otp`, ' +
      'but only accepts a code issued **for a password reset** — an email ' +
      'verification code is rejected as invalid here, and vice versa.\n\n' +
      '**Does not sign the user in and sets no cookie.** It returns a ' +
      'short-lived `resetToken` (10 minutes, `purpose: "password_reset"`) whose ' +
      'only use is `POST /auth/reset-password`. It is not a session token and ' +
      'is never accepted as the `access_token` cookie.',
  })
  @ApiResponse({
    status: 200,
    description: 'Code accepted; spend `resetToken` on the next call.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'reset_token_issued' },
        resetToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs…' },
        expiresInSeconds: { type: 'number', example: 600 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      '`code: "OTP_INVALID"` (wrong, absent, or issued for the other flow) or ' +
      '`"OTP_EXPIRED"`.',
  })
  @ApiResponse({
    status: 403,
    description: 'Attempt limit reached — `code: "OTP_TOO_MANY_ATTEMPTS"`.',
  })
  verifyResetOtp(@Body() dto: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set a new password',
    description:
      'Spends the `resetToken` from `POST /auth/verify-reset-otp`. The new ' +
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
  @ApiResponse({
    status: 403,
    description:
      'Password was correct but the address is unverified — `code: ' +
      '"EMAIL_NOT_VERIFIED"`. Distinct from 401 on purpose: the client sends ' +
      'this user to the OTP screen rather than telling them the password was wrong.',
  })
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
   * Both ways of establishing a session — password login and OTP verification —
   * go through here, so the attributes cannot diverge between them. They must
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
