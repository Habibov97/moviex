import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IconListSearch } from "@tabler/icons-react";
import type { Locale } from "@moviex/shared-types";

import { getGenres, getSharedList } from "@/lib/api";
import { Link } from "@/i18n/navigation";
import { DISCOVER_HREF } from "@/lib/constants/discover";
import { SharedListView } from "@/components/shared-list/SharedListView";

type SharedListParams = {
  params: Promise<{ locale: Locale; token: string }>;
};

/**
 * `/{locale}/shared/{token}` — a list someone shared by link.
 *
 * **Public: no session needed to view it.** The token is the whole permission
 * check (128 random bits, see `SharedListsService`); adding a film to your own
 * list is what needs an account, and that is gated in the view.
 *
 * Server-rendered, like Discover and Search: the list arrives as props and the
 * client view only layers the viewer's own badges on top. `getSharedList` is
 * `no-store`, so a list the owner just stopped sharing is gone on the next
 * load, and `cache()`-wrapped so this and `generateMetadata` share one fetch.
 *
 * Never indexed — the link is meant for the people it was sent to.
 */
export async function generateMetadata({
  params,
}: SharedListParams): Promise<Metadata> {
  const { locale, token } = await params;
  const [list, t] = await Promise.all([
    getSharedList(token),
    getTranslations({ locale, namespace: "sharedList" }),
  ]);

  return {
    title: list
      ? t("metaTitle", { name: list.userName })
      : t("unavailableTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function SharedListPage({ params }: SharedListParams) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const [list, genres] = await Promise.all([
    getSharedList(token),
    getGenres(locale),
  ]);

  if (!list) return <SharedListUnavailable />;

  return <SharedListView list={list} genres={genres} />;
}

/**
 * A malformed, unknown or revoked link — the API answers all three with the
 * same 404, deliberately. An explanation and a way on, rather than the bare
 * framework 404: someone followed a link a friend sent them, and "page not
 * found" would read as the site being broken.
 */
async function SharedListUnavailable() {
  const t = await getTranslations("sharedList");
  const tMyList = await getTranslations("myList");

  return (
    <main className="flex flex-col items-center px-4 py-20 text-center font-mx">
      <span
        aria-hidden="true"
        className="flex size-[52px] items-center justify-center rounded-[14px] border-[0.5px] border-mx-border-subtle bg-mx-chip"
      >
        <IconListSearch className="size-6 text-mx-fg-faint" stroke={1.5} />
      </span>
      <h1 className="mt-5 text-[15px] font-medium text-mx-fg">
        {t("unavailableTitle")}
      </h1>
      <p className="mt-2 max-w-[320px] text-[12.5px] leading-[1.6] text-mx-fg-subtle">
        {t("unavailableBody")}
      </p>
      <Link
        href={DISCOVER_HREF}
        className="mt-6 inline-flex items-center rounded-[8px] bg-mx-accent px-5 py-[9px] text-[12px] font-medium text-mx-on-accent outline-none transition-colors hover:bg-mx-accent-hover"
      >
        {tMyList("browseMovies")}
      </Link>
    </main>
  );
}
