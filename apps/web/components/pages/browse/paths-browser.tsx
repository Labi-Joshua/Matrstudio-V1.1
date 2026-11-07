"use client";

import Link from "next/link";
import { useState } from "react";
import type { Level, Topic } from "../../../lib/catalogue/types";
import type { BrowsePath } from "../../../lib/pages/browse-paths";
import { ROUTES } from "../../../lib/routes";
import { BookIcon, ClockIcon, PathCover, StarOutline, TOPIC_LOOK } from "../../landing/at-work-art";

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};
export const LEVEL_CLASS: Record<Level, string> = {
  beginner: "bg-success-focus text-success-text",
  intermediate: "bg-warning-focus text-warning-text",
  advanced: "bg-error-focus text-error-text",
};

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Path Card (Figma 780:11840): cover, level badge, title, blurb, lessons and hours. */
export function BrowsePathCard({ path }: { path: BrowsePath }) {
  return (
    <article className="card-lift relative flex flex-col overflow-clip rounded-2xl border border-border-soft bg-bg-base">
      <PathCover topic={path.topicSlug} hue={TOPIC_LOOK[path.topicSlug].cover} />
      <span
        aria-hidden="true"
        className="absolute top-[11px] right-[11px] flex size-9 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text"
      >
        <StarOutline />
      </span>
      <div className="flex flex-col items-start gap-2 px-4 pt-4 pb-[18px]">
        <span className={`rounded-md px-1.5 py-[3px] ${LEVEL_CLASS[path.level]}`}>
          <span className="block px-0.5 font-medium text-[13px] leading-[18px] tracking-[-0.13px]">
            {LEVEL_LABEL[path.level]}
          </span>
        </span>
        <h3 className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
          {/* TODO: link to the path itself once path pages exist; the topic page for now. */}
          <Link href={ROUTES.topic(path.topicSlug)} className="after:absolute after:inset-0">
            {path.title}
          </Link>
        </h3>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          {path.description}
        </p>
        <p className="flex items-center gap-3.5 pt-1 font-medium text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
          <span className="flex items-center gap-1">
            <BookIcon />
            {path.lessons} {plural(path.lessons, "lesson", "lessons")}
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon />
            {path.hours} hrs
          </span>
        </p>
      </div>
    </article>
  );
}

const CHIP =
  "rounded-md px-1.5 py-1 font-medium text-[14px] leading-5 tracking-[-0.14px] transition-colors";

/** Topic filter chips, the "N paths" counter and the grid of path cards (Figma "All paths"). */
export function PathsBrowser({ paths, topics }: { paths: BrowsePath[]; topics: Topic[] }) {
  const [topic, setTopic] = useState<string>("all");
  const shown = topic === "all" ? paths : paths.filter((path) => path.topicSlug === topic);
  const chips = [{ slug: "all", name: "All" }, ...topics];

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
          <legend className="sr-only">Filter paths by topic</legend>
          {chips.map((chip) => {
            const active = chip.slug === topic;
            return (
              <button
                key={chip.slug}
                type="button"
                aria-pressed={active}
                onClick={() => setTopic(chip.slug)}
                className={`${CHIP} ${
                  active
                    ? "bg-primary-focus text-primary-text"
                    : "border border-border-soft-alpha text-text-secondary hover:bg-bg-fill1"
                }`}
              >
                <span className="px-0.5">{chip.name}</span>
              </button>
            );
          })}
        </fieldset>
        <p
          aria-live="polite"
          className="shrink-0 whitespace-nowrap font-mono text-[12px] text-text-tertiary uppercase tracking-[0.72px] md:pt-1.5"
        >
          {shown.length} {plural(shown.length, "path", "paths")} · all free
        </p>
      </div>

      {shown.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((path) => (
            <BrowsePathCard key={path.slug} path={path} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-border-soft bg-bg-fill1 p-8 text-center text-[16px] text-text-secondary leading-6">
          No paths in this topic yet.
        </p>
      )}
    </>
  );
}
