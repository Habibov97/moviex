"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  IconArrowRight,
  IconCornerDownLeft,
  IconSearch,
  IconStar,
} from "@tabler/icons-react";
import type { Genre, MovieSummary } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { posterTone } from "@/lib/poster-tone";
import { getSearchResults } from "@/lib/api";
import {
  DISCOVER_LOCALE,
  DISCOVER_COPY,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MIN_QUERY_LENGTH,
  TYPEAHEAD_RESULT_LIMIT,
  movieHref,
  searchHref,
} from "@/lib/constants/discover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

/**
 * Navbar search with a typeahead dropdown.
 *
 * Performance shape worth preserving:
 * - The raw input value stays in *this* component's state. Nothing is lifted
 *   into `Navbar`, so a keystroke re-renders the input and its dropdown, not
 *   the whole header.
 * - The TanStack Query key holds the **debounced** value, never the raw one.
 *   That is what actually collapses a burst of typing into one request —
 *   debouncing only the UI would still key a new query per keystroke. It also
 *   means a superseded query is abandoned automatically when the key changes.
 * - Keyboard navigation only moves an index in state; no measuring, no scroll
 *   maths on the main thread.
 * - The panel is absolutely positioned, so opening it never reflows the navbar.
 */
export function SearchTypeahead({ genres = [] }: { genres?: Genre[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const isQueryable = debouncedQuery.length > SEARCH_MIN_QUERY_LENGTH - 1;

  const { data, isFetching } = useQuery({
    // Debounced value only — see the note above.
    queryKey: ["search", debouncedQuery],
    queryFn: () => getSearchResults({ query: debouncedQuery }),
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

  const close = () => {
    setIsOpen(false);
    inputRef.current?.blur();
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

  const showPanel = isOpen && isQueryable;
  const formattedTotal = new Intl.NumberFormat(DISCOVER_LOCALE).format(
    data?.totalResults ?? 0,
  );

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) router.push(searchHref(query.trim()));
          close();
        }}
      >
        <IconSearch
          className={cn(
            "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 transition-colors",
            isOpen ? "text-mx-accent" : "text-mx-fg-faint",
          )}
          stroke={1.75}
        />
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={query}
          autoComplete="off"
          placeholder={DISCOVER_COPY.searchPlaceholder}
          aria-label={DISCOVER_COPY.searchLabel}
          aria-expanded={showPanel}
          aria-controls={showPanel ? "search-typeahead" : undefined}
          role="combobox"
          aria-autocomplete="list"
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className={cn(
            "h-9 w-full rounded-[10px] border-[0.5px] bg-mx-field-raised pr-14 pl-9 text-[13px] text-mx-fg outline-none transition-colors placeholder:text-mx-fg-faint md:h-8 [&::-webkit-search-cancel-button]:hidden",
            isOpen ? "border-mx-accent" : "border-mx-border-subtle",
          )}
        />
        {(isOpen || query) && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-[5px] border-[0.5px] border-mx-border bg-mx-chip px-1.5 py-0.5 text-[10px] text-mx-fg-faint"
          >
            {DISCOVER_COPY.escHint}
          </span>
        )}
      </form>

      {showPanel && (
        <div
          id="search-typeahead"
          role="listbox"
          aria-label={DISCOVER_COPY.typeaheadSection}
          className="absolute top-full right-0 left-0 z-40 mt-2 rounded-[12px] border-[0.5px] border-mx-border bg-mx-card p-2 shadow-lg"
        >
          <p className="px-2 py-1.5 text-[10.5px] text-mx-page-meta">
            {DISCOVER_COPY.typeaheadSection}
          </p>

          {results.length === 0 ? (
            <p className="px-2 py-2 text-[12.5px] text-mx-fg-faint">
              {isFetching
                ? DISCOVER_COPY.typeaheadSearching
                : DISCOVER_COPY.typeaheadNoResults}
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
                  onHover={() => setActiveIndex(index)}
                  onNavigate={close}
                />
              ))}

              <div className="mt-2 flex items-center gap-3 border-t-[0.5px] border-mx-border-subtle px-2 pt-2.5">
                <Link
                  href={searchHref(query.trim())}
                  onClick={close}
                  className="inline-flex items-center gap-1.5 text-[12.5px] text-mx-accent outline-none transition-colors hover:text-mx-accent-hover focus-visible:underline"
                >
                  {DISCOVER_COPY.seeAllResults(formattedTotal)}
                  <IconArrowRight className="size-3.5" stroke={1.75} />
                </Link>

                <span
                  aria-hidden="true"
                  className="ml-auto hidden items-center gap-2 text-[11px] text-mx-fg-faint sm:flex"
                >
                  <span>↑ ↓ {DISCOVER_COPY.hintNavigate}</span>
                  <span>⏎ {DISCOVER_COPY.hintOpen}</span>
                </span>
              </div>
            </>
          )}
        </div>
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
  // `null` for a title TMDB has no score for — see DISCOVER_COPY.rating.
  const formattedRating = DISCOVER_COPY.rating(movie.rating);

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
          {DISCOVER_COPY.movieMeta(movie.releaseYear, genreLabel)}
        </span>
      </span>

      {/*
        Star and number drop together when unrated — a lone star would claim a
        score exists, and the row is too tight for a placeholder to earn space.
      */}
      {formattedRating !== null && (
        <span
          className="flex shrink-0 items-center gap-1 text-[12.5px] text-mx-fg-muted tabular-nums"
          aria-label={DISCOVER_COPY.ratingLabel(movie.rating)}
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
