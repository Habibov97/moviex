import { cn } from "@/lib/utils";

/**
 * The MovieX logo mark: two triangles meeting at the centre of a dark rounded
 * tile, reading as an abstract "X".
 *
 * **This is the only place the mark is drawn.** It replaced a plain accent
 * square that had been inlined separately in the navbar and again in the auth
 * modal — two copies that had to be kept in step by hand. If a new surface
 * needs the mark, render this; do not paste the SVG or approximate it with a
 * styled `<div>`.
 *
 * It is the icon half of the horizontal lockup only. The wordmark beside it
 * lives in `components/layout/BrandMark.tsx`, which composes the two — so a
 * caller wanting "icon + MovieX" wants `BrandMark`, and a caller wanting just
 * the tile (a favicon, an avatar slot) wants this.
 *
 * Colours come from `--mx-*` tokens, all declared on `:root` with no `.dark`
 * override: a brand mark does not change with the theme, and the dark tile is
 * part of the logo rather than a surface meant to follow the page.
 *
 * **The exported icon files in `app/` are generated from this same geometry but
 * carry literal hex**, because a favicon is rendered outside the document and
 * has no custom properties to resolve. `scripts/generate-icons.mjs` holds that
 * copy; if the artwork changes, re-run it so the two do not drift.
 */

/** The `viewBox` everything below is drawn in. */
const VIEW_BOX = 64;

/**
 * Geometry, shared with the icon generator.
 *
 * The triangles span 14→50 of 64, so the mark is ~56% tile and ~44% padding.
 * That is what keeps it readable at favicon scale: two flat shapes with no
 * stroke, no gradient and no detail finer than a ninth of the width, so at
 * 16px each triangle is still ~9px across and the X still reads.
 */
export const LOGO_GEOMETRY = {
  viewBox: VIEW_BOX,
  /** Corner radius at 64×64. Scales with the tile. */
  radius: 16,
  /** Left triangle — points right, vertical edge on the left. */
  left: "14,14 32,32 14,50",
  /** Right triangle — points left, vertical edge on the right. */
  right: "50,14 50,50 32,32",
} as const;

export type LogoMarkProps = {
  /** Rendered width and height in px. Defaults to the navbar's 28. */
  size?: number;
  className?: string;
  /**
   * Accessible name. Omit for the usual case — the mark sits beside the
   * "MovieX" wordmark or inside an already-labelled link, so announcing it
   * again is noise. Passing a title makes it a labelled `img` instead.
   */
  title?: string;
};

export function LogoMark({ size = 28, className, title }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}
      className={cn("shrink-0", className)}
      // Decorative unless the caller names it; `focusable` is for IE/Edge
      // legacy, where SVGs are otherwise tab stops.
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <rect
        width={VIEW_BOX}
        height={VIEW_BOX}
        rx={LOGO_GEOMETRY.radius}
        fill="var(--mx-logo-surface)"
      />
      <polygon points={LOGO_GEOMETRY.left} fill="var(--mx-accent)" />
      <polygon points={LOGO_GEOMETRY.right} fill="var(--mx-accent-deep)" />
    </svg>
  );
}

export default LogoMark;
