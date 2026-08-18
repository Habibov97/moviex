"use client";

import { useMutation } from "@tanstack/react-query";
import type { LoginInput, RegisterInput } from "@moviex/shared-types";

/**
 * Auth mutations. The request bodies are already validated by the zod schemas
 * in `@moviex/shared-types` before they reach here, so `mutationFn` only has to
 * do the transport once the backend is wired up.
 */

export function useLoginMutation() {
  return useMutation({
    mutationKey: ["auth", "login"],
    mutationFn: async (input: LoginInput) => {
      // TODO: connect to /auth/login
      void input;
      return null;
    },
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationKey: ["auth", "register"],
    mutationFn: async (input: RegisterInput) => {
      // TODO: connect to /auth/register
      void input;
      return null;
    },
  });
}
