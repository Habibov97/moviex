"use client";

import { useRef } from "react";

/**
 * Props for a modal's backdrop that close it on a click **on the backdrop
 * itself** — and only when the press also *started* there.
 *
 * The second condition is the whole point. When a press starts in one element
 * and ends in another, the browser fires `click` on their nearest common
 * ancestor. So selecting text in a field by dragging, and letting go just
 * outside the panel, delivered a `click` straight to the backdrop — and the
 * modal closed mid-selection, taking whatever had been typed with it. The
 * panel's own `stopPropagation()` cannot prevent that: the click never passes
 * through the panel, it is dispatched on the backdrop directly.
 *
 * `pointerdown` covers mouse, pen and touch alike. Pass `undefined` to make
 * the backdrop inert, e.g. for the auth modal's non-dismissible `saveCode`
 * view.
 *
 * Spread the result onto the backdrop element:
 *
 *   <div {...useBackdropDismiss(onClose)} className="fixed inset-0 …">
 */
export function useBackdropDismiss(onDismiss: (() => void) | undefined) {
  const pressStartedOnBackdrop = useRef(false);

  return {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      pressStartedOnBackdrop.current = event.target === event.currentTarget;
    },
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      const startedHere = pressStartedOnBackdrop.current;
      pressStartedOnBackdrop.current = false;

      if (onDismiss && startedHere && event.target === event.currentTarget) {
        onDismiss();
      }
    },
  };
}
