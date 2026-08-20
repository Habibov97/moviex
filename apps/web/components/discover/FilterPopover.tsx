"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { DISCOVER_COPY } from "@/lib/constants/discover";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const setOpen = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

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
          id={panelId}
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute top-full left-0 z-30 mt-2 rounded-[12px] border-[0.5px] border-mx-border bg-mx-card p-[18px] shadow-lg",
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
  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        type="button"
        onClick={onReset}
        className="h-9 flex-1 rounded-[8px] border-[0.5px] border-mx-border bg-transparent text-[13px] text-mx-fg-muted outline-none transition-colors hover:text-mx-fg focus-visible:border-mx-accent"
      >
        {DISCOVER_COPY.reset}
      </button>
      <button
        type="button"
        onClick={onApply}
        className="h-9 flex-1 rounded-[8px] bg-mx-accent text-[13px] font-medium text-mx-on-accent outline-none transition-colors hover:bg-mx-accent-hover focus-visible:border-mx-accent"
      >
        {DISCOVER_COPY.apply}
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
