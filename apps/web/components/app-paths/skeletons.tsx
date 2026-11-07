"use client";

import { SKELETON } from "./parts";

/**
 * Loading states (Figma "Catalogue: loading" and "Path detail: loading"): the shape of the screen
 * as pulsing blocks, announced politely. They are the Suspense fallbacks of the two routes (the
 * ?q= and ?path= reads suspend until the static page has hydrated). Marked client so the server
 * pages can use them without importing client-only helpers.
 */

const CHIP_WIDTHS = [
  ["all", 40],
  ["a", 64],
  ["b", 65],
  ["c", 78],
  ["d", 53],
  ["e", 108],
  ["f", 128],
  ["g", 104],
] as const;

export function CatalogueSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto flex w-full max-w-[1240px] flex-col gap-7">
      <p role="status" aria-live="polite" className="sr-only">
        Loading paths
      </p>
      <div aria-hidden="true" className="flex flex-col gap-7">
        <div className="flex flex-col gap-2">
          <div className={`${SKELETON} h-4 w-[168px]`} />
          <div className={`${SKELETON} h-4 w-full max-w-[697px]`} />
        </div>
        <div className={`${SKELETON} h-10 w-full`} />
        <div className="flex gap-2 overflow-hidden">
          {CHIP_WIDTHS.map(([key, width]) => (
            <div
              key={key}
              className={`${SKELETON} h-[34px] shrink-0 rounded-full`}
              style={{ width }}
            />
          ))}
        </div>
        <div className={`${SKELETON} h-3 w-[49px]`} />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`${SKELETON} h-[348px] rounded-2xl ${n > 0 ? "hidden md:block" : ""}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PathDetailSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto flex w-full max-w-[1240px] flex-col gap-8">
      <p role="status" aria-live="polite" className="sr-only">
        Loading path
      </p>
      <div aria-hidden="true" className="flex flex-col gap-8">
        <div className={`${SKELETON} h-8 w-[102px]`} />
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-14">
          <div className="order-2 flex flex-1 flex-col gap-5 lg:order-1">
            <div className="flex gap-2">
              <div className={`${SKELETON} h-7 w-[75px]`} />
              <div className={`${SKELETON} h-7 w-[68px]`} />
            </div>
            <div className={`${SKELETON} h-10 w-full max-w-[391px]`} />
            <div className={`${SKELETON} h-14 w-full max-w-[887px]`} />
            <div className="flex flex-wrap gap-8">
              {[0, 1, 2, 3].map((n) => (
                <div key={n} className={`${SKELETON} h-9 w-[110px]`} />
              ))}
            </div>
            <div className={`${SKELETON} h-11 w-[103px]`} />
          </div>
          <div
            className={`${SKELETON} order-1 aspect-video w-full rounded-[20px] lg:order-2 lg:w-[460px] lg:shrink-0`}
          />
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} className={`${SKELETON} h-[70px] rounded-xl`} />
          ))}
        </div>
      </div>
    </div>
  );
}
