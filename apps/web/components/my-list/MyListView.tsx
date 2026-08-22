"use client";

import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  IconBookmark,
  IconCircleCheck,
  IconCompass,
  IconFlame,
} from "@tabler/icons-react";
import type { UserMovie, UserMovieStatus } from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useRemoveUserMovie,
  useUpdateUserMovieStatus,
  useUserMovies,
} from "@/hooks/use-user-movies";
import { MyListCard } from "@/components/my-list/MyListCard";
import { MyListSortDropdown } from "@/components/my-list/MyListSortDropdown";
import { SignInRequired } from "@/components/my-list/SignInRequired";
import { PageHeading } from "@/components/shared/PageHeading";
import { DISCOVER_HREF, SKELETON_CARD_COUNT } from "@/lib/constants/discover";
import {
  LIST_SORT_SEARCH_PARAM,
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
 *
 * Note the entries come from **our** database, not TMDB: the title, poster and
 * genre were snapshotted in whatever language the user was browsing when they
 * saved the film. Switching language translates the page's chrome, not those
 * snapshots — see the user-movies notes in CLAUDE.md.
 *
 * **Three states, gated on auth in this order:** still loading → a skeleton;
 * confirmed signed out → `SignInRequired`; signed in → the list. Reading them
 * in that order is what stops "unknown" being treated as "signed out", which
 * would flash the sign-in prompt at someone who is in fact logged in.
 */
export function MyListView() {
  const t = useTranslations("myList");
  const format = useFormatter();
  const router = useRouter();
  // Locale-free, so the param writes below rebuild a plain `/my-list` path.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoading: isAuthLoading } = useCurrentUser();

  const tab = parseListTab(searchParams.get(STATUS_SEARCH_PARAM) ?? undefined);
  const sort = parseListSort(
    searchParams.get(LIST_SORT_SEARCH_PARAM) ?? undefined,
  );

  /*
   * Goes through the shared hook rather than an inline `useQuery`, which is
   * what it used to be. That inline copy rebuilt the cache key by hand, so it
   * was a second place the per-user scoping had to be remembered — and exactly
   * the kind of duplicate that lets one path drift unscoped. One hook, one key.
   */
  const { data: entries = [], isPending } = useUserMovies();

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

  /*
   * Auth is unresolved, so neither branch below can be trusted yet. A skeleton
   * of the real layout is the app's established loading treatment (see
   * `MovieCardSkeleton`) and commits to nothing: it is visibly not content, so
   * it cannot be mistaken for an empty list or for a sign-in prompt.
   */
  if (isAuthLoading) {
    return (
      <main className="px-4 py-6 font-mx sm:px-6">
        <MyListSkeleton />
      </main>
    );
  }

  /*
   * Confirmed signed out. Nothing else renders — no heading, stats, tabs or
   * grid — because every one of them would be describing a list this visitor
   * does not have. Replaces an older silent redirect to Discover.
   */
  if (!isSignedIn) {
    return (
      <main className="font-mx">
        <SignInRequired />
      </main>
    );
  }

  return (
    <main className="px-4 py-6 font-mx sm:px-6">
      <PageHeading title={t("title")} description={t("subtitle")} />

      <div className="mt-5 flex flex-wrap gap-3">
        <StatCard
          icon={
            <IconBookmark
              className="size-4 text-mx-state-list-border"
              stroke={1.75}
            />
          }
          label={t("statWatchlist")}
          value={format.number(watchlist.length)}
          // The unit agrees with the number: Russian needs "фильм /
          // фильма / фильмов" where English needs two forms.
          unit={t("statUnit", { count: watchlist.length })}
        />
        <StatCard
          icon={
            <IconCircleCheck
              className="size-4 text-mx-state-watched-border"
              stroke={1.75}
            />
          }
          label={t("statWatched")}
          value={format.number(watched.length)}
          unit={t("statUnit", { count: watched.length })}
        />
        <StatCard
          icon={<IconFlame className="size-4 text-mx-accent" stroke={1.75} />}
          label={t("statTopGenre")}
          // Across *both* tabs — a taste signal, not a per-tab figure.
          value={topGenreOf(entries) ?? t("noGenre")}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 border-b-[0.5px] border-mx-border-subtle">
        <Tab
          label={t("tabWatchlist")}
          count={watchlist.length}
          isActive={tab === "watchlist"}
          onClick={() => setParam(STATUS_SEARCH_PARAM, "watchlist")}
        />
        <Tab
          label={t("tabWatched")}
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
          {visible.map((entry) => (
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

/**
 * Placeholder for the whole page while `/auth/me` is in flight.
 *
 * Mirrors the real layout's geometry — heading, three stat cards, a card grid —
 * so resolving to the signed-in view does not reflow. `animate-pulse` over
 * `bg-mx-chip` is the same treatment `MovieCardSkeleton` uses.
 */
function MyListSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-[28px] w-40 animate-pulse rounded-[6px] bg-mx-chip" />
      <div className="mt-2 h-[13.5px] w-64 animate-pulse rounded-[4px] bg-mx-chip" />

      <div className="mt-5 flex flex-wrap gap-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="min-w-[150px] flex-1 rounded-[10px] border-[0.5px] border-mx-border-subtle bg-mx-card px-[15px] py-[13px]"
          >
            <div className="h-4 w-24 animate-pulse rounded-[4px] bg-mx-chip" />
            <div className="mt-2 h-[24px] w-12 animate-pulse rounded-[4px] bg-mx-chip" />
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-4 border-b-[0.5px] border-mx-border-subtle pb-2">
        <div className="h-[18px] w-28 animate-pulse rounded-[4px] bg-mx-chip" />
        <div className="h-[18px] w-24 animate-pulse rounded-[4px] bg-mx-chip" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
          <div key={index}>
            <div className="aspect-[2/3] animate-pulse rounded-[12px] border-[0.5px] border-mx-border-subtle bg-mx-chip" />
            <div className="mt-2.5 h-[12.5px] w-3/4 animate-pulse rounded-[4px] bg-mx-chip" />
            <div className="mt-1.5 h-[10.5px] w-1/2 animate-pulse rounded-[4px] bg-mx-chip" />
          </div>
        ))}
      </div>
    </div>
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
        <span className="text-[24px] font-medium text-mx-fg">{value}</span>
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
  const t = useTranslations("myList");
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
        {isWatchlist ? t("emptyWatchlistTitle") : t("emptyWatchedTitle")}
      </h2>
      <p className="mt-2 max-w-[300px] text-[12.5px] leading-[1.6] text-mx-fg-subtle">
        {isWatchlist ? t("emptyWatchlistBody") : t("emptyWatchedBody")}
      </p>

      <Link
        href={DISCOVER_HREF}
        className="mt-6 inline-flex items-center gap-2 rounded-[8px] bg-mx-accent px-5 py-[9px] text-[12px] font-medium text-mx-on-accent outline-none transition-colors hover:bg-mx-accent-hover"
      >
        <IconCompass className="size-4" stroke={1.75} aria-hidden="true" />
        {t("browseMovies")}
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

/**
 * Most frequent `primaryGenre` across every entry, or `null` when nothing saved
 * carries one — the caller substitutes the dash, so the placeholder stays a
 * message rather than a literal in here.
 */
function topGenreOf(entries: UserMovie[]): string | null {
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

  return best;
}

export default MyListView;
