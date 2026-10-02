"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  IconBookmark,
  IconCircleCheck,
  IconInfoCircle,
} from "@tabler/icons-react";
import type {
  Genre,
  MovieSummary,
  SharedList,
  SharedListMovie,
  UserMovieStatus,
} from "@moviex/shared-types";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useLibraryActions } from "@/hooks/use-library-actions";
import { useMovieStatuses } from "@/hooks/use-user-movies";
import { ListTab } from "@/components/my-list/ListTab";
import { MovieGrid } from "@/components/discover/MovieGrid";
import { PageHeading } from "@/components/shared/PageHeading";

export type SharedListViewProps = {
  /** Fetched server-side by the page from `GET /shared-lists/:token`. */
  list: SharedList;
  /** The viewer's locale's genre list, for each card's genre label. */
  genres: Genre[];
};

/**
 * Someone else's list, opened from a link they shared.
 *
 * **Two different people's state on one screen, kept apart on purpose.** The
 * tabs are the *owner's* — which of their films they want to watch and which
 * they have seen. The badge on each card is the *viewer's* own, exactly as on
 * Discover: `useMovieStatuses` is the signed-in viewer's batch lookup, so a
 * film the viewer already has shows "In list" / "Watched" and no button, and
 * everything else shows Add.
 *
 * **Add goes through `runCardAction`**, the same gate every catalogue card
 * uses: a confirmed signed-out visitor gets the login modal, a signed-in one
 * gets the film on their own watchlist. Viewing needs no account; adding
 * does. Like Discover cards, it only ever adds — the owner's statuses are
 * never copied, and nothing here can change the owner's list.
 *
 * Cards are Discover's `MovieGrid`, fed `MovieSummary`s mapped from the shared
 * entries, rather than My List's cards: those carry the *owner's* actions
 * (mark watched, remove), which are meaningless to a visitor.
 */
export function SharedListView({ list, genres }: SharedListViewProps) {
  const t = useTranslations("sharedList");
  const tMyList = useTranslations("myList");
  const { user } = useCurrentUser();

  const watchlist = list.movies.filter((movie) => movie.status === "watchlist");
  const watched = list.movies.filter((movie) => movie.status === "watched");

  // Open on whichever tab has something in it, so a list of only watched
  // films does not greet the visitor with an empty watchlist.
  const [tab, setTab] = useState<UserMovieStatus>(
    watchlist.length > 0 || watched.length === 0 ? "watchlist" : "watched",
  );

  const { runCardAction, authModal } = useLibraryActions();

  // Both tabs in one lookup, so switching tabs costs no request.
  const { statuses } = useMovieStatuses(list.movies.map((movie) => movie.tmdbId));

  const visible = (tab === "watched" ? watched : watchlist).map((movie) => ({
    ...toMovieSummary(movie),
    userState: statuses.get(movie.tmdbId) ?? null,
  }));

  // `userName` is unique, so this is the owner looking at their own link.
  const isOwnList = user?.userName === list.userName;
  const name = list.userName;

  return (
    <main className="font-mx">
      <div className="px-4 pt-6 sm:px-6">
        <PageHeading
          title={t("title", { name })}
          description={t("subtitle", { name })}
        />

        {isOwnList && (
          <p className="mt-3 flex items-center gap-2 text-[12.5px] text-mx-fg-subtle">
            <IconInfoCircle
              className="size-4 shrink-0"
              stroke={1.75}
              aria-hidden="true"
            />
            {t("ownList")}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4 border-b-[0.5px] border-mx-border-subtle">
          <ListTab
            label={tMyList("tabWatchlist")}
            count={watchlist.length}
            isActive={tab === "watchlist"}
            onClick={() => setTab("watchlist")}
          />
          <ListTab
            label={tMyList("tabWatched")}
            count={watched.length}
            isActive={tab === "watched"}
            onClick={() => setTab("watched")}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-14 text-center">
          <span
            aria-hidden="true"
            className="flex size-[52px] items-center justify-center rounded-[14px] border-[0.5px] border-mx-border-subtle bg-mx-chip"
          >
            {tab === "watchlist" ? (
              <IconBookmark className="size-6 text-mx-fg-faint" stroke={1.5} />
            ) : (
              <IconCircleCheck className="size-6 text-mx-fg-faint" stroke={1.5} />
            )}
          </span>
          <p className="mt-5 max-w-[320px] text-[13px] text-mx-fg-subtle">
            {tab === "watchlist"
              ? t("emptyWatchlist", { name })
              : t("emptyWatched", { name })}
          </p>
        </div>
      ) : (
        <MovieGrid
          movies={visible}
          genres={genres}
          onAddMovie={runCardAction}
          className="border-b-0"
        />
      )}

      {authModal}
    </main>
  );
}

/**
 * The shape the catalogue cards take. A shared entry has no rating or
 * synopsis — `rating: null` is the "unrated" case every card already handles
 * by hiding the badge — and one genre id at most.
 *
 * `genreIds: [primaryGenreId]` is also what Add reads to snapshot the
 * viewer's own entry, so the film lands in their list with its genre intact.
 */
function toMovieSummary(movie: SharedListMovie): MovieSummary {
  return {
    tmdbId: movie.tmdbId,
    title: movie.title,
    posterUrl: movie.posterUrl,
    releaseYear: movie.releaseYear,
    rating: null,
    genreIds: movie.primaryGenreId == null ? [] : [movie.primaryGenreId],
    overview: null,
  };
}

export default SharedListView;
