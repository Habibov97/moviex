"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { IconLogout, IconUser } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { LoginRegisterModal } from "@/components/auth/LoginRegisterModal";
import {
  initialsFrom,
  useCurrentUser,
  useLogoutMutation,
} from "@/hooks/use-current-user";

/**
 * The navbar's account control, driven by real session state.
 *
 * Signed out (or while auth is still resolving) it is the generic user icon
 * and opens the auth modal. Signed in it shows initials and opens a small menu
 * with Log out.
 *
 * While `/auth/me` is in flight it deliberately behaves as the signed-out
 * icon rather than showing a spinner — the request is usually sub-100ms, and a
 * flashing placeholder in the navbar is worse than a brief generic icon.
 */
export function UserMenu() {
  const t = useTranslations("auth");
  const { user, isSignedIn } = useCurrentUser();
  const logout = useLogoutMutation();
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => (isSignedIn ? setMenuOpen((open) => !open) : setAuthOpen(true))}
        aria-label={user ? user.userName : t("signInOrCreate")}
        aria-haspopup={isSignedIn ? "menu" : "dialog"}
        aria-expanded={isSignedIn ? menuOpen : undefined}
        className="flex size-9 shrink-0 items-center justify-center rounded-full border-[0.5px] border-mx-avatar-border bg-mx-avatar text-[13px] font-medium text-mx-avatar-fg outline-none transition-colors hover:bg-mx-avatar-hover focus-visible:border-mx-accent md:size-8"
      >
        {user ? (
          // From the username `/auth/me` now joins in, not the email.
          initialsFrom(user.userName)
        ) : (
          <IconUser className="size-4.5" stroke={1.75} />
        )}
      </button>

      {isSignedIn && menuOpen && (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-2 w-56 rounded-[12px] border-[0.5px] border-mx-border bg-mx-card p-1.5 shadow-lg"
        >
          {/*
            The username is the identifier shown here. The email is deliberately
            not rendered — it is what you sign in *with*, not what identifies
            you afterwards, and a dropdown pinned open in a shared or screen-shared
            window is a poor place to put it.
          */}
          <p className="truncate px-2.5 py-2 text-[13px] font-medium text-mx-fg">
            {user?.userName}
          </p>

          <div className="my-1 border-t-[0.5px] border-mx-border-subtle" />

          <button
            type="button"
            role="menuitem"
            disabled={logout.isPending}
            onClick={() => {
              logout.mutate();
              setMenuOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] outline-none transition-colors",
              "text-mx-fg-muted hover:bg-mx-field hover:text-mx-fg focus-visible:bg-mx-field",
              logout.isPending && "opacity-60",
            )}
          >
            <IconLogout className="size-4" stroke={1.75} aria-hidden="true" />
            {logout.isPending ? t("loggingOut") : t("logOut")}
          </button>
        </div>
      )}

      <LoginRegisterModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultMode="login"
      />
    </div>
  );
}

export default UserMenu;
