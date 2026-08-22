/**
 * The title + description block every top-level screen opens with.
 *
 * Exists so the scale is decided once: Discover and My List had drifted to
 * different sizes (24px/600 vs 22px/500 titles, 14px vs 12px descriptions)
 * purely because each was written on its own. Any new page should render this
 * rather than picking sizes again — see the page-heading note in CLAUDE.md.
 *
 * Presentational and hook-free, so it works from a Server or Client Component.
 */
export type PageHeadingProps = {
  /** Set when a section uses `aria-labelledby` to point at the title. */
  id?: string;
  title: string;
  description: string;
  /**
   * Optional trailing element on the description row, right-aligned — Discover
   * puts its result count there. The description takes the remaining width, so
   * a long one wraps without pushing this off the edge.
   */
  aside?: React.ReactNode;
};

export function PageHeading({ id, title, description, aside }: PageHeadingProps) {
  return (
    <>
      <h1
        id={id}
        className="text-[28px] font-medium tracking-tight text-mx-fg"
      >
        {title}
      </h1>

      {/*
        `text-mx-fg-faint` is the token whose dark value is the #71717a the
        design calls for (`-subtle` is #8b8b94 there). It is also what My List's
        description already used, so only Discover's colour actually moves.
      */}
      <div className="mt-1 flex items-baseline gap-4">
        <p className="min-w-0 flex-1 text-[13.5px] text-mx-fg-faint">
          {description}
        </p>
        {aside}
      </div>
    </>
  );
}

export default PageHeading;
