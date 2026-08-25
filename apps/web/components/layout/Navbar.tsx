"use client";

import { useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { IconMenu2, IconX } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/i18n/navigation";
import { useLibraryActions } from "@/hooks/use-library-actions";
import { BrandMark } from "@/components/layout/BrandMark";
import { SearchTypeahead } from "@/components/search/SearchTypeahead";
import { UserMenu } from "@/components/layout/UserMenu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { NAV_LINKS, type NavLink } from "@/lib/constants/navigation";
import type { Genre } from "@moviex/shared-types";

/**
 * The "action" handed to `requireAuth` for a gated *link*.
 *
 * Empty on purpose. Navigating is what the anchor does by itself, and the
 * caller returns before this ever reaches `requireAuth`'s signed-in branch —
 * the call is made purely for the other two, where `requireAuth` either opens
 * the modal or (auth still unknown) does nothing at all. Module-level so its
 * identity is stable across renders.
 */
const NO_ACTION = () => {};

export type NavbarProps = {
  /** Passed to the typeahead so result rows can name their genre. */
  genres?: Genre[];
  /** App routes, not catalogue data — static, so the default is the whole story. */
  links?: NavLink[];
};

export function Navbar({ genres, links = NAV_LINKS }: NavbarProps) {
  const t = useTranslations("nav");
  /*
   * The locale-aware `usePathname` — it answers `/my-list`, never
   * `/tr/my-list`, so these comparisons stay written against plain routes and
   * do not have to know a prefix exists.
   */
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  /*
   * The same gate the Add / Mark-as-watched buttons use, not a second auth
   * check written for the navbar. `requireAuth` owns the three-way decision
   * and `authModal` is the one `LoginRegisterModal` instance it opens, already
   * on its login view.
   */
  const { isSignedIn, isAuthLoading, requireAuth, authModal } =
    useLibraryActions();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  /**
   * Intercepts a click on a gated link. Returns whether the anchor was left to
   * navigate, which the mobile sheet uses to decide about closing itself.
   *
   * Only `isSignedIn` — confirmed, not merely "not loading" — lets the click
   * through. Everything else is prevented and handed to `requireAuth`, which
   * opens the modal once logged-out is certain and stays silent while
   * `/auth/me` is still in flight. Treating that unknown moment as logged-out
   * would flash the modal at someone who is in fact signed in; the link is
   * simply inert for those few milliseconds.
   *
   * `preventDefault` on the click is all this does — the `href` is untouched,
   * so a middle-click or a direct visit still reaches `/my-list` and meets the
   * page's own signed-out state. That guard is the protection; this is the UX.
   */
  const handleNavClick = (link: NavLink, event: MouseEvent<HTMLAnchorElement>) => {
    if (!link.requiresAuth || isSignedIn) return true;

    event.preventDefault();
    requireAuth(NO_ACTION);
    return false;
  };

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full border-b-[0.5px] border-mx-border-subtle bg-mx-nav font-mx"
      >
        {/*
          `gap-2` below `sm` on purpose: at 320px the hamburger, wordmark and
          three 36px controls only just fit, and `gap-3` tips the row into
          overflow. `px-4` stays so the logo lines up with the page content.
        */}
        <div className="flex h-16 w-full items-center gap-2 px-4 sm:gap-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={menuOpen}
            className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-mx-fg-subtle outline-none transition-colors hover:text-mx-fg focus-visible:text-mx-fg md:hidden"
          >
            {menuOpen ? (
              <IconX className="size-5" stroke={1.75} />
            ) : (
              <IconMenu2 className="size-5" stroke={1.75} />
            )}
          </button>

          <Link
            href="/"
            className="inline-flex shrink-0 outline-none"
            aria-label={t("home")}
          >
            <BrandMark />
          </Link>

          <nav className="hidden shrink-0 items-center gap-5 md:flex" aria-label={t("mainMenu")}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(event) => handleNavClick(link, event)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "relative py-2 text-[15px] outline-none transition-colors",
                  isActive(link.href)
                    ? "text-mx-fg after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[1.5px] after:bg-mx-accent"
                    : "text-mx-fg-subtle hover:text-mx-fg focus-visible:text-mx-fg",
                )}
              >
                {t(link.messageKey)}
              </Link>
            ))}
          </nav>

          {/*
            One right-hand cluster: search, language, theme, account. `flex-1` +
            `justify-end` pins it to the right edge on mobile, where search is
            only an icon and nothing else would push these across. On `md` and
            up the search input inside grows to fill the gap, so the controls
            stay hard right while the logo holds the left.
          */}
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
            {/*
              Owns its own input state, so typing re-renders the search box and
              its dropdown rather than the whole navbar.
            */}
            <SearchTypeahead genres={genres} />

            {/*
              Hidden below `md` and shown in the mobile menu instead: at 320px
              the row already only just fits the hamburger, wordmark and three
              36px controls, and a ~62px pill tips it into overflow.
            */}
            <LanguageSwitcher className="hidden md:block" />

            <ThemeToggle />

            {/* Real session state lives in UserMenu — see useCurrentUser. */}
            <UserMenu />
          </div>
        </div>

        {menuOpen && (
          <nav
            className="border-t-[0.5px] border-mx-border-subtle px-4 py-2 md:hidden"
            aria-label={t("mobileMenu")}
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(event) => {
                  const navigated = handleNavClick(link, event);
                  /*
                   * Stay open only for the inert loading moment, where the tap
                   * visibly did nothing — closing the sheet then would read as
                   * a broken link. Otherwise it either navigated or the modal
                   * is now covering the sheet.
                   */
                  if (navigated || !isAuthLoading) setMenuOpen(false);
                }}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center rounded-[10px] px-2 text-[15px] outline-none transition-colors",
                  isActive(link.href)
                    ? "text-mx-fg"
                    : "text-mx-fg-subtle hover:text-mx-fg focus-visible:text-mx-fg",
                )}
              >
                {t(link.messageKey)}
                {isActive(link.href) && (
                  <span
                    className="ml-2 h-[1.5px] w-4 bg-mx-accent"
                    aria-hidden="true"
                  />
                )}
              </Link>
            ))}

            {/* Same component, just where there is room for it on a phone. */}
            <div className="mt-2 border-t-[0.5px] border-mx-border-subtle px-2 pt-3 pb-1">
              <LanguageSwitcher align="left" />
            </div>
          </nav>
        )}

      </header>

      {/*
        The gate's own modal. `UserMenu` renders a second, separate instance for
        the avatar's signed-out click — two mount points, one component, and
        only ever one open at a time.
      */}
      {authModal}
    </>
  );
}

export default Navbar;
