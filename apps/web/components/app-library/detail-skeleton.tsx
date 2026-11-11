"use client";

import { useEffect, useState } from "react";

/**
 * Loading placeholder of the resource page (Figma "Resource: loading", Desktop, Tablet, Phone):
 * grey blocks in the shape of the page, one column below xl and a side column from xl. It only
 * appears after 150 ms so a fast load shows no flash. The status line is read out, the blocks are
 * hidden from assistive tech, and the pulse is off under prefers-reduced-motion.
 */
const BAR = "rounded-md bg-bg-fill2 motion-safe:animate-pulse";
const SHOW_AFTER_MS = 150;

export function ResourceDetailSkeleton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div role="status" aria-busy="true" className="mx-auto flex w-full flex-col gap-6">
      <p className="sr-only">Loading the resource</p>
      {visible ? (
        <>
          <div aria-hidden="true" className={`${BAR} h-8 w-[88px] rounded-lg`} />
          <div aria-hidden="true" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className={`${BAR} h-2.5 w-28`} />
                <div className={`${BAR} h-3 w-full max-w-[360px]`} />
                <div className={`${BAR} h-3 w-40`} />
                <div className="flex items-center gap-2">
                  <div className={`${BAR} size-3 rounded-full`} />
                  <div className={`${BAR} h-2.5 w-24`} />
                </div>
              </div>
              <div className={`${BAR} aspect-[16/10] w-full rounded-2xl md:aspect-video`} />
              <div className="flex flex-col gap-3 rounded-2xl bg-bg-fill1 p-4">
                <div className={`${BAR} h-3 w-32`} />
                <div className={`${BAR} h-2.5 w-full`} />
                <div className={`${BAR} h-2.5 w-3/4`} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-2">
                  <div className={`${BAR} h-10 w-24 rounded-lg`} />
                  <div className={`${BAR} h-10 w-32 rounded-lg`} />
                </div>
                <div className={`${BAR} h-4 w-36 rounded-full`} />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-border-soft p-4">
                <div className={`${BAR} h-3 w-full`} />
                <div className={`${BAR} h-3 w-2/3`} />
                <div className={`${BAR} h-12 w-full rounded-xl`} />
                <div className={`${BAR} h-12 w-full rounded-xl`} />
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-border-soft p-4">
                <div className={`${BAR} h-3 w-full`} />
                <div className={`${BAR} h-44 w-full rounded-xl`} />
                <div className={`${BAR} h-44 w-full rounded-xl`} />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
