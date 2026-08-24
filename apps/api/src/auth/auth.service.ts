import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/entity/user.entity';
import { Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import jwtConfig from 'src/config/jwt.config';
import { EmailService } from 'src/mail/email.service';
import type { JwtPayload } from './guards/jwt-auth.guard';
import type {
  AuthErrorCode,
  ForgotPasswordResponse,
  OtpChallenge,
  OtpPurpose,
  ResetPasswordResponse,
  VerifyResetOtpResponse,
} from '@moviex/shared-types';
import {
  AUTH_ERROR_CODE,
  OTP_MAX_ATTEMPTS,
  OTP_PURPOSE,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  RESET_TOKEN_TTL_SECONDS,
  generateOtpCode,
  secondsUntil,
} from './otp.constants';

/** What `POST /auth/verify-reset-otp` signs, and `reset-password` demands back. */
type ResetTokenPayload = {
  sub: number;
  purpose: typeof OTP_PURPOSE.PASSWORD_RESET;
};

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Creates the account **unverified** and emails a code.
   *
   * No cookie is set and no token is issued: the address has not been proven
   * yet, and the whole point of the gate is that holding the password is not
   * sufficient. `POST /auth/verify-otp` is what establishes the session.
   */
  async signUp(dto: RegisterDto) {
    const user = await this.userRepository.findOne({
      where: [{ email: dto.email }, { userName: dto.userName }],
    });

    if (user) throw new NotFoundException('User already exists');

    const createdUser = this.userRepository.create(dto);

    createdUser.password = await bcrypt.hash(
      createdUser.password,
      this.saltRounds,
    );
    createdUser.isEmailVerified = false;

    // Saves the row and sends the email; the response deliberately carries
    // neither the code nor the user, only what the OTP screen needs.
    const challenge = await this.issueOtp(
      createdUser,
      OTP_PURPOSE.EMAIL_VERIFICATION,
    );

    return { status: 'pending_verification' as const, challenge };
  }

  /**
   * Checks a submitted code and, on success, signs the user in.
   *
   * The order of the guards matters. The attempt ceiling is tested **before**
   * the code itself, so an exhausted budget stays exhausted rather than being
   * quietly bypassed by a lucky guess; and expiry is tested before equality, so
   * a stale-but-correct code reports as expired rather than as wrong, which is
   * the difference between "wait for the new email" and "you mistyped it".
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.consumeOtp(
      dto.email,
      dto.code,
      OTP_PURPOSE.EMAIL_VERIFICATION,
    );

    user.isEmailVerified = true;
    await this.userRepository.save(user);

    /*
     * Always the short session, deliberately. "Remember me" is a choice made on
     * the login form, and the register → OTP flow never presents it — there is
     * no checkbox on the signup form and none on the code-entry screen. Adding
     * one to `VerifyOtpDto` would mean inventing a preference the user was
     * never asked for; the honest default is the shorter of the two, and the
     * next sign-in is where they get to choose.
     */
    return this.issueSession(user);
  }

  /**
   * Issues a replacement code, at most once a minute per account.
   *
   * Rate-limited on `otpLastSentAt` rather than on the caller, because the cost
   * being controlled is outbound email to one address — and because a limit
   * keyed to the browser is bypassed by opening another one.
   */
  async resendOtp(dto: ResendOtpDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    /*
     * A 404 here does leak whether an address is registered — but `signUp`
     * already answers "User already exists" for the same question, so this
     * closes nothing that is currently open, and a silent fake success would
     * leave a genuinely mistyped address waiting on a code forever. Closing
     * enumeration properly means changing signup too; see CLAUDE.md.
     */
    if (!user) throw new NotFoundException('No account for that email');

    // Nothing to verify. Not an error — the user has ended up here from a
    // stale tab, and the honest answer is "you're done, go sign in".
    if (user.isEmailVerified) {
      return {
        status: 'already_verified' as const,
        message: 'This email is already verified',
      };
    }

    const retryAfterSeconds = this.resendCooldownRemaining(user);

    if (retryAfterSeconds > 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Please wait a bit before requesting another code',
          code: AUTH_ERROR_CODE.OTP_RESEND_COOLDOWN,
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return {
      status: 'pending_verification' as const,
      challenge: await this.issueOtp(user, OTP_PURPOSE.EMAIL_VERIFICATION),
    };
  }

  /**
   * Step 1 of a password reset: email a code — **maybe**.
   *
   * The response is identical for every input: unknown address, known but
   * unverified address, real send, and a request that arrived inside the
   * cooldown all produce the same body. Everything that varies happens before
   * the `return`, and nothing that varies is observable in it.
   *
   * That is a stricter rule than the rest of this module follows. `signUp`
   * answers "User already exists" and `resendOtp` 404s on an unknown email, so
   * account enumeration is not closed in this app — but those disclosures at
   * least cost the attacker something (an attempt to take the address, a
   * distinguishable flow). Password reset is the endpoint an attacker actually
   * wants an oracle on, and it is the one place here where staying quiet costs
   * a legitimate user nothing: someone who mistyped their address gets no
   * email, exactly as they would if the address simply had no account.
   *
   * **An unverified account is declined, silently.** It has never proven it can
   * receive mail at that address, so emailing a password-reset code there would
   * let whoever registered it — possibly not the address's owner — take control
   * on the strength of an address they never proved. Their way in is the signup
   * verification flow, which the client's copy points everyone at.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    /*
     * Every branch below falls through to the same return. They are written as
     * separate guards rather than one condition so each reason is legible, but
     * none of them may throw, log differently to the caller, or return early
     * with a different shape.
     */
    const canSend =
      user !== null &&
      user.isEmailVerified &&
      // Rate limit, doubling as the "already sent one a moment ago" case. A
      // rejection here is silence, not a 429: a 429 would confirm the account.
      this.resendCooldownRemaining(user) === 0;

    if (canSend) {
      await this.issueOtp(user, OTP_PURPOSE.PASSWORD_RESET);
    }

    /*
     * Policy figures, not this account's remaining time — see
     * `PasswordResetChallenge`. Per-account seconds are exactly what would
     * leak, so the client counts down from the full window in every case.
     */
    return {
      status: 'if_account_exists_code_sent',
      challenge: {
        expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
        resendAvailableInSeconds: Math.round(OTP_RESEND_COOLDOWN_MS / 1000),
      },
    };
  }

  /**
   * Step 2: check the code and hand back a short-lived reset token.
   *
   * **Deliberately does not sign anyone in**, which is the one place this
   * diverges from `verifyOtp`. There, entering the code is the last step of
   * creating an account and a session is what the user is plainly there for.
   * Here, the code proves only that whoever typed it can read that mailbox —
   * the flow is not finished until a new password is set, and handing out a
   * session in the middle would mean an abandoned reset leaves someone signed
   * in to an account whose password they still do not know.
   *
   * The token it returns is scoped to that one remaining step. No cookie is
   * touched on this path.
   */
  async verifyResetOtp(dto: VerifyResetOtpDto): Promise<VerifyResetOtpResponse> {
    const user = await this.consumeOtp(
      dto.email,
      dto.code,
      OTP_PURPOSE.PASSWORD_RESET,
    );

    // The code is spent before the token is minted, so a replay of the same
    // four digits cannot mint a second one.
    await this.userRepository.save(user);

    const payload: ResetTokenPayload = {
      sub: user.id,
      purpose: OTP_PURPOSE.PASSWORD_RESET,
    };

    const resetToken = jwt.sign(payload, this.jwtConfiguration.secret as string, {
      expiresIn: RESET_TOKEN_TTL_SECONDS,
    });

    return {
      status: 'reset_token_issued',
      resetToken,
      expiresInSeconds: RESET_TOKEN_TTL_SECONDS,
    };
  }

  /**
   * Step 3: spend the reset token and set the new password.
   *
   * **Also does not sign anyone in.** The user goes back to the login form and
   * types the password they just chose, which is the only thing that actually
   * confirms it is the password they think it is — and it keeps "having a
   * session" meaning "someone entered this account's current password", with no
   * second route to one.
   *
   * **Other devices are not signed out.** This app has no refresh tokens, no
   * server-side session and no denylist, so a token already issued stays
   * cryptographically valid until its own expiry — the same limitation logout
   * already has, where clearing the cookie removes the browser's copy and
   * revokes nothing. So a reset locks an attacker out of *future* sign-ins but
   * not an existing session, for up to `JWT_EXPIRES_IN` (or 30 days on a
   * "remember me" token). Closing that properly needs a revocation mechanism —
   * a `passwordChangedAt` column the guard compares `iat` against would do it,
   * and is a deliberate change to make, not something to bolt on here.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<ResetPasswordResponse> {
    const payload = this.verifyResetToken(dto.resetToken);

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    /*
     * A valid token for an account that has since gone. Answered as an invalid
     * token rather than a 404: from the user's side there is one action to
     * take either way, and the distinction only tells a caller holding a signed
     * token something about the account behind it.
     */
    if (!user) throw this.otpError(AUTH_ERROR_CODE.RESET_TOKEN_INVALID);

    user.password = await bcrypt.hash(dto.newPassword, this.saltRounds);

    /*
     * Belt and braces: `verifyResetOtp` already cleared the code. This covers
     * the interleaving where a *new* code was requested after that step and is
     * still outstanding — the password it was going to guard has just been
     * changed, so the code should not survive it.
     */
    this.clearOtp(user);
    await this.userRepository.save(user);

    return { status: 'password_updated' };
  }

  /**
   * The signed-in user for `GET /auth/me`.
   *
   * Joined from the `users` row rather than returned straight off the token.
   * The JWT deliberately carries only `sub` and `email` — it rides on every
   * single request, so it stays small — but the UI has to display a username,
   * and inventing one client-side from the email is exactly what this avoids.
   *
   * Costs one primary-key lookup per call, which the client caches for five
   * minutes. Reading the row also means a username change is reflected on the
   * next `/auth/me` instead of being frozen until the token expires.
   */
  async me(payload: JwtPayload) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    // A structurally valid token for an account that no longer exists is not a
    // session. Answering 401 keeps "signed in" meaning there is a user behind it.
    if (!user) throw new UnauthorizedException('Account no longer exists');

    return {
      sub: user.id,
      email: user.email,
      userName: user.userName,
      // Passed through from the token so the response shape stays a superset of
      // what it was before.
      iat: payload.iat,
      exp: payload.exp,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    /*
     * Right password, unproven address. Deliberately **not** a 401 with
     * "Invalid credentials": the client has to be able to tell this apart from
     * a wrong password, because the two need opposite responses — one sends the
     * user to the OTP screen, the other tells them to try again. Checked after
     * the password so an unverified address is not confirmed to someone who
     * cannot sign in anyway.
     */
    if (!user.isEmailVerified) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Email not verified',
          code: AUTH_ERROR_CODE.EMAIL_NOT_VERIFIED,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    return this.issueSession(user, dto.rememberMe ?? false);
  }

  /**
   * Mints the token and shapes the response. **The single place a session is
   * created** — `login` and `verifyOtp` both end here, so the two cannot drift
   * in what they sign, how long the cookie lives, or what they hand back.
   */
  private issueSession(user: UserEntity, rememberMe = false) {
    /*
     * The only thing "Remember me" changes. There is no refresh token and no
     * server-side session in this app, so the signed lifetime *is* the session
     * — which is also why the two durations live in `jwt.config.ts` and not as
     * literals here.
     */
    const expiresIn = (
      rememberMe
        ? this.jwtConfiguration.rememberExpiresIn
        : this.jwtConfiguration.expiresIn
    ) as jwt.SignOptions['expiresIn'];

    const accessToken = jwt.sign(
      { sub: user.id, email: user.email },
      this.jwtConfiguration.secret as string,
      { expiresIn },
    );

    /*
     * The `otp*` fields are stripped alongside the password. Not theoretical:
     * a user can hold an unexpired code while signing in — request one, then
     * log in on another device — and without this, `POST /auth/login` would
     * hand the live code straight back in its response body.
     */
    const {
      password: _password,
      otpCode: _otpCode,
      otpExpiresAt: _otpExpiresAt,
      otpAttempts: _otpAttempts,
      otpLastSentAt: _otpLastSentAt,
      otpPurpose: _otpPurpose,
      ...safeUser
    } = user;

    /*
     * The caller sets this as the cookie's `maxAge`. Derived from the token's
     * own claims rather than by parsing the duration string ("1d" / "30d") a
     * second time, so the cookie cannot outlive — or expire before — the token
     * inside it. This is what makes the two `rememberMe` branches above
     * structurally incapable of drifting apart: there is only ever one
     * duration, and the cookie reads it back out of the token.
     */
    const { iat, exp } = jwt.decode(accessToken) as { iat: number; exp: number };

    return {
      user: safeUser,
      accessToken,
      expiresInMs: (exp - iat) * 1000,
    };
  }

  /**
   * The guard chain both verify endpoints run, in the order that matters.
   *
   * Returns the user with the code **cleared but not yet saved**, so each caller
   * adds whatever else that flow changes and writes once. Shared rather than
   * copied because the ordering below is the security property — a second copy
   * is a second place for it to be got subtly wrong.
   *
   * 1. **Attempt ceiling first**, before the code is even compared, so an
   *    exhausted budget cannot be bypassed by a lucky guess.
   * 2. **Purpose before expiry and equality.** A code issued for the other flow
   *    is not this flow's code at all, and must not be comparable here — this
   *    is the check that makes sharing the `otp*` columns safe. It answers
   *    `OTP_INVALID` and burns no attempt: there is nothing to brute-force,
   *    since the caller is not even in the right flow.
   * 3. **Expiry before equality**, so a stale-but-correct code reports as
   *    expired rather than wrong — "wait for the new email" versus "you
   *    mistyped it".
   * 4. **The lockout is reported on the attempt that causes it**, not the next
   *    one, or the UI keeps offering a retry already guaranteed to fail.
   */
  private async consumeOtp(
    email: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { email } });

    /*
     * No such account reads as a bad code, not as a 404. There is nothing to
     * increment, and answering differently would turn this endpoint into a
     * membership oracle for any address someone cares to try.
     */
    if (!user) throw this.otpError(AUTH_ERROR_CODE.OTP_INVALID);

    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      throw this.otpError(AUTH_ERROR_CODE.OTP_TOO_MANY_ATTEMPTS);
    }

    // No outstanding code: already used, already verified, or never issued.
    if (!user.otpCode || !user.otpExpiresAt) {
      throw this.otpError(AUTH_ERROR_CODE.OTP_INVALID);
    }

    // Issued for the other flow — see the note above.
    if (user.otpPurpose !== purpose) {
      throw this.otpError(AUTH_ERROR_CODE.OTP_INVALID);
    }

    if (user.otpExpiresAt.getTime() <= Date.now()) {
      await this.recordFailedAttempt(user);
      throw this.otpError(AUTH_ERROR_CODE.OTP_EXPIRED);
    }

    if (user.otpCode !== code) {
      const attempts = await this.recordFailedAttempt(user);

      throw this.otpError(
        attempts >= OTP_MAX_ATTEMPTS
          ? AUTH_ERROR_CODE.OTP_TOO_MANY_ATTEMPTS
          : AUTH_ERROR_CODE.OTP_INVALID,
      );
    }

    // The code is spent. Clearing it is what stops it being replayed within its
    // remaining lifetime. The caller saves.
    this.clearOtp(user);

    return user;
  }

  /**
   * Checks a reset token is ours, current, and minted for this purpose.
   *
   * The `purpose` claim is not decoration. Without it, any token signed with
   * `JWT_SECRET` would be accepted here — including a **session** token, which
   * every signed-in user's browser holds. That would turn "I am signed in" into
   * "I may change this account's password without knowing the current one", and
   * a stolen session cookie into a permanent account takeover. The claim is
   * what keeps the two token families apart despite the shared secret.
   *
   * Every failure — bad signature, expired, wrong purpose, not a JWT at all —
   * collapses to one code. They mean the same thing to the user ("start
   * again"), and distinguishing them describes the token to whoever is probing.
   */
  private verifyResetToken(token: string): ResetTokenPayload {
    let decoded: unknown;

    try {
      decoded = jwt.verify(token, this.jwtConfiguration.secret as string);
    } catch {
      // Never rethrow the jsonwebtoken error: its message ("jwt expired",
      // "invalid signature") would surface raw in the response body.
      throw this.otpError(AUTH_ERROR_CODE.RESET_TOKEN_INVALID);
    }

    const payload = decoded as Partial<ResetTokenPayload> | string;

    if (
      typeof payload !== 'object' ||
      payload === null ||
      payload.purpose !== OTP_PURPOSE.PASSWORD_RESET ||
      typeof payload.sub !== 'number'
    ) {
      throw this.otpError(AUTH_ERROR_CODE.RESET_TOKEN_INVALID);
    }

    return { sub: payload.sub, purpose: OTP_PURPOSE.PASSWORD_RESET };
  }

  /**
   * Generates a code, persists it, emails it, and describes what the client
   * should put on screen. Shared by signup, resend and password reset so all
   * three stamp the same fields — a caller that forgot to reset `otpAttempts`
   * would hand back a fresh code that is already locked out.
   *
   * **`purpose` is stored with the code**, and issuing overwrites whatever was
   * pending for the other flow. That is intended: a user is only ever part-way
   * through one of these at a time, and the last code they asked for is the one
   * in front of them.
   *
   * `otpLastSentAt` is written **only after a successful send**, so a failed
   * delivery does not start a cooldown against a code that never arrived.
   */
  private async issueOtp(
    user: UserEntity,
    purpose: OtpPurpose,
  ): Promise<OtpChallenge> {
    const code = generateOtpCode();

    user.otpCode = code;
    user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    user.otpAttempts = 0;
    user.otpLastSentAt = null;
    user.otpPurpose = purpose;

    await this.userRepository.save(user);

    const expiresInMinutes = Math.round(OTP_TTL_MS / 60_000);

    // Same contract either way: never throws, never logs the code, returns
    // whether it reached the mail server.
    const emailSent =
      purpose === OTP_PURPOSE.PASSWORD_RESET
        ? await this.emailService.sendPasswordResetEmail(
            user.email,
            code,
            expiresInMinutes,
          )
        : await this.emailService.sendOtpEmail(
            user.email,
            code,
            expiresInMinutes,
          );

    if (emailSent) {
      user.otpLastSentAt = new Date();
      await this.userRepository.save(user);
    }

    return {
      email: user.email,
      expiresInSeconds: secondsUntil(user.otpExpiresAt),
      resendAvailableInSeconds: this.resendCooldownRemaining(user),
      emailSent,
    };
  }

  /** Seconds left on the resend cooldown; `0` when a send is allowed now. */
  private resendCooldownRemaining(user: UserEntity): number {
    if (!user.otpLastSentAt) return 0;

    return secondsUntil(
      new Date(user.otpLastSentAt.getTime() + OTP_RESEND_COOLDOWN_MS),
    );
  }

  /** Burns one attempt against the current code and returns the new total. */
  private async recordFailedAttempt(user: UserEntity): Promise<number> {
    user.otpAttempts += 1;
    await this.userRepository.save(user);

    return user.otpAttempts;
  }

  private clearOtp(user: UserEntity) {
    user.otpCode = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    user.otpLastSentAt = null;
    // Cleared with the rest: a purpose left behind describes a code that is no
    // longer there, and the next flow to run would be reading a stale label.
    user.otpPurpose = null;
  }

  /**
   * The OTP failures, as a body the client can branch on.
   *
   * All 400 except the lockout, which is 403 — "your input was wrong" versus
   * "this account is not accepting attempts right now" are different answers,
   * and the second one does not become true by resubmitting.
   */
  private otpError(code: AuthErrorCode): HttpException {
    const { status, message } = OTP_ERRORS[code];

    return new HttpException({ statusCode: status, message, code }, status);
  }
}

const OTP_ERRORS: Record<
  AuthErrorCode,
  { status: HttpStatus; message: string }
> = {
  OTP_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid verification code',
  },
  OTP_EXPIRED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'That code has expired — request a new one',
  },
  OTP_TOO_MANY_ATTEMPTS: {
    status: HttpStatus.FORBIDDEN,
    message: 'Too many incorrect attempts — request a new code',
  },
  OTP_RESEND_COOLDOWN: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Please wait a bit before requesting another code',
  },
  EMAIL_NOT_VERIFIED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Email not verified',
  },
  /*
   * Deliberately vague, and deliberately one message for four causes — a bad
   * signature, an expired token, one signed for a different purpose, and a
   * string that was never a JWT. Naming which would describe the token back to
   * whoever supplied it.
   */
  RESET_TOKEN_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'That reset session has expired — request a new code',
  },
};
