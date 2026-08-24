"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type {
  AuthErrorCode,
  ForgotPasswordInput,
  ForgotPasswordResponse,
  LoginInput,
  OtpChallenge,
  OtpChallengeResponse,
  RegisterInput,
  ResendOtpInput,
  ResetPasswordInput,
  ResetPasswordResponse,
  VerifyOtpInput,
  VerifyResetOtpInput,
  VerifyResetOtpResponse,
} from "@moviex/shared-types";

import { API_BASE_URL } from "@/lib/api";
import { CURRENT_USER_QUERY_KEY } from "@/hooks/use-current-user";
import { USER_MOVIES_KEY } from "@/hooks/use-user-movies";

/**
 * Auth mutations against the real endpoints.
 *
 * Request bodies are validated by the zod schemas in `@moviex/shared-types`
 * before they get here, so these only do transport and error shaping.
 */

/**
 * An error whose `message` is safe to render.
 *
 * Everything thrown here carries curated, **translated** copy from the `auth`
 * namespace — the backend's own text is only used where it is already
 * user-appropriate. Raw upstream messages and stack detail never reach the UI.
 */
export class AuthError extends Error {
  /**
   * The API's machine-readable reason, when it gave one.
   *
   * Callers branch on this rather than on the rendered message — an unverified
   * address and a wrong password are both "the login failed", but one of them
   * has to move the user to the OTP screen instead of showing an error at all.
   */
  readonly code?: AuthErrorCode;
  /** Seconds to wait, on `OTP_RESEND_COOLDOWN`. */
  readonly retryAfterSeconds?: number;

  constructor(message: string, payload?: NestErrorBody) {
    super(message);
    this.code = payload?.code;
    this.retryAfterSeconds = payload?.retryAfterSeconds;
  }
}

/** The envelope Nest returns for a failed request. */
type NestErrorBody = {
  message?: string | string[];
  error?: string;
  code?: AuthErrorCode;
  retryAfterSeconds?: number;
};

/** Just enough of next-intl's translator for the shapers below. */
type Translate = (key: string) => string;

async function readError(response: Response): Promise<NestErrorBody> {
  try {
    return (await response.json()) as NestErrorBody;
  } catch {
    return {};
  }
}

/**
 * Shared transport.
 *
 * `credentials: "include"` on every call: login's whole job is to set an
 * httpOnly cookie, and the browser only stores it when the request opts in.
 *
 * `t` is threaded in rather than looked up here because this is a plain
 * function, not a hook — the translator has to come from the calling hook's
 * render.
 */
async function postAuth<T>(
  path: string,
  body: unknown,
  t: Translate,
  toMessage: (status: number, payload: NestErrorBody) => string,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Network-level failure — the API is down or unreachable.
    throw new AuthError(t("networkError"));
  }

  if (!response.ok) {
    const payload = await readError(response);
    // The payload rides along so the error keeps its `code` — the message is
    // for the user, the code is for the caller.
    throw new AuthError(toMessage(response.status, payload), payload);
  }

  return (await response.json()) as T;
}

/**
 * Cache hygiene for a newly established session, shared by the two endpoints
 * that can establish one.
 *
 * Order matters: drop whatever the previous account left cached *before*
 * announcing the new session, so nothing re-reads a stale per-user list in
 * between. Prefix match, so it reaches every `['user-movies', <id>, …]` key
 * beneath the root.
 */
function useSessionEstablished() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.removeQueries({ queryKey: USER_MOVIES_KEY });
    void queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
  };
}

export function useLoginMutation() {
  const t = useTranslations("auth");
  const onSessionEstablished = useSessionEstablished();

  return useMutation({
    mutationKey: ["auth", "login"],
    mutationFn: async (input: LoginInput) => {
      /*
       * `rememberMe` now goes on the wire — it is what picks the session
       * length server-side. It used to be stripped here because `LoginDto`
       * did not declare it and the API's global `forbidNonWhitelisted` turned
       * it into a 400; the DTO accepts it now, so anything else in this body
       * still would.
       */
      return postAuth<{ status: string; user: unknown }>(
        "/auth/login",
        {
          email: input.email,
          password: input.password,
          rememberMe: input.rememberMe,
        },
        t,
        (status, payload) => {
          /*
           * 403 + EMAIL_NOT_VERIFIED is not a failed login, it is an unfinished
           * signup. The caller reads `error.code` and moves to the OTP view, so
           * this text is a fallback that should not normally be seen.
           */
          if (payload.code === "EMAIL_NOT_VERIFIED") {
            return t("emailNotVerified");
          }

          return status === 401 || status === 400
            ? t("invalidCredentials")
            : t("genericError");
        },
      );
    },
    // The cookie is set; re-read the session so the navbar and every gated
    // button flip immediately, with no reload.
    onSuccess: onSessionEstablished,
  });
}

/**
 * Creates the account. **Does not sign the user in.**
 *
 * The account starts unverified and the backend emails a code; the session is
 * established later by `useVerifyOtpMutation`. This used to be followed by an
 * immediate `/auth/login`, which is exactly what the verification gate exists
 * to prevent — holding the password is no longer enough.
 */
export function useSignupMutation() {
  const t = useTranslations("auth");

  return useMutation({
    mutationKey: ["auth", "signup"],
    mutationFn: async (input: RegisterInput) => {
      /*
       * Field mapping matters: the route is `/auth/signup` (not `/register`),
       * and `RegisterDto` wants `userName`, not `name`. `confirmPassword` is
       * client-side only and would be rejected as an unknown property.
       */
      return postAuth<OtpChallengeResponse>(
        "/auth/signup",
        {
          userName: input.name,
          email: input.email,
          password: input.password,
        },
        t,
        (status, payload) => {
          /*
           * The backend answers a duplicate account with 404
           * ("User already exists"), not the more usual 409 — match on the
           * status it actually returns.
           */
          if (status === 404 || status === 409) {
            return t("emailTaken");
          }

          /*
           * Nest's ValidationPipe returns an array of field messages. They are
           * written for humans but only exist in English — the API has no
           * notion of the caller's language — so they are surfaced as-is
           * rather than being faked into a translation. The client-side zod
           * schemas catch the same rules first and *are* translated, so this
           * path is a backstop, not the normal one.
           */
          if (status === 400 && payload.message) {
            return Array.isArray(payload.message)
              ? payload.message.join(". ")
              : payload.message;
          }

          return t("genericError");
        },
      );
    },
  });
}

/**
 * Submits the emailed code. **This is what signs the user in** — the response
 * sets the same httpOnly cookie a password login does, so the success path is
 * identical to `useLoginMutation`'s and the modal only has to close.
 */
export function useVerifyOtpMutation() {
  const t = useTranslations("auth");
  const onSessionEstablished = useSessionEstablished();

  return useMutation({
    mutationKey: ["auth", "verify-otp"],
    mutationFn: async (input: VerifyOtpInput) => {
      return postAuth<{ status: string; user: unknown }>(
        "/auth/verify-otp",
        input,
        t,
        (_status, payload) => {
          /*
           * Branch on the code, never the status: expired and mistyped are both
           * 400 and need different copy — one says "check the digits", the
           * other says "that email is stale, get a new one".
           */
          switch (payload.code) {
            case "OTP_EXPIRED":
              return t("otpExpired");
            case "OTP_TOO_MANY_ATTEMPTS":
              return t("otpTooManyAttempts");
            case "OTP_INVALID":
              return t("otpInvalid");
            default:
              return t("genericError");
          }
        },
      );
    },
    onSuccess: onSessionEstablished,
  });
}

/** The response shape when there was nothing left to verify. */
type AlreadyVerifiedResponse = { status: "already_verified"; message: string };

export type ResendOtpResult = OtpChallengeResponse | AlreadyVerifiedResponse;

/**
 * Requests a fresh code.
 *
 * Also the recovery path from a lockout: issuing a new code resets the server's
 * attempt counter, so this is genuinely the way out rather than advice that
 * changes nothing.
 *
 * A 429 is **not** a failure to hide — the caller reads `retryAfterSeconds` off
 * the error to re-seed its countdown, which is how the cooldown stays accurate
 * across a page the user came back to.
 */
export function useResendOtpMutation() {
  const t = useTranslations("auth");

  return useMutation({
    mutationKey: ["auth", "resend-otp"],
    mutationFn: async (input: ResendOtpInput) => {
      return postAuth<ResendOtpResult>("/auth/resend-otp", input, t, (_s, payload) =>
        payload.code === "OTP_RESEND_COOLDOWN"
          ? t("otpResendCooldown")
          : t("genericError"),
      );
    },
  });
}

/**
 * Step 1 of a password reset: ask for a code.
 *
 * **Success here means nothing about the account.** The endpoint answers the
 * same way for an unknown address, an unverified one, and a real send, so this
 * resolving is not evidence a code was sent — the UI must say "if an account
 * exists…" rather than "check your inbox", or it re-opens client-side the
 * enumeration the server closed.
 *
 * Only transport and validation can fail, which is why there is no code-based
 * branch below.
 */
export function useForgotPasswordMutation() {
  const t = useTranslations("auth");

  return useMutation({
    mutationKey: ["auth", "forgot-password"],
    mutationFn: async (input: ForgotPasswordInput) => {
      return postAuth<ForgotPasswordResponse>(
        "/auth/forgot-password",
        { email: input.email },
        t,
        () => t("genericError"),
      );
    },
  });
}

/**
 * Step 2: submit the code and receive the reset token.
 *
 * **Establishes no session**, unlike `useVerifyOtpMutation` — so, deliberately,
 * no `onSessionEstablished`. Nothing about the signed-in user has changed and
 * invalidating `['auth','me']` here would claim otherwise.
 *
 * The token in the response is transient: the caller holds it in component
 * state for the length of the next request and never persists it.
 */
export function useVerifyResetOtpMutation() {
  const t = useTranslations("auth");

  return useMutation({
    mutationKey: ["auth", "verify-reset-otp"],
    mutationFn: async (input: VerifyResetOtpInput) => {
      return postAuth<VerifyResetOtpResponse>(
        "/auth/verify-reset-otp",
        input,
        t,
        (_status, payload) => {
          // Same three outcomes as email verification — including a code that
          // was issued for that other flow, which comes back as OTP_INVALID.
          switch (payload.code) {
            case "OTP_EXPIRED":
              return t("otpExpired");
            case "OTP_TOO_MANY_ATTEMPTS":
              return t("otpTooManyAttempts");
            case "OTP_INVALID":
              return t("otpInvalid");
            default:
              return t("genericError");
          }
        },
      );
    },
  });
}

/**
 * Step 3: set the new password.
 *
 * Also establishes no session — the user is sent back to the login form to sign
 * in with what they just chose.
 */
export function useResetPasswordMutation() {
  const t = useTranslations("auth");

  return useMutation({
    mutationKey: ["auth", "reset-password"],
    mutationFn: async (input: ResetPasswordInput) => {
      return postAuth<ResetPasswordResponse>(
        "/auth/reset-password",
        input,
        t,
        (status, payload) => {
          if (payload.code === "RESET_TOKEN_INVALID") {
            return t("resetTokenExpired");
          }

          /*
           * The DTO's password rules, as Nest's field messages. English-only —
           * same backstop as signup, and the client-side `passwordSchema` check
           * catches these first and *is* translated, so this should not
           * normally be reached.
           */
          if (status === 400 && payload.message) {
            return Array.isArray(payload.message)
              ? payload.message.join(". ")
              : payload.message;
          }

          return t("genericError");
        },
      );
    },
  });
}

/** Narrows a resend result to the case that actually issued a code. */
export function isChallenge(
  result: ResendOtpResult,
): result is OtpChallengeResponse {
  return result.status === "pending_verification";
}

export type { OtpChallenge };
