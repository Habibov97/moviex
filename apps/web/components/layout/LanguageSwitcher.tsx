"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { IconCheck, IconChevronDown, IconWorld } from "@tabler/icons-react";
import {
  LOCALES,
  LOCALE_NATIVE_NAMES,
  type Locale,
} from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "@/i18n/navigation";

export type LanguageSwitcherProps = {
  /**
   * Which edge the panel hangs from. Right in the navbar's right-hand cluster,
   * left inside the mobile menu where the trigger sits against the left edge.
   */
  align?: "left" | "right";
  className?: string;
};

/**
 * The language picker.
 *
 * **Switching preserves where you are.** `usePathname()` here is the one from
 * `@/i18n/navigation`, which strips the locale prefix — so `/tr/movie/603`
 * reads back as `/movie/603` and can be re-prefixed with the chosen locale.
 * The query string is carried over verbatim, so switching language on a
 * filtered Discover page keeps the filters instead of resetting to the
 * homepage. `replace`, not `push`: flipping languages should not pile up
 * history entries you then have to press Back through.
 *
 * That query string is read from `window.location.search` **inside the click
 * handler**, not from `useSearchParams()`. This component sits in the layout,
 * on every page: subscribing to the search params here would opt the entire
 * app shell out of static rendering and make every route that has no other
 * reason to be dynamic bail out with it. The value is only needed at the
 * moment of the click, by which point there is definitely a `window`.
 *
 * Navigating through next-intl's router is also what persists the choice — it
 * updates the `NEXT_LOCALE` cookie the middleware reads on the next visit.
 *
 * Languages are listed by their **native** name and never translated: someone
 * who has landed on a locale they cannot read still has to recognise their own.
 *
 * Open/close follows the same convention as `UserMenu` and `FilterPopover` —
 * outside `mousedown` and Escape, no library.
 */
export function LanguageSwitcher({
  align = "right",
  className,
}: LanguageSwitcherProps) {
  const t = useTranslations("language");
  const activeLocale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectLocale = (locale: Locale) => {
    setIsOpen(false);
    if (locale === activeLocale) return;

    // `search` includes its own leading "?" (or is "" when there is none).
    const query = window.location.search;
    router.replace(`${pathname}${query}`, { locale });
  };

  return (
    <div ref={containerRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={t("label")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        /*
         * The reference specifies 7px/10px padding; the height is set from the
         * sibling controls instead (`h-9 md:h-8`, like ThemeToggle and the
         * avatar) because the reference draws all three the same height, and a
         * 29px pill beside a 36px avatar reads as a mistake.
         */
        className="flex h-9 items-center gap-1.5 rounded-[8px] border-[0.5px] border-mx-border-subtle bg-mx-field-raised px-2.5 text-[12px] font-medium text-mx-fg outline-none transition-colors hover:border-mx-border focus-visible:border-mx-accent md:h-8"
      >
        <IconWorld className="size-4 text-mx-fg-muted" stroke={1.75} aria-hidden="true" />
        {activeLocale.toUpperCase()}
        <IconChevronDown
          className={cn(
            "size-3.5 text-mx-fg-muted transition-transform",
            isOpen && "rotate-180",
          )}
          stroke={1.75}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t("menuLabel")}
          className={cn(
            "absolute top-full z-50 mt-2 w-[150px] rounded-[10px] border-[0.5px] border-mx-border bg-mx-card p-[5px] shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {LOCALES.map((locale) => {
            const isActive = locale === activeLocale;

            return (
              <button
                key={locale}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                lang={locale}
                onClick={() => selectLocale(locale)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[13px] outline-none transition-colors focus-visible:bg-mx-typeahead-active",
                  isActive
                    ? "bg-mx-typeahead-active text-mx-fg"
                    : "text-mx-fg-muted hover:bg-mx-field hover:text-mx-fg",
                )}
              >
                {LOCALE_NATIVE_NAMES[locale]}
                {isActive && (
                  <IconCheck
                    className="ml-auto size-3.5 shrink-0 text-mx-accent"
                    stroke={2}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
