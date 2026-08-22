"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { IconPlugConnectedX, IconRefresh } from "@tabler/icons-react";

export type ErrorStateProps = {
  /** Page-specific wording; the body text is the same everywhere. */
  title: string;
  /** The error Next.js handed the boundary. Logged, never shown. */
  error: Error & { digest?: string };
  /**
   * Next's `reset` — re-renders the segment and re-runs the Server Component's
   * fetch. Deliberately not `window.location.reload()`, which would throw away
   * client state and reload every other segment too.
   */
  reset: () => void;
};

/**
 * What a route renders when its Server Component throws — in practice, when
 * `lib/api.ts` cannot reach the API.
 *
 * Shared by every `error.tsx` so the treatment stays identical; only the
 * heading differs per route, which is why the title arrives as a prop already
 * translated by the boundary.
 */
export function ErrorState({ title, error, reset }: ErrorStateProps) {
  const t = useTranslations("errors");

  useEffect(() => {
    // The user gets the friendly copy; the real cause goes to the console so a
    // failure is still diagnosable. `error.message` is never rendered — it can
    // carry internal hostnames and stack detail.
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center px-4 pt-14 pb-[60px] text-center font-mx sm:px-6">
      <span
        aria-hidden="true"
        className="flex size-[52px] items-center justify-center rounded-[14px] border-[0.5px] border-mx-border-subtle bg-mx-chip"
      >
        <IconPlugConnectedX className="size-6 text-mx-accent" stroke={1.5} />
      </span>

      <h1 className="mt-5 text-[15px] font-medium text-mx-fg">{title}</h1>

      <p className="mt-2 max-w-[320px] text-[12.5px] leading-[1.6] text-mx-fg-subtle">
        {t("body")}
      </p>

      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-[8px] bg-mx-accent px-5 py-[9px] text-[12px] font-medium text-mx-on-accent outline-none transition-colors hover:bg-mx-accent-hover focus-visible:underline"
      >
        <IconRefresh className="size-4" stroke={1.75} aria-hidden="true" />
        {t("tryAgain")}
      </button>
    </div>
  );
}

export default ErrorState;
