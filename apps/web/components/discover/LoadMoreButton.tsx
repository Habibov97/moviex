"use client";

import { DISCOVER_COPY } from "@/lib/constants/discover";

/**
 * The pagination control both result views sit under. Identical in the grid and
 * list references, so it is one component rather than two copies.
 */
export function LoadMoreButton({ onClick }: { onClick?: () => void }) {
  return (
    <div className="mt-8 flex justify-center">
      <button
        type="button"
        // TODO: fetch the next page
        onClick={() => onClick?.()}
        className="inline-flex h-10 items-center rounded-[10px] border-[0.5px] border-mx-border bg-mx-chip-alt px-6 text-[14px] text-mx-fg-muted outline-none transition-colors hover:text-mx-fg focus-visible:border-mx-accent"
      >
        {DISCOVER_COPY.loadMore}
      </button>
    </div>
  );
}

export default LoadMoreButton;
