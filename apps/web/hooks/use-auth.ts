"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LoginInput, RegisterInput } from "@moviex/shared-types";

import { API_BASE_URL } from "@/lib/api";
import { CURRENT_USER_QUERY_KEY } from "@/hooks/use-current-user";
import { AUTH_COPY } from "@/lib/constants/errors";

/**
 * Auth mutations against the real endpoints.
 *
 * Request bodies are validated by the zod schemas in `@moviex/shared-types`
 * before they get here, so these only do transport and error shaping.
 */

/**
 * An error whose `message` is safe to render.
 *
 * Everything thrown here carries curated copy — the backend's own text is only
 * used where it is already user-appropriate. Raw upstream messages and stack
 * detail never reach the UI.
 */
export class AuthError extends Error {}

/** TMDB-style envelope Nest returns for a failed request. */
type NestErrorBody = { message?: string | string[]; error?: string };

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
 */
async function postAuth<T>(
  path: string,
  body: unknown,
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
    throw new AuthError(AUTH_COPY.networkError);
  }

  if (!response.ok) {
    throw new AuthError(toMessage(response.status, await readError(response)));
  }

  return (await response.json()) as T;
}

export function useLoginMutation() {
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
        (status) =>
          status === 401 || status === 400
            ? AUTH_COPY.invalidCredentials
            : AUTH_COPY.genericError,
      );
    },
    onSuccess: () => {
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
        (status, payload) => {
          /*
           * The backend answers a duplicate account with 404
           * ("User already exists"), not the more usual 409 — match on the
           * status it actually returns.
           */
          if (status === 404 || status === 409) {
            return AUTH_COPY.emailTaken;
          }

          // Nest's ValidationPipe returns an array of field messages; they are
          // written for humans, so they are worth surfacing.
          if (status === 400 && payload.message) {
            return Array.isArray(payload.message)
              ? payload.message.join(". ")
              : payload.message;
          }

          return AUTH_COPY.genericError;
        },
      );
    },
  });
}
