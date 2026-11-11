"use client";

import { useEffect, useRef, useState } from "react";
import { hideDelay, showDelay } from "../../lib/app/library-loading";

/**
 * Whether to draw the skeleton for a load that is `pending`: false for the first ~150 ms, then
 * true, and it stays true for at least ~300 ms after it appeared even if loading ends sooner.
 */
export function useSkeletonGate(pending: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const startedAt = useRef(0);
  const shownAt = useRef(0);

  useEffect(() => {
    if (pending) {
      if (visible) return;
      startedAt.current = Date.now();
      const timer = window.setTimeout(
        () => {
          shownAt.current = Date.now();
          setVisible(true);
        },
        showDelay(startedAt.current, Date.now()),
      );
      return () => window.clearTimeout(timer);
    }
    if (!visible) return;
    const timer = window.setTimeout(
      () => setVisible(false),
      hideDelay(shownAt.current, Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [pending, visible]);

  return visible;
}
