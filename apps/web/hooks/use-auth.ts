"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type {
  AuthErrorCode,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  ResetPasswordResponse,
  SignupResponse,
  VerifyRecoveryCodeInput,
  VerifyRecoveryCodeResponse,
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
   * Callers branch on this rather than on the rendered message — the reset flow
   * has to tell an expired token apart from a wrong recovery code, because one
   * sends the user back a step and the other does not.
   */
  readonly code?: AuthErrorCode;

  constructor(message: string, payload?: NestErrorBody) {
    super(message);
    this.code = payload?.code;
  }
}

/** The envelope Nest returns for a failed request. */
type NestErrorBody = {
  message?: string | string[];
  error?: string;
  code?: AuthErrorCode;
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
        (status) => {
          /*
           * There is no longer a third outcome here. Login used to be able to
           * fail with 403 `EMAIL_NOT_VERIFIED` — a correct password against an
           * account whose address had not been proven — which the caller
           * handled by moving to a code screen rather than showing an error.
           * With verification gone, a login either works or the credentials
           * are wrong.
           */
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
 * Creates the account **and signs the user in**, returning the one-time
 * recovery code.
 *
 * This used to create an unverified account that could not log in until an
 * emailed code was entered. That gate is gone — with no email there is nothing
 * to verify — so the API sets the session cookie on this response and the
 * caller runs the same cache hygiene login does.
 *
 * **The `recoveryCode` in the result is the only copy that will ever exist.**
 * It is handed straight to the view that displays it and is never stored,
 * logged, or written to any cache. Note it is deliberately *not* put in a query
 * cache for the same reason — a mutation result lives exactly as long as the
 * component holding it.
 */
export function useSignupMutation() {
  const t = useTranslations("auth");
  const onSessionEstablished = useSessionEstablished();

  return useMutation({
    mutationKey: ["auth", "signup"],
    mutationFn: async (input: RegisterInput) => {
      /*
       * Field mapping matters: the route is `/auth/signup` (not `/register`),
       * and `RegisterDto` wants `userName`, not `name`. `confirmPassword` is
       * client-side only and would be rejected as an unknown property.
       */
      return postAuth<SignupResponse>(
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
           * `RegisterDto`'s field messages, surfaced verbatim. English-only,
           * and the deliberate exception to the translation rule: the API has
           * no notion of the caller's language and faking one would be worse.
           * The client-side zod rules catch these first and *are* translated,
           * so this is a backstop.
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
    // The cookie is set on this response, exactly as it is at login, so the
    // navbar and every gated button flip without a reload.
    onSuccess: onSessionEstablished,
  });
}

/**
 * Step 1 of the password reset: exchange the recovery code for a reset token.
 *
 * Establishes **no session** — the token is not a cookie and authenticates
 * nothing but the single `reset-password` call it was minted for, so
 * invalidating `['auth','me']` here would claim otherwise.
 *
 * The token in the response is transient: the caller holds it in component
 * state for the length of the next request and never persists it.
 */
export function useVerifyRecoveryCodeMutation() {
  const t = useTranslations("auth");

  return useMutation({
    mutationKey: ["auth", "verify-recovery-code"],
    mutationFn: async (input: VerifyRecoveryCodeInput) => {
      return postAuth<VerifyRecoveryCodeResponse>(
        "/auth/verify-recovery-code",
        input,
        t,
        (status, payload) => {
          if (payload.code === "RECOVERY_CODE_INVALID") {
            return t("recoveryCodeInvalid");
          }

          /*
           * The endpoint's own 429 has no `code`, unlike the module's other
           * ones — it is the throttler's generic body. Worth its own message
           * here rather than falling through to the generic error, because
           * "you have tried too many times, wait a minute" is actionable and
           * "something went wrong" is not. This limit is low (5/min) precisely
           * because it is the only thing rate-limiting recovery-code guesses.
           */
          if (status === 429) {
            return t("tooManyAttempts");
          }

          return t("genericError");
        },
      );
    },
  });
}

/**
 * Step 2 of the password reset: set the new password.
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
