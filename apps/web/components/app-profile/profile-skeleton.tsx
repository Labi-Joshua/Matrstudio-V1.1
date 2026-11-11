"use client";

import { BAR } from "../app-library/skeleton";

/**
 * Profile loading state (Figma "Profile: loading"): the header card, the Public profile row and
 * the two sections, as grey blocks. `visible` comes from useSkeletonGate (150 ms before it shows,
 * 300 ms minimum once shown), so a quick answer never flashes the blocks; the busy region and its
 * status text are always there, and the pulse stops under reduced motion (BAR).
 */
export function ProfileSkeleton({ visible }: { visible: boolean }) {
  return (
    <div role="status" aria-busy="true" className="flex min-h-[60vh] flex-col gap-5">
      <p className="sr-only">Loading your profile</p>
      {visible ? (
        <div aria-hidden="true" className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-border-soft p-5 md:flex-row md:p-6">
            <div className={`${BAR} size-16 shrink-0 rounded-full md:size-20`} />
            <div className="flex flex-1 flex-col gap-2.5">
              <div className={`${BAR} h-7 w-56`} />
              <div className={`${BAR} h-4 w-72 max-w-full`} />
              <div className={`${BAR} h-4 w-full max-w-[520px]`} />
              <div className="flex gap-1.5 pt-1">
                <div className={`${BAR} h-5 w-14`} />
                <div className={`${BAR} h-5 w-24`} />
                <div className={`${BAR} h-5 w-12`} />
              </div>
            </div>
            <div className={`${BAR} h-9 w-[104px] rounded-lg`} />
          </div>
          <div className={`${BAR} h-[66px] w-full rounded-xl`} />
          <div className="flex items-center justify-between pt-2">
            <div className={`${BAR} h-6 w-40`} />
            <div className={`${BAR} h-4 w-24`} />
          </div>
          <div className={`${BAR} h-24 w-full max-w-[420px] rounded-xl`} />
          <div className="flex items-center justify-between pt-2">
            <div className={`${BAR} h-6 w-32`} />
            <div className={`${BAR} h-4 w-28`} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className={`${BAR} h-[60px] rounded-xl`} />
            <div className={`${BAR} h-[60px] rounded-xl`} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
