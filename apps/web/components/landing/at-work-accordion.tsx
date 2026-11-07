"use client";

import { type CSSProperties, type KeyboardEvent, useRef, useState } from "react";
import {
  BookIcon,
  ChevronDown,
  ClockIcon,
  PathCover,
  StarOutline,
  TOPIC_LOOK,
} from "./at-work-art";
import type { PathCardView, TopicView } from "./at-work-data";

/**
 * Figma "At work": Topic · <name> (closed 740:37973, open 740:37953 and the 760:/761:/765: open
 * frames). One topic open at a time, the first by default; every panel is in the HTML (hidden when
 * closed) so crawlers and the static export see all of it. Header = button with aria-expanded /
 * aria-controls, panel = region labelled by its header; Up/Down/Home/End move between headers.
 */

const LEVEL_LABEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const LEVEL_CLASS = {
  beginner: "bg-success-focus text-success-text",
  intermediate: "bg-warning-focus text-warning-text",
  advanced: "bg-error-focus text-error-text",
};

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** Stat chips of the colour panel: only what the catalogue can back up. */
function statChips(topic: TopicView): string[] {
  const chips = [`${topic.paths} ${plural(topic.paths, "path", "paths")}`];
  if (topic.lessons > 0)
    chips.push(`${topic.lessons} ${plural(topic.lessons, "lesson", "lessons")}`);
  if (topic.hours > 0) chips.push(`about ${Math.round(topic.hours)} hrs`);
  for (const level of topic.levels) chips.push(LEVEL_LABEL[level]);
  chips.push("free");
  return chips;
}

function PathCard({ card, topic }: { card: PathCardView; topic: TopicView }) {
  return (
    <article className="card-lift relative flex flex-col overflow-clip rounded-2xl border border-border-soft bg-bg-base xl:w-[340px]">
      <PathCover topic={topic.slug} hue={TOPIC_LOOK[topic.slug].cover} />
      <span
        aria-hidden="true"
        className="absolute top-[11px] right-[11px] flex size-9 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text"
      >
        <StarOutline />
      </span>
      <div className="flex flex-col items-start gap-2 px-4 pt-4 pb-[18px]">
        <span className={`rounded-md px-1.5 py-[3px] ${LEVEL_CLASS[card.level]}`}>
          <span className="block px-0.5 font-medium text-[13px] leading-[18px] tracking-[-0.13px]">
            {LEVEL_LABEL[card.level]}
          </span>
        </span>
        <h4 className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
          {card.title}
        </h4>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          {card.description}
        </p>
        <p className="flex items-center gap-3.5 pt-1 font-medium text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
          <span className="flex items-center gap-1">
            <BookIcon />
            {card.lessons} {plural(card.lessons, "lesson", "lessons")}
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon />
            {card.hours} hrs
          </span>
        </p>
      </div>
    </article>
  );
}

/** Empty topic: the Figma card shape with the topic's cover and blank lines, no invented copy. */
function PlaceholderCard({ topic }: { topic: TopicView }) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col overflow-clip rounded-2xl border border-border-soft bg-bg-base xl:w-[340px]"
    >
      <PathCover topic={topic.slug} hue={TOPIC_LOOK[topic.slug].cover} />
      <div className="flex flex-col items-start gap-2.5 px-4 pt-4 pb-[18px]">
        <span className="h-6 w-20 rounded-md bg-bg-fill2" />
        <span className="h-6 w-48 rounded-md bg-bg-fill2" />
        <span className="h-5 w-full rounded-md bg-bg-fill1" />
        <span className="h-4 w-32 rounded-md bg-bg-fill1" />
      </div>
    </div>
  );
}

function Panel({ topic }: { topic: TopicView }) {
  const style = { background: TOPIC_LOOK[topic.slug].panel } as CSSProperties;
  return (
    <div
      style={style}
      className="flex flex-col justify-between gap-0 p-6 text-static-white md:gap-6 md:p-10 xl:flex-1"
    >
      <p className="font-medium text-[24px] leading-[30px] tracking-[-0.24px] md:text-[30px] md:leading-[38px] md:tracking-[-0.3px]">
        {topic.quote ? `“${topic.quote}”` : "Paths for this topic are on their way."}
      </p>
      {topic.sourcePath ? (
        <p className="font-medium text-[14px] leading-5 tracking-[-0.14px]">
          From the {topic.sourcePath} path
        </p>
      ) : null}
      <ul className="flex flex-wrap items-center gap-2">
        {statChips(topic).map((chip) => (
          <li
            key={chip}
            className="rounded-md border border-static-white px-2.5 py-1.5 font-mono text-[10px] uppercase leading-[normal] tracking-[0.6px] md:text-[11px] md:tracking-[0.66px]"
          >
            {chip}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AtWorkAccordion({ topics }: { topics: TopicView[] }) {
  const [openSlug, setOpenSlug] = useState<string | null>(topics[0]?.slug ?? null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = topics.length - 1;
    const target =
      event.key === "ArrowDown"
        ? (index + 1) % topics.length
        : event.key === "ArrowUp"
          ? (index - 1 + topics.length) % topics.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    buttons.current[target]?.focus();
  }

  return (
    <div>
      {topics.map((topic, index) => {
        const open = openSlug === topic.slug;
        const buttonId = `at-work-${topic.slug}-header`;
        const panelId = `at-work-${topic.slug}-panel`;
        return (
          <div key={topic.slug} className="border-border-soft border-b">
            <h3>
              <button
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                id={buttonId}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenSlug(open ? null : topic.slug)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className="flex w-full cursor-pointer items-center gap-4 px-4 py-5 text-left transition-colors hover:bg-bg-fill1 md:px-10 md:py-7"
              >
                <span className="min-w-0 flex-1 font-medium text-[22px] text-text leading-[27px] tracking-[-0.22px] md:text-[26px] md:leading-9 md:tracking-[-0.26px]">
                  {topic.name}
                </span>
                <span className="shrink-0 font-mono text-[12px] text-text-tertiary uppercase leading-[normal] tracking-[0.48px]">
                  {topic.paths} {plural(topic.paths, "path", "paths")}
                </span>
                <ChevronDown
                  className={`size-[18px] shrink-0 text-text transition-transform duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                />
              </button>
            </h3>
            {/* Opens and closes by animating the row height (0fr to 1fr), so it needs no measured
                heights and works for any content. Closed panels stay in the HTML but are inert,
                so they are out of the tab order and the accessibility tree. */}
            <section
              id={panelId}
              aria-labelledby={buttonId}
              inert={!open}
              className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none ${
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
              data-open={open}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="flex flex-col gap-4 px-4 pt-1 pb-4 md:px-10 md:pb-10 xl:flex-row">
                  <Panel topic={topic} />
                  <div className="grid gap-4 md:grid-cols-2 xl:flex xl:shrink-0">
                    {topic.cards.length > 0 ? (
                      topic.cards.map((card) => (
                        <PathCard key={card.slug} card={card} topic={topic} />
                      ))
                    ) : (
                      <PlaceholderCard topic={topic} />
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
}
