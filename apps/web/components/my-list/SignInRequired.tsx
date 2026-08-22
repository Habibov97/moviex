"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { IconLock } from "@tabler/icons-react";

import { LoginRegisterModal } from "@/components/auth/LoginRegisterModal";

/**
 * What `/my-list` shows a signed-out visitor.
 *
 * This replaced a silent `router.replace` to Discover: bouncing someone to a
 * different page with no explanation reads as a broken link, and it threw away
 * the one moment where signing up has an obvious payoff. Staying put and
 * saying why is both clearer and the better prompt.
 *
 * **No redirect and no reload after signing in.** The modal's success path
 * invalidates `['auth','me']`, `MyListView` re-reads `useCurrentUser`, and this
 * component simply stops being rendered — the same way every other
 * auth-dependent surface in the app updates.
 *
 * Geometry is the shared "centered state" treatment: a 52px badge, a 15px
 * heading and a 300px-wide 12.5px body, matching My List's own empty state and
 * `ErrorState`.
 */
export function SignInRequired() {
  const t = useTranslations("myList");
  const tAuth = useTranslations("auth");

  const [authOpen, setAuthOpen] = useState(false);
  /*
   * Which view the modal opens on. Set together with `authOpen`, so React
   * commits both in one render and `LoginRegisterModal` reads the new value in
   * the same open — it latches `defaultMode` on the closed→open transition.
   */
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const open = (mode: "login" | "register") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (
    <>
      <div className="flex flex-col items-center px-4 pt-14 pb-[60px] text-center font-mx">
        <span
          aria-hidden="true"
          className="flex size-[52px] items-center justify-center rounded-[14px] border-[0.5px] border-mx-border-subtle bg-mx-chip"
        >
          {/*
            `text-mx-page-meta` is the token carrying #5f5f68 in dark — dimmer
            than the `-faint` icon the neighbouring empty states use, which is
            what the reference draws for a locked, inert state.
          */}
          <IconLock className="size-6 text-mx-page-meta" stroke={1.5} />
        </span>

        <h2 className="mt-5 text-[15px] font-medium text-mx-fg">
          {t("signInTitle")}
        </h2>
        <p className="mt-2 max-w-[300px] text-[12.5px] leading-[1.6] text-mx-fg-subtle">
          {t("signInBody")}
        </p>

        <button
          type="button"
          onClick={() => open("login")}
          className="mt-6 inline-flex items-center rounded-[8px] bg-mx-accent px-5 py-[9px] text-[12px] font-medium text-mx-on-accent outline-none transition-colors hover:bg-mx-accent-hover focus-visible:underline"
        >
          {tAuth("signIn")}
        </button>

        <p className="mt-3 text-[12px] text-mx-fg-subtle">
          {t("noAccount")}{" "}
          <button
            type="button"
            onClick={() => open("register")}
            className="font-medium text-mx-accent outline-none transition-colors hover:text-mx-accent-hover focus-visible:underline"
          >
            {tAuth("signUp")}
          </button>
        </p>
      </div>

      <LoginRegisterModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultMode={authMode}
      />
    </>
  );
}

export default SignInRequired;
