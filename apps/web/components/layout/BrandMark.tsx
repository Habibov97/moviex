import { cn } from "@/lib/utils";

/**
 * The MovieX wordmark. Shared by the navbar and the footer so the accent "X"
 * and the swatch geometry are defined once.
 *
 * Renders no link of its own — the navbar wraps it in a home `<Link>`, the
 * footer sets it as plain text — so callers keep their own semantics.
 */
const BRAND_SIZES = {
  /** Navbar: has to sit inside a 64px bar next to the nav links. */
  sm: { swatch: "size-7 rounded-[8px]", word: "text-[18px]", gap: "gap-2" },
  /** Footer: leads a block of its own, so it can carry more weight. */
  lg: { swatch: "size-9 rounded-[11px]", word: "text-[22px]", gap: "gap-2.5" },
} as const;

export type BrandMarkProps = {
  size?: keyof typeof BRAND_SIZES;
  className?: string;
};

export function BrandMark({ size = "sm", className }: BrandMarkProps) {
  const scale = BRAND_SIZES[size];

  return (
    <span
      className={cn("flex shrink-0 items-center", scale.gap, className)}
    >
      <span
        className={cn("bg-mx-accent", scale.swatch)}
        aria-hidden="true"
      />
      <span className={cn("font-medium text-mx-fg", scale.word)}>
        Movie<span className="text-mx-accent">X</span>
      </span>
    </span>
  );
}

export default BrandMark;
