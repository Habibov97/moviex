"use client";

import { useEffect, useState } from "react";

/**
 * Trails `value` by `delayMs`, restarting the wait on every change.
 *
 * The cleanup is the point: each render clears the previous timer, so a fast
 * typist produces exactly one settled value rather than one per keystroke. Feed
 * the *returned* value into a TanStack Query key — keying on the raw input
 * would fire a request per keystroke no matter how the UI is debounced.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
