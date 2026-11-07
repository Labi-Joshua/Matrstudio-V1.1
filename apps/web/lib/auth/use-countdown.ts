"use client";

import { useEffect, useState } from "react";

/** 875 -> "14:35", 5 -> "0:05". */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Counts down from `seconds` (null = idle) and returns the seconds left, 0 once finished. Uses a
 * deadline rather than counting ticks, so a throttled background tab does not drift.
 * `onDone` runs once when it reaches 0.
 */
export function useCountdown(seconds: number | null, onDone?: () => void): number {
  const [left, setLeft] = useState(seconds ?? 0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: onDone is read once per run on purpose
  useEffect(() => {
    if (seconds === null) {
      setLeft(0);
      return;
    }
    const deadline = Date.now() + seconds * 1000;
    setLeft(seconds);
    const id = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(id);
        onDone?.();
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [seconds]);

  return left;
}
