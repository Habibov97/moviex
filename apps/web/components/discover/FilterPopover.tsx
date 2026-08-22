"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

/**
 * React warns when `useLayoutEffect` runs during server rendering, and every
 * client component in this app is server-rendered for the initial HTML. The
 * measurement below has to happen before paint, so it stays a layout effect in
 * the browser and degrades to `useEffect` on the server, where it never runs.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Breathing room kept between a flipped panel and the viewport edge. */
const VIEWPORT_MARGIN = 8;

/**
 * Trigger chip + floating panel, with the open/close plumbing both filter
 * popovers share.
 *
 * Deliberately *not* the genre chip: those are one-click toggles that commit
 * immediately, while these hold draft state and commit only on "Apply". The
 * shell owns nothing but visibility — `onOpenChange` lets each filter reseed
 * its draft from the URL whenever it opens, so a discarded draft never leaks
 * into the next open.
 *
 * Closing by outside-click or Escape simply unmounts the panel; because the
 * draft lives in the caller and is reseeded on open, that discards it.
 *
 * The panel is **edge-collision aware**: it hangs from the trigger's left edge
 * unless that would overflow the viewport, in which case it flips to the right.
 * Fixing it here covers every caller at once — Discover's year, rating and sort
 * chips and My List's sort control are all this same shell.
 */
export type FilterPopoverProps = {
  /** Chip text, e.g. "2015 – 2026" or "Rating". */
  label: string;
  icon: React.ReactNode;
  /** Accent border on the chip while a filter is applied. */
  isActive: boolean;
  /** Panel width; the two filters differ (280px vs 260px). */
  panelClassName?: string;
  /** `open` is the new state — used to reseed draft state on open. */
  onOpenChange?: (open: boolean) => void;
  /** Receives a `close` callback so "Apply" can dismiss the panel. */
  children: (close: () => void) => React.ReactNode;
};

export function FilterPopover({
  label,
  icon,
  isActive,
  panelClassName,
  onOpenChange,
  children,
}: FilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  /**
   * Which edge of the trigger the panel hangs from. Left by default; flipped
   * to the right only when left-aligning would run past the viewport.
   */
  const [align, setAlign] = useState<"left" | "right">("left");
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const setOpen = (open: boolean) => {
    /*
     * Reset before every open so the measurement below always runs against the
     * default alignment. A panel left flipped from a previous open would
     * measure as fitting and could never flip back after a resize.
     */
    if (open) setAlign("left");
    setIsOpen(open);
    onOpenChange?.(open);
  };

  /*
   * Edge collision. The panel is a fixed width anchored to the trigger, so one
   * sitting near the right edge — My List's sort control lives at `ml-auto`,
   * and Discover's filter row wraps it there on a narrow screen — used to open
   * straight off the side of the window.
   *
   * Measured rather than guessed: each caller sets its own panel width via
   * `panelClassName`, so the only reliable number is the rendered one. This
   * runs before paint, so the flip is never visible.
   */
  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;

    const panel = panelRef.current;
    if (!panel) return;

    // `clientWidth` of the root element excludes the scrollbar, which is the
    // edge the panel actually has to clear.
    const limit = document.documentElement.clientWidth - VIEWPORT_MARGIN;
    if (panel.getBoundingClientRect().right > limit) setAlign("right");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    // `mousedown`, not `click`: a click that starts inside and ends outside
    // (dragging a slider thumb past the panel edge) must not close the panel.
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const Chevron = isOpen ? IconChevronUp : IconChevronDown;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={isOpen ? panelId : undefined}
        className={cn(
          "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] border-[0.5px] bg-mx-chip-alt px-3 text-[13px] outline-none transition-colors focus-visible:border-mx-accent",
          isActive
            ? "border-mx-accent text-mx-fg"
            : "border-mx-border-subtle text-mx-fg-muted hover:text-mx-fg",
        )}
      >
        {icon}
        {label}
        <Chevron className="size-3.5" stroke={1.75} />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute top-full z-30 mt-2 rounded-[12px] border-[0.5px] border-mx-border bg-mx-card p-[18px] shadow-lg",
            // Last resort for a viewport narrower than the panel itself, where
            // neither edge can hold it — clamp instead of overflowing.
            "max-w-[calc(100vw-1rem)]",
            align === "right" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children(() => setIsOpen(false))}
        </div>
      )}
    </div>
  );
}

/** Equal-width Reset / Apply pair closing both panels. */
export function PopoverActions({
  onReset,
  onApply,
}: {
  onReset: () => void;
  onApply: () => void;
}) {
  const t = useTranslations("discover");

  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        type="button"
        onClick={onReset}
        className="h-9 flex-1 rounded-[8px] border-[0.5px] border-mx-border bg-transparent text-[13px] text-mx-fg-muted outline-none transition-colors hover:text-mx-fg focus-visible:border-mx-accent"
      >
        {t("reset")}
      </button>
      <button
        type="button"
        onClick={onApply}
        className="h-9 flex-1 rounded-[8px] bg-mx-accent text-[13px] font-medium text-mx-on-accent outline-none transition-colors hover:bg-mx-accent-hover focus-visible:border-mx-accent"
      >
        {t("apply")}
      </button>
    </div>
  );
}

/** Panel heading + one line of help text, identical in both popovers. */
export function PopoverHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-[12.5px] font-medium text-mx-fg">{title}</h2>
      <p className="mt-1 text-[11px] text-mx-fg-faint">{subtitle}</p>
    </div>
  );
}

export default FilterPopover;
