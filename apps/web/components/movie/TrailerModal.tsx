"use client";

import { useEffect } from "react";
import { IconX } from "@tabler/icons-react";
import type { MovieTrailer } from "@moviex/shared-types";

import { DETAIL_COPY } from "@/lib/constants/discover";

/**
 * YouTube player in a modal. Same conventions as `LoginRegisterModal`: Escape
 * and backdrop click close it, and body scroll is locked while it is open.
 */
export function TrailerModal({
  trailer,
  isOpen,
  onClose,
}: {
  trailer: MovieTrailer;
  isOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={trailer.name}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-mx-backdrop p-4 font-mx"
    >
      <div
        // The player must not close the modal when clicked.
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={DETAIL_COPY.closeTrailer}
          className="absolute -top-10 right-0 flex size-8 items-center justify-center rounded-full bg-mx-hero-pill text-mx-poster-fg outline-none transition-colors hover:bg-mx-accent focus-visible:bg-mx-accent"
        >
          <IconX className="size-4" stroke={1.75} />
        </button>

        <div className="aspect-video w-full overflow-hidden rounded-[12px] border-[0.5px] border-mx-border bg-black">
          <iframe
            // `autoplay` is intentional: the user clicked "Watch trailer".
            src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1`}
            title={trailer.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="size-full"
          />
        </div>
      </div>
    </div>
  );
}

export default TrailerModal;
