import { useEffect, useRef, useState } from "react";

/** A skeleton only appears after this long, and once shown stays at least this long. */
export const SKELETON_DELAY_MS = 150;
export const SKELETON_MIN_MS = 300;

/** How much longer a skeleton shown at `shownAt` must stay up at `now`. */
export function skeletonHoldMs(shownAt: number, now: number): number {
  return Math.max(0, shownAt + SKELETON_MIN_MS - now);
}

/**
 * Gates a loading state so fast responses never flash a skeleton. `pending` is the real loading
 * state; the result says what to draw: nothing yet ("wait"), the skeleton, or the content.
 */
export function useSkeletonGate(pending: boolean): "wait" | "skeleton" | "content" {
  const [shown, setShown] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (pending) {
      if (shown) return;
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setShown(true);
      }, SKELETON_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (!shown) return;
    const timer = setTimeout(() => setShown(false), skeletonHoldMs(shownAt.current, Date.now()));
    return () => clearTimeout(timer);
  }, [pending, shown]);

  if (pending) return shown ? "skeleton" : "wait";
  return shown ? "skeleton" : "content";
}
