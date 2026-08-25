import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyRecoveryCodeDto } from './dto/verify-recovery-code.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/entity/user.entity';
import { Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import jwtConfig from 'src/config/jwt.config';
import type { JwtPayload } from './guards/jwt-auth.guard';
import type {
  AuthErrorCode,
  ResetPasswordResponse,
  SignupResponse,
  VerifyRecoveryCodeResponse,
} from '@moviex/shared-types';
import {
  AUTH_ERROR_CODE,
  PASSWORD_RESET_PURPOSE,
  RESET_TOKEN_TTL_SECONDS,
  generateRecoveryCode,
} from './recovery.constants';

/** What `POST /auth/verify-recovery-code` signs, and `reset-password` demands back. */
type ResetTokenPayload = {
  sub: number;
  purpose: typeof PASSWORD_RESET_PURPOSE;
};

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  /**
   * Creates the account, issues its recovery code, and signs the user in.
   *
   * **All three happen in one response, and that is a deliberate change from
   * the flow this replaced.** Signup used to create an unverified account and
   * set no cookie, because holding the password was explicitly not sufficient —
   * the emailed code was the second factor that made the account usable. With
   * email gone there is nothing left to wait for: a separate login step
   * immediately afterwards would ask for the password the user typed seconds
   * ago and prove nothing that this request has not already established.
   *
   * **The plaintext recovery code exists only in this return value.** Only its
   * bcrypt hash is stored, so it can never be re-read, re-sent or recovered.
   * It is never logged — including on any error path — for the same reason a
   * password is not.
   */
  async signUp(
    dto: RegisterDto,
  ): Promise<SignupResponse & { accessToken: string; expiresInMs: number }> {
    const user = await this.userRepository.findOne({
      where: [{ email: dto.email }, { userName: dto.userName }],
    });

    if (user) throw new NotFoundException('User already exists');

    const createdUser = this.userRepository.create(dto);

    createdUser.password = await bcrypt.hash(
      createdUser.password,
      this.saltRounds,
    );

    const recoveryCode = generateRecoveryCode();

    /*
     * Hashed with the same salt rounds as the password, because it *is* a
     * second password: it alone is enough to take over the account, so storing
     * it in a form the database could hand to a reader would be strictly worse
     * than storing the password in plaintext.
     */
    createdUser.recoveryCodeHash = await bcrypt.hash(
      recoveryCode,
      this.saltRounds,
    );

    const savedUser = await this.userRepository.save(createdUser);

    const session = this.issueSession(savedUser);

    return {
      user: {
        id: savedUser.id,
        userName: savedUser.userName,
        email: savedUser.email,
      },
      recoveryCode,
      accessToken: session.accessToken,
      expiresInMs: session.expiresInMs,
    };
  }

  /**
   * Step 1 of two: check the recovery code and hand back a short-lived reset
   * token.
   *
   * **Deliberately does not sign anyone in.** Proving possession of the
   * recovery code is not the same as proving intent to sign in, and someone who
   * abandons the flow half-way should not be left holding a session for an
   * account whose password they still do not know. The token it returns is
   * scoped to the one remaining step; no cookie is touched on this path.
   *
   * **Every failure answers identically**, and the reasons are worth keeping
   * distinct in your head even though the response does not:
   *
   * - no account for that address,
   * - an account with no `recoveryCodeHash` (pre-migration rows — a defensive
   *   branch, not a supported state, and the null check is also what stops
   *   `bcrypt.compare` throwing on a null digest),
   * - a genuine mismatch.
   *
   * Distinguishing any of them turns this endpoint into an account oracle, and
   * there is exactly one action for the user to take in all three cases.
   */
  async verifyRecoveryCode(
    dto: VerifyRecoveryCodeDto,
  ): Promise<VerifyRecoveryCodeResponse> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    /*
     * `bcrypt.compare` against a dummy hash is deliberately NOT done here to
     * equalise timing. This endpoint is rate-limited to a handful of attempts a
     * minute, which is the defence that actually matters for a code with no
     * expiry; a timing side-channel measured through that is not the weak link,
     * and pretending otherwise would add a hash-cost to every unknown address.
     */
    if (!user?.recoveryCodeHash) {
      throw this.authError(AUTH_ERROR_CODE.RECOVERY_CODE_INVALID);
    }

    const matches = await bcrypt.compare(
      dto.recoveryCode,
      user.recoveryCodeHash,
    );

    if (!matches) {
      throw this.authError(AUTH_ERROR_CODE.RECOVERY_CODE_INVALID);
    }

    const payload: ResetTokenPayload = {
      sub: user.id,
      purpose: PASSWORD_RESET_PURPOSE,
    };

    const resetToken = jwt.sign(
      payload,
      this.jwtConfiguration.secret as string,
      { expiresIn: RESET_TOKEN_TTL_SECONDS },
    );

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
    if (!user) throw this.authError(AUTH_ERROR_CODE.RESET_TOKEN_INVALID);

    user.password = await bcrypt.hash(dto.newPassword, this.saltRounds);

    /*
     * The recovery code is deliberately **not** rotated here. It is the user's
     * only way back in, and silently replacing it with a value they have never
     * seen would lock them out of the next reset — the exact failure this whole
     * system exists to avoid. Someone who reaches this point already proved
     * possession of the code, so it has not been compromised by being used.
     */
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

    return this.issueSession(user, dto.rememberMe ?? false);
  }

  /**
   * Mints the token and shapes the response. **The single place a session is
   * created** — `login` and `signUp` both end here, so the two cannot drift in
   * what they sign, how long the cookie lives, or what they hand back.
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
     * `recoveryCodeHash` is stripped alongside the password, and for the same
     * reason: it is a credential's digest, and the fact that a row *has* one is
     * not something a response should describe either.
     */
    const {
      password: _password,
      recoveryCodeHash: _recoveryCodeHash,
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
    const { iat, exp } = jwt.decode(accessToken) as {
      iat: number;
      exp: number;
    };

    return {
      user: safeUser,
      accessToken,
      expiresInMs: (exp - iat) * 1000,
    };
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
      throw this.authError(AUTH_ERROR_CODE.RESET_TOKEN_INVALID);
    }

    const payload = decoded as Partial<ResetTokenPayload> | string;

    if (
      typeof payload !== 'object' ||
      payload === null ||
      payload.purpose !== PASSWORD_RESET_PURPOSE ||
      typeof payload.sub !== 'number'
    ) {
      throw this.authError(AUTH_ERROR_CODE.RESET_TOKEN_INVALID);
    }

    return { sub: payload.sub, purpose: PASSWORD_RESET_PURPOSE };
  }

  /**
   * The auth failures that carry a machine-readable code, as a body the client
   * can branch on rather than pattern-matching English prose.
   */
  private authError(code: AuthErrorCode): HttpException {
    const { status, message } = AUTH_ERRORS[code];

    return new HttpException({ statusCode: status, message, code }, status);
  }
}

const AUTH_ERRORS: Record<
  AuthErrorCode,
  { status: HttpStatus; message: string }
> = {
  /*
   * One message for three causes — unknown address, no recovery code stored,
   * and a genuine mismatch. Naming which would turn the endpoint into an
   * account oracle, and the user's next action is the same either way.
   */
  RECOVERY_CODE_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'That email and recovery code do not match',
  },
  /*
   * Deliberately vague, and deliberately one message for four causes — a bad
   * signature, an expired token, one signed for a different purpose, and a
   * string that was never a JWT. Naming which would describe the token back to
   * whoever supplied it.
   */
  RESET_TOKEN_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'That reset session has expired — start again',
  },
};
