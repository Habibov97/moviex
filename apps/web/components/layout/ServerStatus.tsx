"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  IconCheck,
  IconLoader2,
  IconPlugConnectedX,
  IconX,
} from "@tabler/icons-react";

import { useServerStatus } from "@/hooks/use-server-status";

/** How long "Server is ready" stays up after a wake-up before it goes away. */
const READY_VISIBLE_MS = 3_000;

/**
 * A small pill at the bottom of the screen while the API is cold-starting.
 *
 * The API runs on Render's free tier, which sleeps after 15 minutes idle; the
 * keep-awake workflow normally prevents that, but GitHub's cron is best-effort.
 * When it slips, the first request waits ~30–50s, and without this a visitor
 * sees a skeleton that never resolves and reasonably concludes the site is
 * broken.
 *
 * **Renders nothing at all in the normal case.** A warm API answers the first
 * check before anything is shown, so this is invisible unless there is
 * something to explain. Three visible states:
 *
 * 1. waking — spinner and "this can take up to a minute";
 * 2. ready — a check mark for `READY_VISIBLE_MS`, then gone, and *only* after
 *    a visible wake-up (otherwise every page load would flash it);
 * 3. unavailable — the poll gave up; stays until dismissed.
 *
 * **What it cannot cover:** pages whose Server Components fetch from the API
 * (Discover, Search, movie detail) are blocked by the same cold start before
 * any HTML — this component included — reaches the browser. It helps on
 * client-rendered surfaces (My List, sign-in, the typeahead) and on the next
 * page once the first has loaded. The keep-awake cron is the actual fix.
 *
 * Mounted once from the layout; colours are `--mx-*` tokens, so it themes.
 */
export function ServerStatus() {
  const t = useTranslations("serverStatus");
  const status = useServerStatus();

  /*
   * Whether this page load ever showed the waking state — the "ready" pill is
   * only meaningful as the end of one. Set during render (React's pattern for
   * deriving from a previous render) rather than in an effect.
   */
  const [sawWaking, setSawWaking] = useState(false);
  if (status === "waking" && !sawWaking) setSawWaking(true);

  const [readyExpired, setReadyExpired] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (status !== "up" || !sawWaking) return;
    const id = setTimeout(() => setReadyExpired(true), READY_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [status, sawWaking]);

  let content: React.ReactNode = null;

  if (status === "waking") {
    content = (
      <>
        <IconLoader2
          className="size-4 shrink-0 text-mx-accent motion-safe:animate-spin"
          stroke={1.75}
          aria-hidden
        />
        <span>{t("waking")}</span>
      </>
    );
  } else if (status === "up" && sawWaking && !readyExpired) {
    content = (
      <>
        <IconCheck
          className="size-4 shrink-0 text-mx-success"
          stroke={2}
          aria-hidden
        />
        <span>{t("ready")}</span>
      </>
    );
  } else if (status === "unavailable" && !dismissed) {
    content = (
      <>
        <IconPlugConnectedX
          className="size-4 shrink-0 text-mx-accent"
          stroke={1.75}
          aria-hidden
        />
        <span>{t("unavailable")}</span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t("dismiss")}
          className="-mr-1.5 flex size-7 shrink-0 items-center justify-center rounded-[8px] text-mx-fg-faint outline-none transition-colors hover:text-mx-fg focus-visible:text-mx-fg"
        >
          <IconX className="size-4" stroke={1.75} />
        </button>
      </>
    );
  }

  return (
    /*
     * The live region is always mounted, empty or not: a screen reader only
     * announces changes to a region that already existed, so mounting it
     * together with its first message would be silent.
     */
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      {content && (
        <div className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full border-[0.5px] border-mx-border bg-mx-card px-4 py-2 font-mx text-[13px] text-mx-fg-muted shadow-lg">
          {content}
        </div>
      )}
    </div>
  );
}
