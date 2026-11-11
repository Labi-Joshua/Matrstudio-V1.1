"use client";

import { MINE_FILTERS } from "../../lib/app/paths-state";
import { getCatalogue } from "../../lib/catalogue/data";
import { ChevronDownIcon } from "../app/icons";
import { Chip } from "./filters";
import { SKELETON } from "./parts";

/**
 * Loading states (Figma "Catalogue: loading", "Path detail: loading", "My paths: loading"): the
 * shape of the screen as pulsing blocks (still under reduced motion), announced politely, with
 * aria-busy on the region. The two route skeletons are Suspense fallbacks (the ?q= and ?path=
 * reads suspend until the static page has hydrated) wrapped in DelayedFallback so a fast load
 * never flashes them. Filter chips and labels that are already known are drawn for real, as in
 * the frames.
 */

function Loading({ label }: { label: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {label}
    </p>
  );
}

const LEVEL_PILL =
  "hidden shrink-0 items-center gap-1.5 rounded-lg border border-border bg-bg-elevation-1 px-2.5 py-2 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] shadow-e1 md:inline-flex";

function CardGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {Array.from({ length: count }, (_, n) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          key={n}
          className={`${SKELETON} h-[348px] rounded-2xl ${n > 0 ? "hidden md:block" : ""}`}
        />
      ))}
    </div>
  );
}

function HeaderBars() {
  return (
    <div className="flex flex-col gap-2">
      <div className={`${SKELETON} h-4 w-[168px]`} />
      <div className={`${SKELETON} h-4 w-full max-w-[697px]`} />
    </div>
  );
}

export function CatalogueSkeleton() {
  const topics = getCatalogue().topics;
  return (
    <div aria-busy="true" className="mx-auto flex w-full flex-col gap-7">
      <Loading label="Loading paths" />
      <div aria-hidden="true" className="flex flex-col gap-7">
        <HeaderBars />
        <div className={`${SKELETON} h-10 w-full`} />
        <div className="flex items-start justify-between gap-4">
          <div className="-mx-5 flex min-w-0 flex-1 gap-2 overflow-hidden px-5 md:mx-0 md:flex-wrap md:px-0">
            <Chip inert active label="All" />
            {topics.map((topic) => (
              <Chip inert key={topic.slug} active={false} label={topic.name} />
            ))}
          </div>
          <span className={LEVEL_PILL}>
            Level: All levels
            <ChevronDownIcon size={20} />
          </span>
        </div>
        <div className={`${SKELETON} h-3 w-[49px]`} />
        <CardGrid count={6} />
      </div>
    </div>
  );
}

export function MyPathsSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Loading label="Loading your paths" />
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="-mx-5 flex gap-2 overflow-hidden px-5 md:mx-0 md:px-0">
          {MINE_FILTERS.map((option) => (
            <Chip inert key={option.value} active={option.value === "all"} label={option.label} />
          ))}
        </div>
        <div className={`${SKELETON} h-3 w-[49px]`} />
        <CardGrid count={3} />
      </div>
    </div>
  );
}

export function PathDetailSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto flex w-full flex-col gap-8">
      <Loading label="Loading path" />
      <div aria-hidden="true" className="flex flex-col gap-8">
        <div className={`${SKELETON} h-8 w-[102px]`} />
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:gap-14">
          <div className="order-2 flex flex-1 flex-col gap-5 xl:order-1">
            <div className="flex gap-2">
              <div className={`${SKELETON} h-7 w-[75px]`} />
              <div className={`${SKELETON} h-7 w-[68px]`} />
            </div>
            <div className={`${SKELETON} h-10 w-full max-w-[391px]`} />
            <div className={`${SKELETON} h-14 w-full max-w-[887px]`} />
            <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-8">
              {[0, 1, 2, 3].map((n) => (
                <div key={n} className={`${SKELETON} h-9 w-full sm:w-[110px]`} />
              ))}
            </div>
            <div className="flex gap-3">
              <div className={`${SKELETON} h-11 w-[103px]`} />
              <div className={`${SKELETON} h-11 w-[120px]`} />
            </div>
          </div>
          <div
            className={`${SKELETON} order-1 aspect-video w-full rounded-[20px] md:order-3 xl:order-2 xl:w-[460px] xl:shrink-0`}
          />
        </div>
        <hr className="m-0 border-border-soft border-t" />
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} className={`${SKELETON} h-[70px] rounded-xl`} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Figma "Lesson: loading": back link, title block, media, about card, buttons and the outline. */
export function LessonSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto flex w-full flex-col gap-6">
      <Loading label="Loading lesson" />
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className={`${SKELETON} h-8 w-[160px]`} />
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className={`${SKELETON} h-3 w-[70px]`} />
              <div className={`${SKELETON} h-9 w-full max-w-[380px]`} />
              <div className={`${SKELETON} h-4 w-[160px]`} />
            </div>
            <div className={`${SKELETON} aspect-video w-full rounded-2xl`} />
            <div className={`${SKELETON} h-[110px] w-full rounded-2xl`} />
            <div className={`${SKELETON} h-10 w-full rounded-lg`} />
          </div>
          <div className={`${SKELETON} hidden h-[580px] w-[320px] shrink-0 rounded-2xl md:block`} />
        </div>
      </div>
    </div>
  );
}
