"use client";

import { BAR, CardSkeleton, GRID } from "../app-library/skeleton";

/**
 * Saved list loading state: the count line, the Type button and card-shaped blocks in the list's
 * own grid. `visible` comes from useSkeletonGate (150 ms before it shows, 300 ms minimum once
 * shown), so a quick answer never flashes the blocks; the busy region and its status text are
 * always there, and the pulse stops under reduced motion (BAR).
 */
export function SavedListSkeleton({ visible }: { visible: boolean }) {
  return (
    <div role="status" aria-busy="true" className="flex min-h-[50vh] flex-col gap-4">
      <p className="sr-only">Loading your saved resources</p>
      {visible ? (
        <>
          <div className="flex items-center justify-between gap-3" aria-hidden="true">
            <div className={`${BAR} h-4 w-36`} />
            <div className={`${BAR} h-9 w-[132px] rounded-lg`} />
          </div>
          <div className={GRID} aria-hidden="true">
            {["a", "b", "c", "d", "e", "f", "g", "h"].map((key) => (
              <CardSkeleton key={key} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
