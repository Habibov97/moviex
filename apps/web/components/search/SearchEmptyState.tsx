import Link from "next/link";
import { IconMoodEmpty } from "@tabler/icons-react";
import type { MovieSummary } from "@moviex/shared-types";

import {
  DISCOVER_COPY,
  DISCOVER_HREF,
  movieHref,
} from "@/lib/constants/discover";

export type SearchEmptyStateProps = {
  /** A few popular titles offered as a way out of a dead end. */
  suggestions: MovieSummary[];
};

/**
 * Shown when a search returns nothing. A Server Component — every control is a
 * link, so there is no reason to ship it to the browser.
 */
export function SearchEmptyState({ suggestions }: SearchEmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center font-mx sm:px-6">
      <span
        aria-hidden="true"
        className="flex size-[52px] items-center justify-center rounded-[14px] border-[0.5px] border-mx-border-subtle bg-mx-chip"
      >
        <IconMoodEmpty className="size-6 text-mx-fg-faint" stroke={1.5} />
      </span>

      <h2 className="mt-5 text-[15px] font-medium text-mx-fg">
        {DISCOVER_COPY.emptyTitle}
      </h2>
      <p className="mt-2 max-w-[340px] text-[13.5px] leading-relaxed text-mx-fg-subtle">
        {DISCOVER_COPY.emptyBody}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={DISCOVER_HREF}
          className="inline-flex h-10 items-center rounded-[10px] bg-mx-accent px-5 text-[13.5px] font-medium text-mx-on-accent outline-none transition-colors hover:bg-mx-accent-hover focus-visible:underline"
        >
          {DISCOVER_COPY.browsePopular}
        </Link>
        {/* Same destination as the header's clear button — both drop `q`. */}
        <Link
          href={DISCOVER_HREF}
          className="inline-flex h-10 items-center rounded-[10px] border-[0.5px] border-mx-border px-5 text-[13.5px] text-mx-fg-muted outline-none transition-colors hover:text-mx-fg focus-visible:border-mx-accent"
        >
          {DISCOVER_COPY.clearSearch}
        </Link>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-10">
          <p className="text-[12px] text-mx-fg-faint">
            {DISCOVER_COPY.popularRightNow}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {suggestions.map((movie) => (
              <Link
                key={movie.tmdbId}
                href={movieHref(movie.tmdbId)}
                className="inline-flex h-9 items-center rounded-full border-[0.5px] border-mx-border bg-mx-chip px-4 text-[13px] text-mx-fg-muted outline-none transition-colors hover:text-mx-fg focus-visible:border-mx-accent"
              >
                {movie.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchEmptyState;
