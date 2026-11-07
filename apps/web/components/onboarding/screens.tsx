"use client";

import { type ReactNode, useId } from "react";
import type { Level, TopicSlug } from "../../lib/catalogue/types";
import {
  GOAL_OPTIONS,
  type GoalId,
  LEVEL_OPTIONS,
  type LevelId,
  type OnboardingPath,
  TOPIC_OPTIONS,
} from "../../lib/pages/onboarding-content";
import { SpinnerIcon } from "../auth/icons";
import { TopicIcon } from "../landing/at-work-art";
import { GOAL_ICONS, LEVEL_ICONS } from "./icons";
import {
  CARD_FOCUS,
  ChoiceCard,
  ChoiceMark,
  cardBorder,
  QUESTION_HEADING_SIZE,
  StepEyebrow,
  StepHeading,
} from "./ui";

/** Right-pane content of each onboarding screen. The flow (onboarding-flow.tsx) owns state and buttons. */

const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};
const LEVEL_BADGE: Record<Level, string> = {
  beginner: "bg-success-focus text-success-text",
  intermediate: "bg-warning-focus text-warning-text",
  advanced: "bg-error-focus text-error-text",
};
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const SUBTLE = "text-[14px] text-text-secondary leading-5 tracking-[-0.14px]";

// ---------------------------------------------------------------------------------------------
// Welcome
// ---------------------------------------------------------------------------------------------

function MiniPath({
  topic,
  title,
  meta,
  className = "",
  children,
  trailing,
}: {
  topic: TopicSlug;
  title: string;
  meta: string;
  className?: string;
  children?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={`absolute flex items-center gap-3 whitespace-nowrap rounded-xl border border-border-soft bg-bg-base px-3.5 py-3 ${className}`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-accent text-primary-text">
        <TopicIcon topic={topic} size={18} />
      </span>
      <span className="flex flex-col gap-1.5">
        <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
          {title}
        </span>
        <span className="text-[12px] text-text-secondary leading-4 tracking-[-0.12px]">{meta}</span>
        {children}
      </span>
      {trailing}
    </div>
  );
}

/**
 * The welcome screen's right pane (desktop only): three mini path cards over a tinted panel, and
 * the description of the feature that is highlighted on the left. The cards are an illustration
 * of what a path looks like (Figma "Mini Path Card"), not catalogue data.
 */
export function WelcomePreview() {
  return (
    <>
      <div
        aria-hidden="true"
        className="relative h-[300px] shrink-0 overflow-hidden rounded-2xl bg-bg-fill2"
      >
        <MiniPath
          topic="brand"
          title="Brand Identity Basics"
          meta="Beginner · 9 lessons"
          className="top-10 left-[52%] opacity-45"
        />
        <MiniPath
          topic="ui-ux"
          title="UI/UX Design Foundations"
          meta="Lesson 3 of 12 · About 8 hours"
          className="top-[118px] left-[21%]"
          trailing={
            <span
              className={`flex items-center rounded-md px-1.5 py-[3px] font-medium text-[13px] leading-[18px] tracking-[-0.13px] ${LEVEL_BADGE.beginner}`}
            >
              Beginner
            </span>
          }
        >
          <span className="h-1 w-[180px] overflow-hidden rounded-[2px] bg-bg-fill2">
            <span className="block h-full w-1/4 rounded-[2px] bg-primary" />
          </span>
        </MiniPath>
        <MiniPath
          topic="design-systems"
          title="Design Systems 101"
          meta="Intermediate · 11 lessons"
          className="top-[212px] -left-3 opacity-45"
        />
      </div>
      <div className="flex flex-col gap-2 [word-break:break-word]">
        <h2 className="font-medium text-[18px] text-text leading-7 tracking-[-0.18px]">
          Learning paths
        </h2>
        <p className={`${SUBTLE} max-w-[440px]`}>
          Each path takes you from the basics to real projects using free videos and articles picked
          by our curators.
        </p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// The three questions
// ---------------------------------------------------------------------------------------------

function Question({
  step,
  title,
  description,
  titleId,
  fraction,
}: {
  step: number;
  title: string;
  description: string;
  titleId: string;
  fraction: number;
}) {
  return (
    <div className="flex flex-col gap-4 lg:gap-1.5">
      <StepEyebrow step={step} total={3} fraction={fraction} />
      <div className="flex flex-col gap-1.5 [word-break:break-word]">
        <div id={titleId}>
          <StepHeading className={QUESTION_HEADING_SIZE}>{title}</StepHeading>
        </div>
        <p className={SUBTLE}>{description}</p>
      </div>
    </div>
  );
}

export function GoalQuestion({
  value,
  onChange,
}: {
  value: GoalId | null;
  onChange: (value: GoalId) => void;
}) {
  const titleId = useId();
  return (
    <>
      <Question
        step={1}
        title="What brings you to Matr Studio?"
        description="Choose the one that fits best. You can change this later."
        titleId={titleId}
        fraction={1 / 3}
      />
      <div role="radiogroup" aria-labelledby={titleId} className="grid gap-3 lg:grid-cols-2">
        {GOAL_OPTIONS.map((option) => {
          const Icon = GOAL_ICONS[option.id];
          return (
            <ChoiceCard
              key={option.id}
              kind="radio"
              name="goal"
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              icon={<Icon size={20} />}
              title={option.title}
              description={option.description}
            />
          );
        })}
      </div>
    </>
  );
}

export function LevelQuestion({
  value,
  onChange,
}: {
  value: LevelId | null;
  onChange: (value: LevelId) => void;
}) {
  const titleId = useId();
  return (
    <>
      <Question
        step={2}
        title="How much experience do you have?"
        description="This helps us start you at the right level."
        titleId={titleId}
        fraction={2 / 3}
      />
      <div role="radiogroup" aria-labelledby={titleId} className="flex flex-col gap-3">
        {LEVEL_OPTIONS.map((option) => {
          const Icon = LEVEL_ICONS[option.id];
          return (
            <ChoiceCard
              key={option.id}
              kind="radio"
              name="level"
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              icon={<Icon size={20} />}
              title={option.title}
              description={option.description}
            />
          );
        })}
      </div>
    </>
  );
}

export function TopicsQuestion({
  value,
  onToggle,
}: {
  value: TopicSlug[];
  onToggle: (topic: TopicSlug) => void;
}) {
  const titleId = useId();
  return (
    <>
      <Question
        step={3}
        title="What do you want to learn?"
        description="Pick as many as you like."
        titleId={titleId}
        fraction={1}
      />
      <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0 lg:grid-cols-2">
        <legend className="sr-only">What do you want to learn? Pick as many as you like.</legend>
        {TOPIC_OPTIONS.map((option) => (
          <ChoiceCard
            key={option.id}
            kind="checkbox"
            name="topics"
            value={option.id}
            checked={value.includes(option.id)}
            onChange={() => onToggle(option.id)}
            icon={<TopicIcon topic={option.id} size={20} />}
            title={option.title}
            description={option.description}
          />
        ))}
      </fieldset>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Finding your path
// ---------------------------------------------------------------------------------------------

/** The short loading state. The spinner only turns when the visitor allows motion (SpinnerIcon). */
export function FindingState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-primary-accent text-primary-text">
        <SpinnerIcon size={28} />
      </span>
      <div className="flex flex-col gap-1 [word-break:break-word]">
        <StepHeading className="text-[20px] leading-7 tracking-[-0.2px]">
          Finding your path…
        </StepHeading>
        <p className={SUBTLE}>Matching your goal, level and topics to our learning paths.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Recommended path
// ---------------------------------------------------------------------------------------------

/** Orange tile with the topic's glyph (Figma Icon tile, path variant). */
export function PathTile({ topic, size }: { topic: TopicSlug; size: "sm" | "lg" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-primary-accent text-primary-text ${
        size === "lg" ? "size-11 rounded-xl" : "size-9 rounded-lg"
      }`}
    >
      <TopicIcon topic={topic} size={size === "lg" ? 22 : 18} />
    </span>
  );
}

const CHIP =
  "rounded-md border border-border-soft-alpha px-2 py-0.5 text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]";

export function RecommendedPath({ path }: { path: OnboardingPath }) {
  const chips = [
    `${path.lessons} ${plural(path.lessons, "lesson", "lessons")}`,
    ...(path.hours === null ? [] : [`About ${path.hours} ${plural(path.hours, "hour", "hours")}`]),
    "Free resources",
  ];
  return (
    <>
      <div className="flex flex-col gap-3 [word-break:break-word]">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary-accent px-2 py-1 text-[13px] text-primary-text leading-[18px] tracking-[-0.13px]">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          Recommended for you
        </span>
        <div className="flex flex-col gap-1.5">
          <StepHeading className={QUESTION_HEADING_SIZE}>Start with {path.title}</StepHeading>
          <p className={SUBTLE}>Based on your goal, your level and the topics you picked.</p>
        </div>
      </div>
      <article
        aria-label={path.title}
        className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-bg-base p-4"
      >
        <div className="flex flex-col gap-3 lg:gap-2">
          <div className="flex items-center gap-3">
            <PathTile topic={path.topicSlug} size="lg" />
            <h2 className="font-medium text-[18px] text-text leading-7 tracking-[-0.18px] [word-break:break-word]">
              {path.title}
            </h2>
          </div>
          <ul className="flex flex-wrap gap-2">
            <li
              className={`rounded-md px-2 py-0.5 font-medium text-[13px] leading-[18px] tracking-[-0.13px] ${LEVEL_BADGE[path.level]}`}
            >
              {LEVEL_LABEL[path.level]}
            </li>
            {chips.map((chip) => (
              <li key={chip} className={CHIP}>
                {chip}
              </li>
            ))}
          </ul>
        </div>
        {path.firstLessons.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
              First lessons
            </h3>
            <ol className="flex flex-col gap-3 lg:gap-2.5">
              {path.firstLessons.map((lesson, index) => (
                <li key={lesson.title} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-accent text-[12px] text-primary-text leading-4"
                  >
                    {index + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-3">
                    <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px] [word-break:break-word]">
                      {lesson.title}
                    </span>
                    <span className="text-[12px] text-text-secondary leading-4 tracking-[-0.12px] lg:shrink-0">
                      {lesson.meta}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </article>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// All paths
// ---------------------------------------------------------------------------------------------

function PathOption({
  path,
  checked,
  closest,
  onSelect,
}: {
  path: OnboardingPath;
  checked: boolean;
  closest: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-bg-base p-3 ${cardBorder(checked)} ${CARD_FOCUS}`}
    >
      <input
        type="radio"
        name="path"
        value={path.slug}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <PathTile topic={path.topicSlug} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col [word-break:break-word]">
        <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
          {path.title}
        </span>
        <span
          className={`text-[12px] leading-4 tracking-[-0.12px] ${closest ? "lg:text-primary-text" : ""} text-text-secondary`}
        >
          {LEVEL_LABEL[path.level]} · {path.lessons} {plural(path.lessons, "lesson", "lessons")}
          {closest ? <span className="hidden lg:inline"> · Closest match</span> : null}
        </span>
      </span>
      {closest ? (
        <span className="shrink-0 rounded-md bg-primary-accent px-2 py-0.5 font-medium text-[13px] text-primary-text leading-[18px] tracking-[-0.13px] lg:hidden">
          Closest match
        </span>
      ) : null}
      <span className="lg:hidden">
        <ChoiceMark kind="radio" checked={checked} />
      </span>
    </label>
  );
}

export function AllPaths({
  paths,
  selected,
  closestSlug,
  noMatch,
  onSelect,
}: {
  paths: OnboardingPath[];
  selected: string | null;
  closestSlug: string | null;
  /** True when no path covered the learner's topics (copy says so), false when they chose to browse. */
  noMatch: boolean;
  onSelect: (slug: string) => void;
}) {
  const titleId = useId();
  return (
    <>
      <div className="flex flex-col gap-1.5 [word-break:break-word]">
        <div id={titleId}>
          <StepHeading className={QUESTION_HEADING_SIZE}>All learning paths</StepHeading>
        </div>
        <p className={SUBTLE}>
          {noMatch ? (
            <>
              We didn’t find an exact match, so here’s everything.{" "}
              <span className="hidden lg:inline">The closest one is marked.</span>
              <span className="lg:hidden">Pick one to see what’s inside.</span>
            </>
          ) : (
            <>Pick one to see what’s inside. The closest match to your answers is marked.</>
          )}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={titleId}
        className="grid gap-2 lg:grid-cols-2 lg:gap-2.5"
      >
        {paths.map((path) => (
          <PathOption
            key={path.slug}
            path={path}
            checked={selected === path.slug}
            closest={closestSlug === path.slug}
            onSelect={() => onSelect(path.slug)}
          />
        ))}
      </div>
    </>
  );
}
