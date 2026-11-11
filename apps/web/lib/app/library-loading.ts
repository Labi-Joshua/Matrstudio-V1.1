/**
 * Skeleton timing: a fast response never flashes a placeholder (it only appears once loading has
 * lasted SHOW_AFTER_MS), and once shown it stays for at least MIN_SHOW_MS so it does not flicker.
 */
export const SHOW_AFTER_MS = 150;
export const MIN_SHOW_MS = 300;

/** Milliseconds to wait before showing the skeleton for a load that began at `startedAt`. */
export function showDelay(startedAt: number, now: number): number {
  return Math.max(0, SHOW_AFTER_MS - (now - startedAt));
}

/** Milliseconds the skeleton must stay up after loading finished, given when it was shown. */
export function hideDelay(shownAt: number, now: number): number {
  return Math.max(0, MIN_SHOW_MS - (now - shownAt));
}
