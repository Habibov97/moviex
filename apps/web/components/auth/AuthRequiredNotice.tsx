"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { IconLock, IconX } from "@tabler/icons-react";

import { LoginRegisterModal } from "@/components/auth/LoginRegisterModal";

export type AuthRequiredNoticeProps = {
  isOpen: boolean;
  /** Short heading, e.g. "Sign in to see your list". */
  title: string;
  /** One or two sentences saying what is behind the sign-in. */
  message: string;
  /** Proceed: the caller opens the real `LoginRegisterModal`. */
  onSignIn: () => void;
  /** Close button, backdrop click or Escape. */
  onDismiss: () => void;
};

/**
 * A small "you need to be signed in" notice — **not** the login form.
 *
 * It sits in front of `LoginRegisterModal` rather than replacing it: clicking a
 * gated link now says *why* first, and only a deliberate "Sign in" summons the
 * full form. Asking someone who clicked "My list" out of curiosity to face a
 * complete auth form is a bigger jump than the click implied.
 *
 * **Freely dismissible**, unlike the modal's `saveCode` view — close button,
 * backdrop and Escape all work, because nothing is lost by leaving. That view
 * is the deliberate exception in this app; this is the ordinary case.
 *
 * Visually it is `LoginRegisterModal`'s shell at a smaller size and nothing
 * new: same `bg-mx-backdrop`, the same `rounded-[14px]` `bg-mx-card` panel with
 * a hairline border, the same accent button, and the 52px lock badge the old
 * `SignInRequired` used. No new tokens, no new design.
 */
export function AuthRequiredNotice({
  isOpen,
  title,
  message,
  onSignIn,
  onDismiss,
}: AuthRequiredNoticeProps) {
  const t = useTranslations("auth");

  /*
   * Escape plus the body scroll lock, on the same open/closed lifetime — the
   * same pair `LoginRegisterModal` keeps, and for the same reason: it is a
   * modal dialog, so the page behind it should not scroll away underneath.
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onDismiss]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-mx-backdrop p-4 font-mx"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-notice-title"
        aria-describedby="auth-notice-message"
        // Clicks inside the panel must never reach the backdrop's handler.
        onClick={(event) => event.stopPropagation()}
        className="animate-in fade-in zoom-in-95 relative my-auto w-full max-w-[320px] rounded-[14px] border-[0.5px] border-mx-border bg-mx-card p-5 text-center duration-150"
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("close")}
          className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-[8px] text-mx-fg-faint outline-none transition-colors hover:text-mx-fg focus-visible:text-mx-fg"
        >
          <IconX className="size-4" stroke={1.75} />
        </button>

        <div className="flex flex-col items-center">
          <span
            aria-hidden="true"
            className="flex size-[52px] items-center justify-center rounded-[14px] border-[0.5px] border-mx-border-subtle bg-mx-chip"
          >
            {/*
              `text-mx-page-meta` — dimmer than the `-faint` icon the empty
              states use, which is what the reference draws for a locked state.
            */}
            <IconLock className="size-6 text-mx-page-meta" stroke={1.5} />
          </span>

          <h2
            id="auth-notice-title"
            className="mt-5 text-[15px] font-medium text-mx-fg"
          >
            {title}
          </h2>
          <p
            id="auth-notice-message"
            className="mt-2 max-w-[300px] text-[12.5px] leading-[1.6] text-mx-fg-subtle"
          >
            {message}
          </p>

          <button
            type="button"
            onClick={onSignIn}
            autoFocus
            className="mt-6 inline-flex items-center rounded-[8px] bg-mx-accent px-5 py-[9px] text-[12px] font-medium text-mx-on-accent outline-none transition-colors hover:bg-mx-accent-hover focus-visible:underline"
          >
            {t("signIn")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The notice → modal handoff, owned in one place.
 *
 * Both triggers — the navbar's gated "My list" click and Discover's arrival
 * after a `/my-list` redirect — want the identical two-step flow, so the state
 * machine lives here rather than being wired up twice. Returns `element` for
 * the caller to drop into its own tree, the same shape `useLibraryActions`
 * already uses for its modal, because a hook cannot render.
 *
 * Three stages, and only one surface is mounted at a time: `idle` → `notice`
 * (this component) → `modal` (the real `LoginRegisterModal`, on its login
 * view). Dismissing either returns to `idle`.
 */
export function useAuthRequiredNotice({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const [stage, setStage] = useState<"idle" | "notice" | "modal">("idle");

  /*
   * Stable identities. `AuthRequiredNotice` binds Escape and the body scroll
   * lock in an effect keyed on `onDismiss`, so a fresh arrow every render would
   * tear both down and rebuild them on any unrelated re-render of the caller —
   * the navbar re-renders on every route change. `LoginRegisterModal` solves
   * the same problem with a ref; here the callbacks are ours to make stable.
   */
  const show = useCallback(() => setStage("notice"), []);
  const openModal = useCallback(() => setStage("modal"), []);
  const close = useCallback(() => setStage("idle"), []);

  return {
    /** Open the notice. Callers apply their own auth check before calling. */
    show,
    element: (
      <>
        <AuthRequiredNotice
          isOpen={stage === "notice"}
          title={title}
          message={message}
          onSignIn={openModal}
          onDismiss={close}
        />
        <LoginRegisterModal
          isOpen={stage === "modal"}
          onClose={close}
          defaultMode="login"
        />
      </>
    ),
  };
}

export default AuthRequiredNotice;
