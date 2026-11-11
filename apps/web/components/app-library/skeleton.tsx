/**
 * Loading placeholders (Figma "Library: loading", "Resource: loading"): grey blocks in the shape
 * of the screen. The page is static, so these show while the search-params boundary resolves.
 */
"use client";

import { useSkeletonGate } from "./browse-loading";

export const BAR = "rounded-md bg-bg-fill2 motion-safe:animate-pulse";

function Loading({ label }: { label: string }) {
  return <p className="sr-only">{label}</p>;
}

export const GRID = "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";

export function CardSkeleton() {
  return (
    <div className="overflow-clip rounded-2xl border border-border-soft">
      <div className={`${BAR} h-[180px] w-full rounded-none`} />
      <div className="flex flex-col gap-2 px-4 py-3.5">
        <div className={`${BAR} h-5 w-3/4`} />
        <div className={`${BAR} h-4 w-1/3`} />
        <div className={`${BAR} mt-1.5 h-[22px] w-16`} />
      </div>
    </div>
  );
}

/**
 * Library loading frame: title and intro bars, topic chips, the Filters button row on phones
 * (the Type button beside the chips from md up), a card-shaped grid with the page's own column
 * counts, and the pagination bar. The blocks only appear after a short delay (useSkeletonGate),
 * so a fast load never flashes them; the busy region and its status text are always there.
 */
export function LibrarySkeleton() {
  const visible = useSkeletonGate(true);
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex min-h-[60vh] w-full max-w-[1240px] flex-col gap-6"
    >
      <Loading label="Loading the library" />
      {visible ? (
        <>
          <div className="flex flex-col gap-2.5" aria-hidden="true">
            <div className={`${BAR} h-8 w-24`} />
            <div className={`${BAR} h-5 w-full max-w-[560px]`} />
          </div>
          <div className="flex flex-col gap-3" aria-hidden="true">
            <div className="flex items-start gap-3">
              <div className="-mx-5 flex flex-1 gap-2 overflow-hidden px-5 md:mx-0 md:flex-wrap md:px-0">
                {["a", "b", "c", "d", "e", "f", "g", "h"].map((key, i) => (
                  <div
                    key={key}
                    className={`${BAR} h-8 shrink-0 rounded-full ${i % 3 === 0 ? "w-16" : i % 3 === 1 ? "w-20" : "w-24"}`}
                  />
                ))}
              </div>
              <div className={`${BAR} hidden h-9 w-[132px] shrink-0 rounded-lg md:block`} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className={`${BAR} h-4 w-44`} />
              <div className={`${BAR} h-9 w-24 rounded-lg md:hidden`} />
            </div>
          </div>
          <div className={GRID} aria-hidden="true">
            {["a", "b", "c", "d", "e", "f", "g", "h"].map((key) => (
              <CardSkeleton key={key} />
            ))}
          </div>
          <div className={`${BAR} h-9 w-full rounded-lg`} aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
}

export function ResourceSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex w-full max-w-[1240px] flex-col gap-6"
    >
      <Loading label="Loading the resource" />
      <div className={`${BAR} h-5 w-20`} aria-hidden="true" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" aria-hidden="true">
        <div className="flex flex-col gap-4">
          <div className={`${BAR} h-3 w-48`} />
          <div className={`${BAR} h-9 w-3/4`} />
          <div className={`${BAR} aspect-video w-full rounded-2xl`} />
          <div className={`${BAR} h-24 w-full rounded-xl`} />
          <div className="flex gap-2">
            <div className={`${BAR} h-10 w-24`} />
            <div className={`${BAR} h-10 w-40`} />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className={`${BAR} h-32 rounded-2xl`} />
          <div className={`${BAR} h-72 rounded-2xl`} />
        </div>
      </div>
    </div>
  );
}
