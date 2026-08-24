"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  IconBookmark,
  IconBookmarkFilled,
  IconCheck,
  IconCircleCheckFilled,
  IconEyeCheck,
  IconRotate,
  IconShare,
  IconX,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { useLibraryActions } from "@/hooks/use-library-actions";
import { useMovieStatuses } from "@/hooks/use-user-movies";

/**
 * Where a movie sits in the signed-in user's library.
 *
 * `null` → not saved; `'watchlist'` → in Listem; `'watched'` → in İzlediklerim.
 * Mirrors `MovieUserState` but includes the absent case, because this component
 * always renders one of three states rather than nothing.
 */
export type LibraryStatus = null | "watchlist" | "watched";

const buttonBase =
  "inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] px-4 text-[13.5px] font-medium outline-none transition-colors focus-visible:border-mx-accent md:h-12 md:gap-2.5 md:px-[22px] md:text-[14.5px]";

const outlineButton =
  "border-[0.5px] border-mx-border bg-transparent text-mx-fg-muted hover:text-mx-fg";

export type MovieActionsProps = {
  /**
   * The snapshot stored alongside the entry — the API denormalises title,
   * poster and year so "My List" needs no TMDB call per row.
   */
  movie: {
    tmdbId: number;
    title: string;
    posterUrl: string | null;
    releaseYear: string | null;
    /**
     * TMDB genre **id** of the first genre, stored on the entry for My List's
     * top-genre tally. An id, not a name — the name is resolved where it is
     * shown, so the stat follows the reader's language.
     */
    primaryGenreId?: number | null;
  };
  /**
   * Overrides the looked-up status. Normally omitted — the component reads the
   * real one from `useMovieStatuses` — but kept for previews and tests.
   */
  status?: LibraryStatus;
  /** Rendered beside the Watched button; already formatted. */
  watchedOn?: string | null;
};

export function MovieActions({
  movie,
  status: statusOverride,
  watchedOn = null,
}: MovieActionsProps) {
  const t = useTranslations("detail");
  const [copied, setCopied] = useState(false);

  // A one-id batch lookup: same query key shape as the grids, so this shares
  // the cache and re-renders when any mutation invalidates the root key.
  const { statuses } = useMovieStatuses([movie.tmdbId]);
  const status: LibraryStatus =
    statusOverride ?? statuses.get(movie.tmdbId) ?? null;

  // Same gate and same placeholder handlers the cards use — the hook reads
  // real session state from `useCurrentUser`, so no `isSignedIn` prop.
  const {
    requireAuth,
    addToList,
    removeFromList,
    markWatched,
    moveBackToList,
    authModal,
  } = useLibraryActions();

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; failing quietly is better than a throw.
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 font-mx md:gap-4">
        {status === null && (
          <>
            <button
              type="button"
              onClick={() => requireAuth(() => addToList(movie))}
              className={cn(
                buttonBase,
                "bg-mx-accent text-mx-on-accent hover:bg-mx-accent-hover",
              )}
            >
              <IconBookmark className="size-4" stroke={1.75} />
              {t("addToList")}
            </button>
            <MarkWatchedButton onClick={() => requireAuth(() => markWatched(movie))} />
          </>
        )}

        {status === "watchlist" && (
          <>
            <span
              className={cn(
                buttonBase,
                "border border-mx-state-list-border bg-mx-state-list-bg text-mx-state-list-fg",
              )}
            >
              <IconBookmarkFilled className="size-4" />
              {t("inYourList")}
              <button
                type="button"
                onClick={() => requireAuth(() => removeFromList(movie))}
                aria-label={t("removeFromList")}
                className="-mr-1 ml-1 flex size-5 items-center justify-center rounded-full outline-none transition-colors hover:bg-mx-state-list-border focus-visible:bg-mx-state-list-border"
              >
                <IconX className="size-3.5" stroke={2} />
              </button>
            </span>
            <MarkWatchedButton onClick={() => requireAuth(() => markWatched(movie))} />
          </>
        )}

        {status === "watched" && (
          <>
            <span
              className={cn(
                buttonBase,
                "border border-mx-state-watched-border bg-mx-state-watched-bg text-mx-state-watched-fg",
              )}
            >
              <IconCircleCheckFilled className="size-4" />
              {t("watched")}
            </span>
            <button
              type="button"
              onClick={() => requireAuth(() => moveBackToList(movie))}
              className={cn(buttonBase, outlineButton)}
            >
              <IconRotate className="size-4" stroke={1.75} />
              {t("moveBackToList")}
            </button>
            {watchedOn && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-mx-fg-faint">
                <IconCheck className="size-3.5" stroke={2} aria-hidden="true" />
                {t("watchedOn", { date: watchedOn })}
              </span>
            )}
          </>
        )}

        <button
          type="button"
          onClick={share}
          aria-label={t("share")}
          className={cn(
            "ml-auto flex size-10 shrink-0 items-center justify-center rounded-[10px] border-[0.5px] border-mx-border outline-none transition-colors focus-visible:border-mx-accent md:size-[46px]",
            copied
              ? "text-mx-success"
              : "text-mx-fg-muted hover:text-mx-fg",
          )}
        >
          {copied ? (
            <IconCheck className="size-4" stroke={2} />
          ) : (
            <IconShare className="size-4" stroke={1.75} />
          )}
        </button>

        {/* Polite, so it does not interrupt whatever is being read. */}
        <span role="status" aria-live="polite" className="sr-only">
          {copied ? t("shareCopied") : ""}
        </span>
      </div>

      {authModal}
    </>
  );
}

/** Shared by the "not in list" and "in watchlist" layouts. */
function MarkWatchedButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("detail");

  return (
    <button type="button" onClick={onClick} className={cn(buttonBase, outlineButton)}>
      <IconEyeCheck className="size-4" stroke={1.75} />
      {t("markWatched")}
    </button>
  );
}

export default MovieActions;
