import { registerAs } from '@nestjs/config';

/**
 * Two session lengths, one for each answer to "Remember me".
 *
 * Only the *expiry* differs — there is no refresh token and no server-side
 * session in this app, so the signed lifetime is the whole story. Whichever of
 * these is used to sign a token is also what the cookie's `maxAge` ends up
 * being, because `AuthService.issueSession` reads the duration back off the
 * token's own claims rather than parsing the string a second time.
 */
export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  /** The default, unticked-checkbox session. `1d` in this project. */
  expiresIn: process.env.JWT_EXPIRES_IN,
  /**
   * The "Remember me" session. Overridable, but defaulted here rather than
   * left undefined: an absent value makes `jwt.sign` mint a token with no
   * `exp` at all, which is a permanent session — the opposite of a
   * configuration mistake you want to fail quietly.
   */
  rememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN ?? '30d',
}));
