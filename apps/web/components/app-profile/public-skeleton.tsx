"use client";

import { BAR } from "../app-library/skeleton";

/** Loading frame of the public profile: header card, stat blocks and a list. Same timing rules as ProfileSkeleton. */
export function PublicSkeleton({ visible }: { visible: boolean }) {
  return (
    <div role="status" aria-busy="true" className="flex min-h-[50vh] flex-col gap-5">
      <p className="sr-only">Loading this profile</p>
      {visible ? (
        <div aria-hidden="true" className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-border-soft p-5 md:flex-row md:p-6">
            <div className={`${BAR} size-16 shrink-0 rounded-full md:size-20`} />
            <div className="flex flex-1 flex-col gap-2.5">
              <div className={`${BAR} h-7 w-56`} />
              <div className={`${BAR} h-4 w-72 max-w-full`} />
              <div className={`${BAR} h-4 w-full max-w-[520px]`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {["a", "b", "c", "d"].map((key) => (
              <div key={key} className={`${BAR} h-[60px] rounded-xl`} />
            ))}
          </div>
          <div className={`${BAR} h-6 w-40`} />
          <div className={`${BAR} h-[60px] w-full rounded-xl`} />
        </div>
      ) : null}
    </div>
  );
}
