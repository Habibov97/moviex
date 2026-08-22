"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { IconCalendar } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { useApplyFilters } from "@/hooks/use-filter-params";
import {
  FilterPopover,
  PopoverActions,
  PopoverHeader,
} from "@/components/discover/FilterPopover";
import {
  CURRENT_YEAR,
  EARLIEST_YEAR,
  YEAR_FROM_SEARCH_PARAM,
  YEAR_PRESETS,
  YEAR_TO_SEARCH_PARAM,
} from "@/lib/constants/discover";

type Range = { from: number; to: number };

const FULL_RANGE: Range = { from: EARLIEST_YEAR, to: CURRENT_YEAR };

const clampYear = (value: number) =>
  Math.min(Math.max(value, EARLIEST_YEAR), CURRENT_YEAR);

const isFullRange = (range: Range) =>
  range.from === FULL_RANGE.from && range.to === FULL_RANGE.to;

export type YearFilterPopoverProps = {
  /** Applied range, parsed from the URL by the page. */
  from: number;
  to: number;
};

export function YearFilterPopover({ from, to }: YearFilterPopoverProps) {
  const t = useTranslations("discover");
  const applyFilters = useApplyFilters();

  /*
   * Draft state — the popover's whole point. Nothing here touches the URL until
   * "Apply"; closing by outside-click or Escape just discards it, and reopening
   * reseeds from the applied values below.
   */
  const [draft, setDraft] = useState<Range>({ from, to });
  // Raw input text, so typing "20" on the way to "2015" is not clamped to 1950
  // mid-keystroke. Reconciled with the numeric draft on blur.
  const [text, setText] = useState({ from: String(from), to: String(to) });

  const seed = (range: Range) => {
    setDraft(range);
    setText({ from: String(range.from), to: String(range.to) });
  };

  const setBound = (bound: "from" | "to", value: number) => {
    // Dragging one thumb past the other pushes rather than inverts the range.
    const next =
      bound === "from"
        ? { from: Math.min(value, draft.to), to: draft.to }
        : { from: draft.from, to: Math.max(value, draft.from) };
    seed(next);
  };

  const commitText = (bound: "from" | "to") => {
    const parsed = Number(text[bound]);
    if (!Number.isInteger(parsed)) {
      // Unparseable input reverts rather than wiping the range.
      seed(draft);
      return;
    }
    setBound(bound, clampYear(parsed));
  };

  const isApplied = !isFullRange({ from, to });

  const percent = (year: number) =>
    ((year - EARLIEST_YEAR) / (CURRENT_YEAR - EARLIEST_YEAR)) * 100;

  /*
   * Years are passed to `t` as strings, not numbers: ICU would otherwise format
   * them with the locale's grouping separator and render "2 026".
   */
  return (
    <FilterPopover
      label={t("yearRange", { from: String(from), to: String(to) })}
      icon={<IconCalendar className="size-3.5" stroke={1.75} />}
      isActive={isApplied}
      panelClassName="w-[280px]"
      onOpenChange={(open) => {
        if (open) seed({ from, to });
      }}
    >
      {(close) => (
        <>
          <PopoverHeader
            title={t("yearTitle")}
            subtitle={t("yearSubtitle", {
              from: String(EARLIEST_YEAR),
              to: String(CURRENT_YEAR),
            })}
          />

          <div className="flex items-center gap-2">
            <YearInput
              label={t("yearFromLabel")}
              value={text.from}
              onChange={(value) => setText((current) => ({ ...current, from: value }))}
              onCommit={() => commitText("from")}
            />
            <span className="shrink-0 text-[11px] text-mx-fg-faint">
              {t("yearSeparator")}
            </span>
            <YearInput
              label={t("yearToLabel")}
              value={text.to}
              onChange={(value) => setText((current) => ({ ...current, to: value }))}
              onCommit={() => commitText("to")}
            />
          </div>

          {/* Two stacked native ranges: accessible and keyboard-operable. */}
          <div className="relative mt-5 h-4">
            <span
              aria-hidden="true"
              className="absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-full bg-mx-slider-track"
            />
            <span
              aria-hidden="true"
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-mx-accent"
              style={{
                left: `${percent(draft.from)}%`,
                right: `${100 - percent(draft.to)}%`,
              }}
            />
            <input
              type="range"
              min={EARLIEST_YEAR}
              max={CURRENT_YEAR}
              value={draft.from}
              onChange={(event) => setBound("from", Number(event.target.value))}
              aria-label={t("yearFromLabel")}
              className="mx-range absolute inset-0 w-full"
            />
            <input
              type="range"
              min={EARLIEST_YEAR}
              max={CURRENT_YEAR}
              value={draft.to}
              onChange={(event) => setBound("to", Number(event.target.value))}
              aria-label={t("yearToLabel")}
              className="mx-range absolute inset-0 w-full"
            />
          </div>

          <div
            aria-hidden="true"
            className="mt-1 flex justify-between text-[11px] text-mx-fg-faint"
          >
            <span>{EARLIEST_YEAR}</span>
            <span>{CURRENT_YEAR}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {YEAR_PRESETS.map((preset) => {
              const isSelected =
                draft.from === preset.range.from && draft.to === preset.range.to;

              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => seed(preset.range)}
                  className={cn(
                    "inline-flex h-7 shrink-0 items-center rounded-full border-[0.5px] px-3 text-[12px] outline-none transition-colors focus-visible:border-mx-accent",
                    isSelected
                      ? "border-transparent bg-mx-accent text-mx-on-accent hover:bg-mx-accent-hover"
                      : "border-mx-border bg-mx-field text-mx-fg-muted hover:text-mx-fg",
                  )}
                >
                  {t(preset.messageKey)}
                </button>
              );
            })}
          </div>

          <PopoverActions
            // Clears the draft only — the panel stays open and nothing is
            // committed until Apply.
            onReset={() => seed(FULL_RANGE)}
            onApply={() => {
              const applied = isFullRange(draft);
              applyFilters({
                // The default full range is not written to the URL: it filters
                // nothing, so it would only be noise in the address bar.
                [YEAR_FROM_SEARCH_PARAM]: applied ? null : String(draft.from),
                [YEAR_TO_SEARCH_PARAM]: applied ? null : String(draft.to),
              });
              close();
            }}
          />
        </>
      )}
    </FilterPopover>
  );
}

function YearInput({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={EARLIEST_YEAR}
      max={CURRENT_YEAR}
      value={value}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit();
        }
      }}
      className="h-9 min-w-0 flex-1 rounded-[8px] border-[0.5px] border-mx-border bg-mx-field text-center text-[13px] text-mx-fg outline-none transition-colors focus:border-mx-accent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

export default YearFilterPopover;
