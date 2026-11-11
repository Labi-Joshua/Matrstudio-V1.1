"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Whether the browser reports a connection (navigator.onLine plus the online and offline events).
 * It starts as online so the static HTML matches the first client render, then syncs on mount.
 * `recheck` re-reads the flag for a "Try again" button; the events keep it current after that.
 */
export function useOnline(): { online: boolean; recheck: () => boolean } {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const recheck = useCallback(() => {
    setOnline(navigator.onLine);
    return navigator.onLine;
  }, []);

  return { online, recheck };
}
