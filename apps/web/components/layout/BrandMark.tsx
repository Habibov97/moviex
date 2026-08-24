import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/shared/LogoMark";

/**
 * The horizontal lockup: the logo mark, a gap, and the "MovieX" wordmark with
 * its accent "X".
 *
 * The mark itself is `LogoMark` — this composes it with the wordmark and owns
 * nothing but the spacing and type. A caller wanting the tile on its own should
 * render `LogoMark` directly rather than pulling this in and hiding the text.
 *
 * Renders no link of its own — the navbar wraps it in a home `<Link>` — so the
 * caller keeps its own semantics.
 *
 * It used to carry a `size` prop with a larger `lg` variant for the footer's
 * brand block. The footer is three lines of text now and has no brand mark at
 * all, so the navbar is the only caller and the sizing is inlined at the one
 * scale still in use: it has to sit inside a 64px bar beside the nav links.
 */
export type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span className={cn("flex shrink-0 items-center gap-2", className)}>
      {/* 28px matches the `size-7` the tile used to be, so the lockup's
          geometry — icon, gap, wordmark — is unchanged. */}
      <LogoMark size={28} />
      <span className="text-[18px] font-medium text-mx-fg">
        Movie<span className="text-mx-accent">X</span>
      </span>
    </span>
  );
}

export default BrandMark;
