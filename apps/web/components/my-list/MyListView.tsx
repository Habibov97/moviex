"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  IconBookmark,
  IconCircleCheck,
  IconCompass,
  IconFlame,
} from "@tabler/icons-react";
import type { UserMovie, UserMovieStatus } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api";
import { DISCOVER_HREF } from "@/lib/constants/discover";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  USER_MOVIES_KEY,
  useRemoveUserMovie,
  useUpdateUserMovieStatus,
} from "@/hooks/use-user-movies";
import { MyListCard } from "@/components/my-list/MyListCard";
import { MyListSortDropdown } from "@/components/my-list/MyListSortDropdown";
import {
  LIST_SORT_SEARCH_PARAM,
  MY_LIST_COPY,
  STATUS_SEARCH_PARAM,
  parseListSort,
  parseListTab,
  type ListSortId,
} from "@/lib/constants/my-list";

/**
 * My List.
 *
 * **One request for everything.** `GET /user-movies` with no status filter
 * returns the whole list; both tabs, all three stats and the sort are derived
 * from it client-side. Per-status requests would mean two caches to invalidate
 * and a stats bar that can disagree with the tab it sits above.
 */
export function MyListView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoading: isAuthLoading } = useCurrentUser();

  const tab = parseListTab(searchParams.get(STATUS_SEARCH_PARAM) ?? undefined);
  const sort = parseListSort(
    searchParams.get(LIST_SORT_SEARCH_PARAM) ?? undefined,
  );

  /*
   * No route-level guard exists in this app, so the redirect happens here once
   * auth resolves. `isAuthLoading` gates it — redirecting on "unknown" would
   * bounce a signed-in user out on every cold load.
   */
  useEffect(() => {
    if (!isAuthLoading && !isSignedIn) router.replace(DISCOVER_HREF);
  }, [isAuthLoading, isSignedIn, router]);

  const { data: entries = [], isPending } = useQuery({
    // The same root key every mutation invalidates.
    queryKey: [...USER_MOVIES_KEY, "list", "all"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/user-movies`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`GET /user-movies → ${response.status}`);
      return (await response.json()) as UserMovie[];
    },
    enabled: isSignedIn,
  });

  const updateStatus = useUpdateUserMovieStatus();
  const removeEntry = useRemoveUserMovie();

  const watchlist = entries.filter((entry) => entry.status === "watchlist");
  const watched = entries.filter((entry) => entry.status === "watched");
  const visible = sortEntries(tab === "watched" ? watched : watchlist, sort);

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (!isAuthLoading && !isSignedIn) return null;

  return (
    <main className="px-4 py-6 font-mx sm:px-6">
      <h1 className="text-[22px] font-medium text-mx-fg">
        {MY_LIST_COPY.title}
      </h1>
      <p className="mt-1 text-[12px] text-mx-fg-faint">
        {MY_LIST_COPY.subtitle}
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <StatCard
          icon={
            <IconBookmark
              className="size-4 text-mx-state-list-border"
              stroke={1.75}
            />
          }
          label={MY_LIST_COPY.statWatchlist}
          value={String(watchlist.length)}
          unit={MY_LIST_COPY.statUnit}
        />
        <StatCard
          icon={
            <IconCircleCheck
              className="size-4 text-mx-state-watched-border"
              stroke={1.75}
            />
          }
          label={MY_LIST_COPY.statWatched}
          value={String(watched.length)}
          unit={MY_LIST_COPY.statUnit}
        />
        <StatCard
          icon={<IconFlame className="size-4 text-mx-accent" stroke={1.75} />}
          label={MY_LIST_COPY.statTopGenre}
          // Across *both* tabs — a taste signal, not a per-tab figure.
          value={topGenreOf(entries)}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 border-b-[0.5px] border-mx-border-subtle">
        <Tab
          label={MY_LIST_COPY.tabWatchlist}
          count={watchlist.length}
          isActive={tab === "watchlist"}
          onClick={() => setParam(STATUS_SEARCH_PARAM, "watchlist")}
        />
        <Tab
          label={MY_LIST_COPY.tabWatched}
          count={watched.length}
          isActive={tab === "watched"}
          onClick={() => setParam(STATUS_SEARCH_PARAM, "watched")}
        />

        <div className="ml-auto pb-2">
          <MyListSortDropdown
            sort={sort}
            onChange={(next) => setParam(LIST_SORT_SEARCH_PARAM, next)}
          />
        </div>
      </div>

      {isPending ? null : visible.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visible.map((entry, index) => (
            <li key={entry.tmdbId}>
              <MyListCard
                entry={entry}
                toneIndex={entry.tmdbId}
                onMarkWatched={(item) =>
                  updateStatus.mutate({
                    tmdbId: item.tmdbId,
                    status: "watched",
                  })
                }
                onRemove={(item) => removeEntry.mutate(item.tmdbId)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="min-w-[150px] flex-1 rounded-[10px] border-[0.5px] border-mx-border-subtle bg-mx-card px-[15px] py-[13px]">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[12.5px] text-mx-fg-subtle">{label}</span>
      </div>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[20px] font-medium text-mx-fg">{value}</span>
        {unit && <span className="text-[11px] text-mx-page-meta">{unit}</span>}
      </p>
    </div>
  );
}

function Tab({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "-mb-px inline-flex items-center gap-2 border-b-2 pb-2 text-[13px] outline-none transition-colors",
        isActive
          ? "border-mx-accent font-medium text-mx-fg"
          : "border-transparent text-mx-fg-faint hover:text-mx-fg-muted",
      )}
    >
      {label}
      <span
        className={cn(
          "inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px]",
          isActive
            ? "bg-mx-accent text-mx-on-accent"
            : "bg-mx-typeahead-active text-mx-fg-faint",
        )}
      >
        {count}
      </span>
    </button>
  );
}

/** Shown per tab — the stats and tabs above it stay, so counts stay readable. */
function EmptyState({ tab }: { tab: UserMovieStatus }) {
  const isWatchlist = tab === "watchlist";

  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <span
        aria-hidden="true"
        className="flex size-[52px] items-center justify-center rounded-[14px] border-[0.5px] border-mx-border-subtle bg-mx-chip"
      >
        {isWatchlist ? (
          <IconBookmark className="size-6 text-mx-fg-faint" stroke={1.5} />
        ) : (
          <IconCircleCheck className="size-6 text-mx-fg-faint" stroke={1.5} />
        )}
      </span>

      <h2 className="mt-5 text-[15px] font-medium text-mx-fg">
        {isWatchlist
          ? MY_LIST_COPY.emptyWatchlistTitle
          : MY_LIST_COPY.emptyWatchedTitle}
      </h2>
      <p className="mt-2 max-w-[300px] text-[12.5px] leading-[1.6] text-mx-fg-subtle">
        {isWatchlist
          ? MY_LIST_COPY.emptyWatchlistBody
          : MY_LIST_COPY.emptyWatchedBody}
      </p>

      <Link
        href={DISCOVER_HREF}
        className="mt-6 inline-flex items-center gap-2 rounded-[8px] bg-mx-accent px-5 py-[9px] text-[12px] font-medium text-mx-on-accent outline-none transition-colors hover:bg-mx-accent-hover"
      >
        <IconCompass className="size-4" stroke={1.75} aria-hidden="true" />
        {MY_LIST_COPY.browseMovies}
      </Link>
    </div>
  );
}

/** All client-side — the whole list is already in memory. */
function sortEntries(entries: UserMovie[], sort: ListSortId): UserMovie[] {
  const sorted = [...entries];

  switch (sort) {
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "year":
      // Undated entries sort last rather than poisoning the comparison.
      return sorted.sort(
        (a, b) => Number(b.releaseYear ?? 0) - Number(a.releaseYear ?? 0),
      );
    case "rating":
      /*
       * `user_movies` stores no rating — it is not part of this product. The
       * option is offered because the spec asked for it, and falls back to
       * recency so the control never appears broken.
       */
      return sorted.sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    case "recent":
    default:
      return sorted.sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
  }
}

/** Most frequent `primaryGenre` across every entry, or a dash. */
function topGenreOf(entries: UserMovie[]): string {
  const tally = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.primaryGenre) continue;
    tally.set(entry.primaryGenre, (tally.get(entry.primaryGenre) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [genre, count] of tally) {
    if (count > bestCount) {
      best = genre;
      bestCount = count;
    }
  }

  return best ?? MY_LIST_COPY.noGenre;
}

export default MyListView;
