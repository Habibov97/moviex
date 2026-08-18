"use client";

import { useTheme } from "next-themes";
import { IconMoon, IconSun } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

/**
 * Which icon shows is decided by CSS (the `dark:` variant), not by React, so
 * there is no `mounted` effect and no hydration mismatch — the server renders
 * both icons and the theme class on <html> reveals the right one.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="İşıqlı və qaranlıq rejim arasında keç"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-mx-fg-subtle outline-none transition-colors hover:text-mx-fg focus-visible:text-mx-fg md:size-8",
        className,
      )}
    >
      <IconSun className="hidden size-4.5 dark:block" stroke={1.75} />
      <IconMoon className="size-4.5 dark:hidden" stroke={1.75} />
    </button>
  );
}

export default ThemeToggle;
