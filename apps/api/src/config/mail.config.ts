import { registerAs } from '@nestjs/config';

/**
 * Gmail SMTP credentials.
 *
 * `pass` must be a Google **App Password**, not the account password — Google
 * refuses plain-password SMTP on any account, and the failure surfaces as a
 * generic "Username and Password not accepted", which is easy to misread as a
 * typo in the address.
 */
export default registerAs('mail', () => ({
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  /** Envelope sender. Gmail rewrites anything that is not the authenticated
   *  account, so in practice this is `SMTP_USER`. */
  from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
}));
