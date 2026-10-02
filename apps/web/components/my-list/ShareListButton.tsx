"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  IconCheck,
  IconCopy,
  IconLink,
  IconShare,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { useListShare, useSetListShare } from "@/hooks/use-user-movies";
import { sharedListHref } from "@/lib/constants/shared-list";

/** How long "Link copied" stays before the button reverts. */
const COPIED_FEEDBACK_MS = 2000;

/**
 * My List's "Share list" control: a button plus a small panel that creates,
 * shows, copies and revokes the public link to this list.
 *
 * Sharing is **off until the user turns it on**, from this panel, and the
 * panel says plainly who can see what. The link is a 128-bit token, so it is
 * private-by-obscurity — fine for "send it to a friend", and revocable here.
 *
 * **The copied URL carries no locale prefix** (`/shared/<token>`, not
 * `/tr/shared/<token>`). Everywhere else this app puts the locale in the URL
 * because it changes TMDB content; a shared list's entries are snapshots from
 * our own database, so the only thing the locale changes is the chrome — and
 * that should be in the *friend's* language, not the sharer's. The proxy
 * redirects the bare path to the friend's own detected locale.
 *
 * The panel shell and dismissal (outside `mousedown`/`touchstart`, Escape)
 * are copied from `SharePopover`, so the two read as the same object. The
 * trigger sits at the right edge of the heading row, so the panel hangs from
 * the right; the `max-w` clamp covers a viewport narrower than the panel.
 */
export function ShareListButton() {
  const t = useTranslations("myList");

  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

  // Fetched on first open rather than on every My List visit.
  const share = useListShare(isOpen);
  const setShare = useSetListShare();

  const close = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(
    () => () => {
      if (revertTimer.current) clearTimeout(revertTimer.current);
    },
    [],
  );

  /*
   * Built from `window.location.origin`, so it is right on the deployed host,
   * a Vercel preview and localhost alike. Only evaluated while the panel is
   * open, which never happens during server rendering.
   */
  const url =
    isOpen && share.token
      ? `${window.location.origin}${sharedListHref(share.token)}`
      : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (revertTimer.current) clearTimeout(revertTimer.current);
      revertTimer.current = setTimeout(
        () => setCopied(false),
        COPIED_FEEDBACK_MS,
      );
    } catch {
      // No clipboard outside a secure context (plain HTTP on a LAN IP). The
      // link is on screen under `select-all`, so one tap still selects it.
    }
  };

  const hasError = share.isError || setShare.isError;

  return (
    <div ref={containerRef} className="relative shrink-0 self-center">
      <button
        type="button"
        onClick={() => {
          setCopied(false);
          setIsOpen((open) => !open);
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={isOpen ? panelId : undefined}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-[8px] border-[0.5px] px-3 text-[12.5px] outline-none transition-colors focus-visible:border-mx-accent",
          isOpen
            ? "border-mx-accent text-mx-fg"
            : "border-mx-border text-mx-fg-muted hover:text-mx-fg",
        )}
      >
        <IconShare className="size-3.5" stroke={1.75} aria-hidden="true" />
        {t("share")}
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("shareTitle")}
          className="absolute top-full right-0 z-30 mt-2 w-[288px] max-w-[calc(100vw-2rem)] rounded-[12px] border-[0.5px] border-mx-border bg-mx-card p-[18px] shadow-lg md:w-[320px]"
        >
          <h2 className="text-[12.5px] font-medium text-mx-fg">
            {t("shareTitle")}
          </h2>
          <p className="mt-1.5 text-[12px] leading-[1.55] text-mx-fg-subtle">
            {t("shareBody")}
          </p>

          {share.isLoading ? (
            <p className="mt-3 text-[12px] text-mx-fg-faint">
              {t("shareLoading")}
            </p>
          ) : share.token ? (
            <>
              {/* A `<p>`, not an input — same reasons as `SharePopover`. */}
              <p className="mt-3 max-h-[4.5em] overflow-hidden rounded-[8px] border-[0.5px] border-mx-border bg-mx-field px-2.5 py-2 text-[12px] leading-[1.5] break-all text-mx-fg-muted select-all">
                {url}
              </p>

              <button
                type="button"
                onClick={copy}
                className={cn(
                  "mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-[8px] text-[13px] font-medium outline-none transition-colors focus-visible:border-mx-accent",
                  copied
                    ? "border-[0.5px] border-mx-border bg-mx-field text-mx-success"
                    : "bg-mx-accent text-mx-on-accent hover:bg-mx-accent-hover",
                )}
              >
                {copied ? (
                  <IconCheck className="size-4" stroke={2} aria-hidden="true" />
                ) : (
                  <IconCopy className="size-4" stroke={1.75} aria-hidden="true" />
                )}
                {copied ? t("shareCopied") : t("shareCopy")}
              </button>

              <button
                type="button"
                onClick={() => setShare.mutate(false)}
                disabled={setShare.isPending}
                className="mt-2 h-9 w-full rounded-[8px] border-[0.5px] border-mx-border bg-transparent text-[13px] text-mx-fg-muted outline-none transition-colors hover:text-mx-fg focus-visible:border-mx-accent disabled:opacity-60"
              >
                {t("shareStop")}
              </button>
              <p className="mt-2 text-[11px] leading-[1.5] text-mx-fg-faint">
                {t("shareStopHint")}
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShare.mutate(true)}
              disabled={setShare.isPending}
              className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-[8px] bg-mx-accent text-[13px] font-medium text-mx-on-accent outline-none transition-colors hover:bg-mx-accent-hover focus-visible:border-mx-accent disabled:opacity-60"
            >
              <IconLink className="size-4" stroke={1.75} aria-hidden="true" />
              {t("shareCreate")}
            </button>
          )}

          {hasError && (
            <p role="alert" className="mt-2.5 text-[12px] text-mx-accent">
              {t("shareError")}
            </p>
          )}

          <span role="status" aria-live="polite" className="sr-only">
            {copied ? t("shareCopied") : ""}
          </span>
        </div>
      )}
    </div>
  );
}

export default ShareListButton;
