"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  IconArrowRight,
  IconCornerDownLeft,
  IconSearch,
  IconStar,
  IconX,
} from "@tabler/icons-react";
import type { Genre, Locale, MovieSummary } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { Link, useRouter } from "@/i18n/navigation";
import { posterTone } from "@/lib/poster-tone";
import { getSearchResults } from "@/lib/api";
import {
  RATING_NUMBER_FORMAT,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MIN_QUERY_LENGTH,
  TYPEAHEAD_RESULT_LIMIT,
  movieHref,
  movieMeta,
  searchHref,
} from "@/lib/constants/discover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

/**
 * Navbar search with a typeahead dropdown.
 *
 * Performance shape worth preserving:
 * - The raw input value stays in *this* component's state. Nothing is lifted
 *   into `Navbar`, so a keystroke re-renders the input and its dropdown, not
 *   the whole header. The mobile expansion is held here for the same reason —
 *   lifting it would put the navbar back in the keystroke path.
 * - The TanStack Query key holds the **debounced** value, never the raw one.
 *   That is what actually collapses a burst of typing into one request —
 *   debouncing only the UI would still key a new query per keystroke. It also
 *   means a superseded query is abandoned automatically when the key changes.
 * - Keyboard navigation only moves an index in state; no measuring, no scroll
 *   maths on the main thread.
 * - The panel is absolutely positioned, so opening it never reflows the navbar.
 *
 * Two layouts, split at `md` (the breakpoint the navbar already uses to drop
 * its nav links and show the hamburger):
 * - **`md` and up:** the input sits inline in the navbar row, unchanged.
 * - **Below `md`:** only a search icon shows, because an input squeezed between
 *   the logo and the avatar is too narrow to read what you typed. Tapping it
 *   opens an opaque overlay across the navbar row — the siblings are painted
 *   over rather than conditionally hidden, which keeps this component's state
 *   entirely local.
 */
export function SearchTypeahead({ genres = [] }: { genres?: Genre[] }) {
  const t = useTranslations("search");
  /*
   * This is the one search call made from the **browser**, so the locale has
   * to come from the client context rather than a route param — the API needs
   * `lang` to ask TMDB for localised titles.
   */
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const isQueryable = debouncedQuery.length > SEARCH_MIN_QUERY_LENGTH - 1;

  const { data, isFetching } = useQuery({
    // Debounced value only — see the note above. `locale` is part of the key so
    // switching language re-fetches rather than showing the previous
    // language's titles from cache.
    queryKey: ["search", locale, debouncedQuery],
    queryFn: () => getSearchResults({ query: debouncedQuery, locale }),
    enabled: isQueryable,
    staleTime: 60_000,
  });

  const results = data?.results.slice(0, TYPEAHEAD_RESULT_LIMIT) ?? [];
  const genreNames = new Map(genres.map((genre) => [genre.id, genre.name]));

  // A new result set invalidates the old highlight position.
  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      // Closes without clearing the input, so the text survives a stray click.
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  /*
   * Focus on open so the on-screen keyboard comes straight up, and lock body
   * scroll while the overlay covers the viewport — same convention as
   * `LoginRegisterModal`.
   */
  useEffect(() => {
    if (!isMobileOpen) return;

    mobileInputRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  /** Collapses everything: dropdown, mobile overlay, and focus. */
  const close = () => {
    setIsOpen(false);
    setIsMobileOpen(false);
    inputRef.current?.blur();
    mobileInputRef.current?.blur();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (results.length === 0) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(
        (current) => (current + step + results.length) % results.length,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const active = results[activeIndex];
      // Falls back to the full results page when nothing is highlighted.
      router.push(active ? movieHref(active.tmdbId) : searchHref(query.trim()));
      close();
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim()) router.push(searchHref(query.trim()));
    close();
  };

  const showPanel = isOpen && isQueryable;

  const inputProps = {
    type: "search" as const,
    name: "q",
    value: query,
    autoComplete: "off" as const,
    placeholder: t("placeholder"),
    "aria-label": t("label"),
    "aria-expanded": showPanel,
    "aria-controls": showPanel ? "search-typeahead" : undefined,
    role: "combobox" as const,
    "aria-autocomplete": "list" as const,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
      setIsOpen(true);
    },
    onFocus: () => setIsOpen(true),
    onKeyDown: handleKeyDown,
  };

  const panel = (
    <ResultsPanel
      results={results}
      isFetching={isFetching}
      activeIndex={activeIndex}
      genreNames={genreNames}
      query={query}
      totalResults={data?.totalResults ?? 0}
      onHover={setActiveIndex}
      onNavigate={close}
    />
  );

  return (
    <div
      ref={containerRef}
      className="relative shrink-0 md:min-w-0 md:flex-1"
    >
      {/*
        Below `md` the input is replaced by this trigger — see the note above
        for why a narrow inline input is the wrong pattern on a phone.
      */}
      <button
        type="button"
        onClick={() => {
          setIsMobileOpen(true);
          setIsOpen(true);
        }}
        aria-label={t("label")}
        aria-expanded={isMobileOpen}
        className="flex size-9 items-center justify-center rounded-[10px] text-mx-fg-subtle outline-none transition-colors hover:text-mx-fg focus-visible:text-mx-fg md:hidden"
      >
        <IconSearch className="size-5" stroke={1.75} />
      </button>

      {/*
        Unmounted while the overlay is up so only one search input exists at a
        time; on `md` and above `isMobileOpen` can never be true, so this is
        always the rendered branch there.
      */}
      {!isMobileOpen && (
        <div className="hidden md:block">
          <form role="search" onSubmit={submit}>
            <IconSearch
              className={cn(
                "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 transition-colors",
                isOpen ? "text-mx-accent" : "text-mx-fg-faint",
              )}
              stroke={1.75}
            />
            <input
              ref={inputRef}
              {...inputProps}
              className={cn(
                "h-9 w-full rounded-[10px] border-[0.5px] bg-mx-field-raised pr-3 pl-9 text-[13px] text-mx-fg outline-none transition-colors placeholder:text-mx-fg-faint md:h-8 [&::-webkit-search-cancel-button]:hidden",
                isOpen ? "border-mx-accent" : "border-mx-border-subtle",
              )}
            />
          </form>

          {showPanel && panel}
        </div>
      )}

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Opaque, and the same height as the navbar row it covers. */}
          <div className="flex h-16 items-center gap-2 border-b-[0.5px] border-mx-border-subtle bg-mx-nav px-4">
            <form role="search" onSubmit={submit} className="relative flex-1">
              <IconSearch
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mx-accent"
                stroke={1.75}
              />
              <input
                ref={mobileInputRef}
                {...inputProps}
                className="h-9 w-full rounded-[10px] border-[0.5px] border-mx-accent bg-mx-field-raised pr-3 pl-9 text-[14px] text-mx-fg outline-none placeholder:text-mx-fg-faint [&::-webkit-search-cancel-button]:hidden"
              />
            </form>

            <button
              type="button"
              onClick={close}
              aria-label={t("close")}
              className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-mx-fg-subtle outline-none transition-colors hover:text-mx-fg focus-visible:text-mx-fg"
            >
              <IconX className="size-5" stroke={1.75} />
            </button>
          </div>

          {/* Results fill the space below the bar. */}
          <div className="h-[calc(100%-4rem)] overflow-y-auto bg-mx-bg px-4 pt-3">
            {showPanel && panel}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The dropdown body. Shared verbatim by both layouts — only its positioning
 * differs, which the wrappers own.
 */
function ResultsPanel({
  results,
  isFetching,
  activeIndex,
  genreNames,
  query,
  totalResults,
  onHover,
  onNavigate,
}: {
  results: MovieSummary[];
  isFetching: boolean;
  activeIndex: number;
  genreNames: Map<number, string>;
  query: string;
  totalResults: number;
  onHover: (index: number) => void;
  onNavigate: () => void;
}) {
  const t = useTranslations("search");

  return (
    <div
      id="search-typeahead"
      role="listbox"
      aria-label={t("typeaheadSection")}
      className="rounded-[12px] border-[0.5px] border-mx-border bg-mx-card p-2 shadow-lg md:absolute md:top-full md:right-0 md:left-0 md:z-40 md:mt-2"
    >
      <p className="px-2 py-1.5 text-[10.5px] text-mx-page-meta">
        {t("typeaheadSection")}
      </p>

      {results.length === 0 ? (
        <p className="px-2 py-2 text-[12.5px] text-mx-fg-faint">
          {isFetching ? t("typeaheadSearching") : t("typeaheadNoResults")}
        </p>
      ) : (
        <>
          {results.map((movie, index) => (
            <TypeaheadRow
              key={movie.tmdbId}
              movie={movie}
              toneIndex={index}
              genreLabel={movie.genreIds
                .map((id) => genreNames.get(id))
                .find(Boolean)}
              isActive={index === activeIndex}
              onHover={() => onHover(index)}
              onNavigate={onNavigate}
            />
          ))}

          <div className="mt-2 flex items-center gap-3 border-t-[0.5px] border-mx-border-subtle px-2 pt-2.5">
            <Link
              href={searchHref(query.trim())}
              onClick={onNavigate}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-mx-accent outline-none transition-colors hover:text-mx-accent-hover focus-visible:underline"
            >
              {t("seeAllResults", { count: totalResults })}
              <IconArrowRight className="size-3.5" stroke={1.75} />
            </Link>

            <span
              aria-hidden="true"
              className="ml-auto hidden items-center gap-2 text-[11px] text-mx-fg-faint sm:flex"
            >
              <span>↑ ↓ {t("hintNavigate")}</span>
              <span>⏎ {t("hintOpen")}</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function TypeaheadRow({
  movie,
  toneIndex,
  genreLabel,
  isActive,
  onHover,
  onNavigate,
}: {
  movie: MovieSummary;
  toneIndex: number;
  genreLabel?: string;
  isActive: boolean;
  onHover: () => void;
  onNavigate: () => void;
}) {
  const t = useTranslations("discover");
  const format = useFormatter();

  // `null` for a title TMDB has no score for — see MovieCard.
  const formattedRating =
    movie.rating === null
      ? null
      : format.number(movie.rating, RATING_NUMBER_FORMAT);

  return (
    <Link
      href={movieHref(movie.tmdbId)}
      role="option"
      aria-selected={isActive}
      onMouseEnter={onHover}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-[8px] px-2 py-2 outline-none transition-colors",
        isActive && "bg-mx-typeahead-active",
      )}
    >
      <span
        className={cn(
          "relative h-12 w-8 shrink-0 overflow-hidden rounded-[6px]",
          posterTone(toneIndex),
        )}
      >
        {movie.posterUrl && (
          // Fixed 32px slot, so a fixed width/height is enough — and no
          // `priority`: these render on demand, never above the fold.
          <Image
            src={movie.posterUrl}
            alt=""
            width={32}
            height={48}
            className="size-full object-cover"
          />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] text-mx-fg">
          {movie.title}
        </span>
        <span className="block truncate text-[12px] text-mx-fg-faint">
          {movieMeta(movie.releaseYear, genreLabel)}
        </span>
      </span>

      {/*
        Star and number drop together when unrated — a lone star would claim a
        score exists, and the row is too tight for a placeholder to earn space.
      */}
      {formattedRating !== null && (
        <span
          className="flex shrink-0 items-center gap-1 text-[12.5px] text-mx-fg-muted tabular-nums"
          aria-label={t("ratingLabel", { value: formattedRating })}
        >
          <IconStar className="size-3.5 text-mx-fg-faint" stroke={1.75} />
          {formattedRating}
        </span>
      )}

      {/* Only the highlighted row advertises what Enter will do. */}
      <span className="w-4 shrink-0">
        {isActive && (
          <IconCornerDownLeft
            className="size-3.5 text-mx-fg-faint"
            stroke={1.75}
            aria-hidden="true"
          />
        )}
      </span>
    </Link>
  );
}

export default SearchTypeahead;
