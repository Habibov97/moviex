"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconMenu2, IconX } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/layout/BrandMark";
import { SearchTypeahead } from "@/components/search/SearchTypeahead";
import { UserMenu } from "@/components/layout/UserMenu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NAV_LINKS, type NavLink } from "@/lib/constants/navigation";
import type { Genre } from "@moviex/shared-types";

export type NavbarProps = {
  /** Passed to the typeahead so result rows can name their genre. */
  genres?: Genre[];
  /** App routes, not catalogue data — static, so the default is the whole story. */
  links?: NavLink[];
};

export function Navbar({ genres, links = NAV_LINKS }: NavbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

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
            aria-label={menuOpen ? "Close menu" : "Open menu"}
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
            aria-label="MovieX home"
          >
            <BrandMark />
          </Link>

          <nav className="hidden shrink-0 items-center gap-5 md:flex" aria-label="Main menu">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "relative py-2 text-[15px] outline-none transition-colors",
                  isActive(link.href)
                    ? "text-mx-fg after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[1.5px] after:bg-mx-accent"
                    : "text-mx-fg-subtle hover:text-mx-fg focus-visible:text-mx-fg",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/*
            One right-hand cluster: search, theme, account. `flex-1` +
            `justify-end` pins it to the right edge on mobile, where search is
            only an icon and nothing else would push these across. On `md` and
            up the search input inside grows to fill the gap, so the toggle and
            avatar stay hard right while the logo holds the left.
          */}
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
            {/*
              Owns its own input state, so typing re-renders the search box and
              its dropdown rather than the whole navbar.
            */}
            <SearchTypeahead genres={genres} />

            <ThemeToggle />

            {/* Real session state lives in UserMenu — see useCurrentUser. */}
            <UserMenu />
          </div>
        </div>

        {menuOpen && (
          <nav
            className="border-t-[0.5px] border-mx-border-subtle px-4 py-2 md:hidden"
            aria-label="Mobile menu"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center rounded-[10px] px-2 text-[15px] outline-none transition-colors",
                  isActive(link.href)
                    ? "text-mx-fg"
                    : "text-mx-fg-subtle hover:text-mx-fg focus-visible:text-mx-fg",
                )}
              >
                {link.label}
                {isActive(link.href) && (
                  <span
                    className="ml-2 h-[1.5px] w-4 bg-mx-accent"
                    aria-hidden="true"
                  />
                )}
              </Link>
            ))}
          </nav>
        )}

      </header>
    </>
  );
}

export default Navbar;
