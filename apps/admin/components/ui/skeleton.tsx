import type { ReactNode } from "react";

export { SKELETON_DELAY_MS, SKELETON_MIN_MS, skeletonRemainingMs, useSkeletonGate } from "./hooks";

/**
 * A pulsing placeholder block (reduced motion: static). Use with `useSkeletonGate(pending)` so a
 * fast response never flashes one: `const show = useSkeletonGate(loading)`.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-md bg-bg-fill2 motion-safe:animate-pulse ${className}`}
    />
  );
}

/** Wraps skeleton content: marks the region busy and announces `label` politely. */
export function SkeletonRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div aria-busy="true">
      <p role="status" aria-live="polite" className="sr-only">
        {label}
      </p>
      {children}
    </div>
  );
}
