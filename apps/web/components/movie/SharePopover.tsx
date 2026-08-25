"use client";

import { useEffect, useLayoutEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { IconCheck, IconCopy, IconShare } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

/**
 * React warns when `useLayoutEffect` runs during server rendering, and every
 * client component here is server-rendered for the initial HTML. The
 * measurement below has to happen before paint, so it stays a layout effect in
 * the browser and degrades to `useEffect` on the server, where it never runs.
 *
 * Same shim, same reason, as `components/discover/FilterPopover.tsx`.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Breathing room kept between a flipped panel and the viewport edge. */
const VIEWPORT_MARGIN = 8;

/** How long "Link copied" stays before the button reverts to "Copy". */
const COPIED_FEEDBACK_MS = 2000;

/**
 * The movie detail page's share control: the square icon button plus a small
 * popover showing this page's link and a button to copy it.
 *
 * **Deliberately just the link.** No Web Share API, no per-network buttons —
 * the sheet `navigator.share` opens is the platform's, not ours, and it is
 * absent on most desktops, so it would mean two different interactions for the
 * same button. One popover behaves the same everywhere.
 *
 * **The URL is read from `window.location.href` at the moment the popover
 * opens, never assembled.** This app is served through a `/moviex` base path
 * under a locale prefix (`habiboff.cc/moviex/tr/movie/603`), so anything built
 * from the route alone would have to reproduce both, and would be wrong the
 * next time either changes. The address bar already knows the answer.
 *
 * It is **not** `FilterPopover`, whose trigger is a labelled chip with a
 * chevron baked in — this one is a square icon button in the action row. The
 * dismiss handling and the panel's own classes are copied from there on
 * purpose so the two look and behave alike; if that shell ever grows a custom
 * trigger, this should fold into it.
 */
export type SharePopoverProps = {
  /** Merged onto the trigger button — the action row positions it with `ml-auto`. */
  className?: string;
};

export function SharePopover({ className }: SharePopoverProps) {
  const t = useTranslations("detail");

  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  /**
   * Which edge of the trigger the panel hangs from.
   *
   * **Right by default, the opposite of `FilterPopover`'s left**, because this
   * trigger is itself right-aligned: the action row parks it at `ml-auto`, so
   * left-anchoring would send the panel off the side of the window on every
   * single open. The collision check below is the same idea mirrored — flip to
   * the left edge only if hanging right would run past the viewport's left.
   */
  const [align, setAlign] = useState<"left" | "right">("right");

  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

  const close = () => setIsOpen(false);

  const open = () => {
    /*
     * Read the address bar here rather than in an effect: it is the value at
     * the moment of the click, and it keeps the panel's first render correct
     * instead of flashing an empty box. Safe from any hydration concern too,
     * since nothing reaches this before a user gesture.
     */
    setUrl(window.location.href);
    setCopied(false);
    // Reset before measuring, or a panel left flipped from a previous open
    // would measure as fitting and could never flip back after a resize.
    setAlign("right");
    setIsOpen(true);
  };

  /*
   * Edge collision, measured rather than guessed — the panel's width is a
   * responsive class, so the only reliable number is the rendered one. Runs
   * before paint, so the flip is never visible.
   */
  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;

    const panel = panelRef.current;
    if (!panel) return;

    if (panel.getBoundingClientRect().left < VIEWPORT_MARGIN) setAlign("left");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    // `mousedown`, not `click` — the same convention the filter popovers, the
    // user menu and the language switcher all use.
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // The revert timer outlives a close, so it has to be cancelled on unmount.
  useEffect(() => () => {
    if (revertTimer.current) clearTimeout(revertTimer.current);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);

      setCopied(true);
      if (revertTimer.current) clearTimeout(revertTimer.current);
      revertTimer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      /*
       * `navigator.clipboard` needs a secure context — it is simply undefined
       * over plain HTTP on a LAN IP, which is how this app gets tested from a
       * phone. Failing quietly is right: the URL is sitting right there in the
       * panel under `select-all`, so one tap still selects the whole thing.
       */
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => (isOpen ? close() : open())}
        aria-label={t("share")}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={isOpen ? panelId : undefined}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[10px] border-[0.5px] outline-none transition-colors focus-visible:border-mx-accent md:size-[46px]",
          isOpen
            ? "border-mx-accent text-mx-fg"
            : "border-mx-border text-mx-fg-muted hover:text-mx-fg",
        )}
      >
        <IconShare className="size-4" stroke={1.75} />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={t("share")}
          className={cn(
            // Panel treatment lifted wholesale from `FilterPopover` so the two
            // read as the same object: same radius, border, surface, shadow.
            "absolute top-full z-30 mt-2 rounded-[12px] border-[0.5px] border-mx-border bg-mx-card p-[18px] shadow-lg",
            "w-[288px] md:w-[320px]",
            // Last resort for a viewport narrower than the panel itself, where
            // neither edge can hold it — clamp instead of overflowing.
            "max-w-[calc(100vw-1rem)]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <h2 className="text-[12.5px] font-medium text-mx-fg">{t("share")}</h2>

          {/*
            A `<p>`, not a read-only `<input>`. Two reasons: an input would be
            a single line the user has to scroll horizontally to read, and any
            field under 16px makes iOS zoom the page in on focus and never zoom
            back (see the iOS note in CLAUDE.md) — a constraint this box has no
            reason to inherit when it is not an editable field in the first
            place.

            `break-all` wraps mid-token, which a URL needs: it is one unbroken
            word, so ordinary wrapping would let it run straight out of the box
            on a narrow screen. `select-all` makes one tap select the whole
            thing, which is the manual fallback when the clipboard API is
            unavailable.
          */}
          <p className="mt-2.5 max-h-[4.5em] overflow-hidden rounded-[8px] border-[0.5px] border-mx-border bg-mx-field px-2.5 py-2 text-[12px] leading-[1.5] break-all text-mx-fg-muted select-all">
            {url}
          </p>

          <button
            type="button"
            onClick={copy}
            className={cn(
              "mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-[8px] text-[13px] font-medium outline-none transition-colors focus-visible:border-mx-accent",
              /*
               * Generic tokens for the confirmation, not the `mx-state-watched-*`
               * set — those mean "this film is watched" and borrowing them for
               * "copied" is the kind of drift that makes a token stop meaning
               * anything. `h-9` is fixed, so gaining a border shifts nothing.
               */
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

          {/* Polite, so it does not interrupt whatever is being read. */}
          <span role="status" aria-live="polite" className="sr-only">
            {copied ? t("shareCopied") : ""}
          </span>
        </div>
      )}
    </div>
  );
}

export default SharePopover;
