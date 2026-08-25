import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { resolve4 } from 'node:dns/promises';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import mailConfig from 'src/config/mail.config';

/*
 * Explicit timeouts, because nodemailer's defaults are sized for a background
 * batch job rather than for a request someone is watching a spinner on:
 * connection **2 minutes**, socket 10 minutes, greeting 30 seconds.
 *
 * That default matters more than it looks. A host that *drops* outbound SMTP
 * packets rather than refusing them — several PaaS providers block port 587 on
 * their cheaper tiers — leaves `POST /auth/signup` hanging for the full two
 * minutes before the send finally fails. In the browser that is indistinguishable
 * from the button doing nothing: no OTP view, no error, just a pending request
 * nobody waits out.
 *
 * Bounded here instead, so a blocked or unreachable mail server costs seconds.
 * Signup still answers with its challenge; `emailSent: false` is what the modal
 * reads to say the mail did not go out, and the Resend button is the way back.
 */
const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587;

/*
 * How long a resolved address is reused before the A record is looked up
 * again. Gmail rotates its SMTP addresses, so this must not be forever; it is
 * long enough that a burst of signups does not become a burst of DNS queries.
 */
const DNS_CACHE_TTL_MS = 5 * 60_000;

const CONNECTION_TIMEOUT_MS = 8_000;
const GREETING_TIMEOUT_MS = 8_000;
const SOCKET_TIMEOUT_MS = 12_000;
const DNS_TIMEOUT_MS = 5_000;

/**
 * Outbound email, over Gmail's SMTP.
 *
 * Port 587 with `requireTLS` — the submission port, which opens in the clear
 * and is upgraded by STARTTLS. `requireTLS` (rather than plain `secure: false`)
 * is what makes the upgrade mandatory: without it nodemailer would fall back to
 * an unencrypted session if the server declined STARTTLS, and the app password
 * would go over the wire in the clear. Port 465 with `secure: true` is the
 * equivalent implicit-TLS choice; either is fine, this one is Gmail's
 * documented default.
 *
 * **Sends never throw out of this service.** Losing an email is a recoverable
 * inconvenience — there is a Resend button on the other side of it — whereas an
 * exception escaping here would fail a signup whose user row has already been
 * committed, leaving someone with an account they cannot get into and cannot
 * re-create. Callers get a boolean and decide what to tell the user.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  /** The address `transporter` was built against, and when it was resolved. */
  private transporterHost: string | null = null;
  private resolvedAt = 0;

  constructor(
    @Inject(mailConfig.KEY)
    private readonly mailConfiguration: ConfigType<typeof mailConfig>,
  ) {}

  /**
   * Resolves Gmail's SMTP host to an **IPv4** address.
   *
   * Returns `null` if the lookup fails, in which case the caller falls back to
   * the hostname — degraded (the IPv6 coin-flip below comes back) but not
   * broken, which is the right trade for a mail path that already tolerates
   * failure.
   */
  private async resolveIpv4Host(): Promise<string | null> {
    try {
      const [address] = await resolve4(SMTP_HOST);

      return address ?? null;
    } catch (error) {
      this.logger.error(
        `Could not resolve an IPv4 address for ${SMTP_HOST}; falling back to the hostname`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /**
   * Built on first use, not in the constructor, so the API still boots with no
   * mail credentials configured — every other route works, and only sending
   * degrades. Nodemailer pools nothing by default; one transporter is reused
   * until its resolved address goes stale.
   *
   * **The host handed to nodemailer is a resolved IPv4 literal, not
   * `smtp.gmail.com`, and that is the whole point.** See the class comment.
   */
  private async getTransporter(): Promise<Transporter | null> {
    const { user, pass } = this.mailConfiguration;

    if (!user || !pass) {
      this.logger.error(
        'SMTP_USER / SMTP_PASS are not set — verification emails cannot be sent.',
      );
      return null;
    }

    const isFresh = Date.now() - this.resolvedAt < DNS_CACHE_TTL_MS;

    if (this.transporter && isFresh) return this.transporter;

    const host = (await this.resolveIpv4Host()) ?? SMTP_HOST;

    this.resolvedAt = Date.now();

    // Same address as last time: keep the existing transporter rather than
    // discarding a perfectly good one on every TTL expiry.
    if (this.transporter && host === this.transporterHost) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: SMTP_PORT,
      secure: false,
      requireTLS: true,
      /*
       * Required, not optional, because `host` is an IP literal: nodemailer
       * derives the TLS servername from the host and sets it to `false` when
       * that host is an address (`smtp-connection/index.js:84`). Without this
       * the STARTTLS upgrade would go out with no SNI and no hostname to
       * validate the certificate against — still encrypted, and trivially
       * interceptable.
       *
       * Passed under `tls` rather than as a top-level `servername` purely
       * because that is the spelling `@types/nodemailer` (8.0.1) knows; both
       * reach the same handshake options (`smtp-connection/index.js:1059`).
       */
      tls: { servername: SMTP_HOST },
      auth: { user, pass },
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      greetingTimeout: GREETING_TIMEOUT_MS,
      socketTimeout: SOCKET_TIMEOUT_MS,
      dnsTimeout: DNS_TIMEOUT_MS,
    });
    this.transporterHost = host;

    return this.transporter;
  }

  /**
   * Emails a verification code for a new account.
   *
   * Returns whether it reached the mail server. **The code is never logged**,
   * on any path — it is a credential for the length of its life, and an error
   * log is exactly the place it would outlive its ten minutes.
   */
  async sendOtpEmail(
    to: string,
    code: string,
    expiresInMinutes: number,
  ): Promise<boolean> {
    return this.send(to, `${code} is your MovieX verification code`, {
      text: buildOtpText(code, expiresInMinutes),
      html: buildOtpHtml(code, expiresInMinutes),
      failureContext: 'verification',
    });
  }

  /**
   * Emails a password-reset code.
   *
   * Separate copy from {@link sendOtpEmail} rather than a shared "here is a
   * code" template, because the sentence that matters is the last one. A
   * verification email says "ignore this if you didn't sign up"; this one has to
   * say "if you didn't ask for this, your password has *not* changed" —
   * receiving it unexpectedly means someone typed your address into a reset
   * form, and the honest thing is to say what that does and does not imply.
   *
   * Same never-throws contract, same never-logs-the-code rule.
   */
  async sendPasswordResetEmail(
    to: string,
    code: string,
    expiresInMinutes: number,
  ): Promise<boolean> {
    return this.send(to, `${code} is your MovieX password reset code`, {
      text: buildResetText(code, expiresInMinutes),
      html: buildResetHtml(code, expiresInMinutes),
      failureContext: 'password reset',
    });
  }

  /**
   * The one place mail is actually handed to nodemailer, so the
   * never-throw/never-log-the-code guarantee is made once rather than per
   * template. A caller gets a boolean and decides what to tell the user.
   */
  private async send(
    to: string,
    subject: string,
    body: { text: string; html: string; failureContext: string },
  ): Promise<boolean> {
    const transporter = await this.getTransporter();

    if (!transporter) return false;

    const startedAt = Date.now();

    try {
      await transporter.sendMail({
        from: this.mailConfiguration.from,
        to,
        subject,
        text: body.text,
        html: body.html,
      });

      return true;
    } catch (error) {
      /*
       * The address is logged, the code is not — not even here, especially not
       * here: an error log is the one place it would outlive its expiry.
       *
       * Elapsed time and the SMTP error code are logged because they are what
       * separate the two very different causes that look identical from the
       * outside. A failure at roughly `CONNECTION_TIMEOUT_MS` with `ETIMEDOUT`
       * or `ESOCKET` means the connection never got out of the host at all —
       * a blocked port, not a credential problem. `EAUTH` with a fast failure
       * means the server answered and rejected the login, which for Gmail
       * usually means the App Password is wrong, revoked, or the sign-in was
       * flagged as suspicious from an unfamiliar datacenter address.
       */
      const elapsedMs = Date.now() - startedAt;
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: unknown }).code)
          : 'unknown';

      this.logger.error(
        `Failed to send ${body.failureContext} email to ${to} after ${elapsedMs}ms (code: ${code})`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }
}

/*
 * Plain text is the version that matters — it is what a text-only client, a
 * notification preview and most spam filters read, and the code has to be
 * legible in all three. The HTML below carries the same words and adds nothing
 * the text version leaves out.
 */
function buildOtpText(code: string, expiresInMinutes: number): string {
  return [
    'Your MovieX verification code is:',
    '',
    code,
    '',
    `This code expires in ${expiresInMinutes} minutes.`,
    "If you didn't create a MovieX account, you can ignore this email.",
  ].join('\n');
}

function buildOtpHtml(code: string, expiresInMinutes: number): string {
  return buildCodeHtml({
    lead: 'Your verification code is:',
    code,
    expiresInMinutes,
    footer: "If you didn't create a MovieX account, you can ignore this email.",
  });
}

function buildResetText(code: string, expiresInMinutes: number): string {
  return [
    'Use this code to reset your MovieX password:',
    '',
    code,
    '',
    `This code expires in ${expiresInMinutes} minutes.`,
    "If you didn't request a password reset, you can ignore this email — " +
      'your password has not been changed.',
  ].join('\n');
}

function buildResetHtml(code: string, expiresInMinutes: number): string {
  return buildCodeHtml({
    lead: 'Use this code to reset your password:',
    code,
    expiresInMinutes,
    /*
     * Deliberately more than "ignore this". Someone receiving this email
     * unprompted needs to know that a reset was *requested* against their
     * address and that nothing has actually changed yet — "ignore this" alone
     * leaves them unsure whether their account is already lost.
     */
    footer:
      "If you didn't request a password reset, you can ignore this email — " +
      'your password has not been changed.',
  });
}

/**
 * Inline styles and a table-free single column: every meaningful email client
 * strips `<style>` blocks, and several ignore flexbox. Colours are literal hex
 * rather than the app's `--mx-*` tokens because an email has no stylesheet to
 * resolve a variable against.
 */
function buildCodeHtml({
  lead,
  code,
  expiresInMinutes,
  footer,
}: {
  lead: string;
  code: string;
  expiresInMinutes: number;
  footer: string;
}): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;color:#18181b">
  <p style="margin:0 0 24px;font-size:16px;font-weight:600">Movie<span style="color:#e24b4a">X</span></p>
  <p style="margin:0 0 8px;font-size:15px">${lead}</p>
  <p style="margin:0 0 20px;font-size:32px;font-weight:600;letter-spacing:8px">${code}</p>
  <p style="margin:0 0 8px;font-size:13px;color:#52525b">This code expires in ${expiresInMinutes} minutes.</p>
  <p style="margin:0;font-size:13px;color:#71717a">${footer}</p>
</div>`;
}
