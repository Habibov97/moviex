"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { LoginInput, RegisterInput } from "@moviex/shared-types";

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
export class AuthError extends Error {}

/** The envelope Nest returns for a failed request. */
type NestErrorBody = { message?: string | string[]; error?: string };

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
    throw new AuthError(toMessage(response.status, await readError(response)));
  }

  return (await response.json()) as T;
}

export function useLoginMutation() {
  const t = useTranslations("auth");
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["auth", "login"],
    mutationFn: async (input: LoginInput) => {
      /*
       * Only email and password go on the wire. `rememberMe` is a client-side
       * concern and `LoginDto` does not declare it — with the API's global
       * `forbidNonWhitelisted`, sending it would be a 400.
       */
      return postAuth<{ status: string; user: unknown }>(
        "/auth/login",
        { email: input.email, password: input.password },
        t,
        (status) =>
          status === 401 || status === 400
            ? t("invalidCredentials")
            : t("genericError"),
      );
    },
    onSuccess: () => {
      /*
       * Drop any user-owned data still cached before the new session is
       * announced. Per-user query keys already stop one account reading
       * another's, but this covers the path that has no logout at all: a
       * session that simply expired, after which someone else signs in on the
       * same tab. Prefix match, so it reaches every per-user key beneath.
       */
      queryClient.removeQueries({ queryKey: USER_MOVIES_KEY });

      // The cookie is set; re-read the session so the navbar and every gated
      // button flip immediately, with no reload.
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    },
  });
}

/**
 * Creates the account. **Does not sign the user in** — the backend issues no
 * cookie here by design, so the caller has to follow up with a login.
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
      return postAuth<{ status: string; message: string }>(
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
