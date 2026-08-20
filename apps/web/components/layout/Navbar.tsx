"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconMenu2, IconUser, IconX } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { LoginRegisterModal } from "@/components/auth/LoginRegisterModal";
import { BrandMark } from "@/components/layout/BrandMark";
import { SearchTypeahead } from "@/components/search/SearchTypeahead";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NAV_LINKS, type NavLink } from "@/lib/constants/navigation";
import type { Genre } from "@moviex/shared-types";

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export type NavbarProps = {
  /** When present the avatar shows initials instead of the sign-in icon. */
  user?: { name: string };
  /** Passed to the typeahead so result rows can name their genre. */
  genres?: Genre[];
  /** App routes, not catalogue data — static, so the default is the whole story. */
  links?: NavLink[];
};

export function Navbar({ user, genres, links = NAV_LINKS }: NavbarProps) {
  const pathname = usePathname();
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full border-b-[0.5px] border-mx-border-subtle bg-mx-nav font-mx"
      >
        <div className="flex h-16 w-full items-center gap-3 px-4 sm:gap-4 sm:px-6">
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
            Owns its own input state, so typing re-renders the search box and
            its dropdown rather than the whole navbar.
          */}
          <SearchTypeahead genres={genres} />

          <ThemeToggle />

          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            aria-label={user ? user.name : "Sign in or create an account"}
            aria-haspopup="dialog"
            className="flex size-9 shrink-0 items-center justify-center rounded-full md:size-8 border-[0.5px] border-mx-avatar-border bg-mx-avatar text-[13px] font-medium text-mx-avatar-fg outline-none transition-colors hover:bg-mx-avatar-hover focus-visible:border-mx-accent"
          >
            {user ? (
              initialsOf(user.name)
            ) : (
              <IconUser className="size-4.5" stroke={1.75} />
            )}
          </button>
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

      {/*
        Rendered outside <header> on purpose: the header is sticky, and a
        transform/filter added to it later would trap the modal's fixed
        positioning inside it.
      */}
      <LoginRegisterModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultMode="login"
      />
    </>
  );
}

export default Navbar;
