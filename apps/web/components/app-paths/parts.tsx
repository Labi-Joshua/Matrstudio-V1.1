import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { LEVEL_LABEL, plural } from "../../lib/app/paths-catalogue";
import type { Level, TopicSlug } from "../../lib/catalogue/types";
import type { BrowsePath } from "../../lib/pages/browse-paths";
import { CircleCheckIcon, CloseIcon, RouteIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { BookIcon, ClockIcon, PathCover, TOPIC_LOOK, TopicIcon } from "../landing/at-work-art";
import { CheckIcon, FunnelXIcon, StarIcon } from "./icons";

/** Small building blocks shared by the Paths catalogue, search results and path detail. */

/** Beginner green, Intermediate amber, Advanced rose (the design); rose maps to the error tokens. */
export const LEVEL_CLASS: Record<Level, string> = {
  beginner: "bg-success-focus text-success-text",
  intermediate: "bg-warning-focus text-warning-text",
  advanced: "bg-error-focus text-error-text",
};

export function LevelBadge({ level, large = false }: { level: Level; large?: boolean }) {
  return (
    <span
      className={`inline-flex rounded-md px-1.5 ${large ? "py-1" : "py-[3px]"} ${LEVEL_CLASS[level]}`}
    >
      <span
        className={`block px-0.5 font-medium tracking-[-0.13px] ${large ? "text-[14px] leading-5" : "text-[13px] leading-[18px]"}`}
      >
        {LEVEL_LABEL[level]}
      </span>
    </span>
  );
}

/** Marks design sample data so it is never read as real catalogue content or the learner's own. */
export function SampleTag() {
  return (
    <span className="rounded-md bg-bg-fill2 px-1.5 py-0.5 font-medium text-[12px] text-text-secondary leading-4 tracking-[-0.12px]">
      Sample content
    </span>
  );
}

/**
 * Path Card (Figma "Path Card"). The star and the progress strip with its "Lesson 5 of 10" pill
 * only render when given: both need APIs that do not exist, so the catalogue passes neither.
 */
export function PathCard({
  path,
  href,
  star,
  progress,
}: {
  path: BrowsePath;
  href: string;
  star?: { starred: boolean; onToggle: () => void };
  progress?: { label: string; percent: number } | null;
}) {
  return (
    <li className="relative min-w-0">
      <Link
        href={href}
        className={`card-lift flex h-full flex-col overflow-clip rounded-2xl border border-border-soft bg-bg-base ${FOCUS}`}
      >
        <span className="relative block">
          <PathCover topic={path.topicSlug} hue={TOPIC_LOOK[path.topicSlug].cover} />
          {progress ? (
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-bg-fill2">
              <span className="block h-full bg-primary" style={{ width: `${progress.percent}%` }} />
            </span>
          ) : null}
        </span>
        <span className="flex flex-col items-start gap-2 px-4 pt-4 pb-[18px]">
          <span className="flex flex-wrap items-center gap-1.5">
            <LevelBadge level={path.level} />
            {progress ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary-accent px-1.5 py-[3px] font-medium text-[13px] text-primary-text leading-[18px] tracking-[-0.13px]">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                {progress.label}
              </span>
            ) : null}
          </span>
          <span className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
            {path.title}
          </span>
          <span className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
            {path.description}
          </span>
          <span className="flex items-center gap-3.5 pt-1 font-medium text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
            <span className="flex items-center gap-1">
              <BookIcon />
              {path.lessons} {plural(path.lessons, "lesson", "lessons")}
            </span>
            <span className="flex items-center gap-1">
              <ClockIcon />
              {path.hours} hrs
            </span>
          </span>
        </span>
      </Link>
      {star ? (
        <button
          type="button"
          aria-pressed={star.starred}
          aria-label={`Star ${path.title}`}
          onClick={star.onToggle}
          className={`absolute top-3 right-3 flex size-9 items-center justify-center rounded-lg border bg-bg-base ${FOCUS} ${
            star.starred ? "border-primary text-primary" : "border-border-soft text-text-secondary"
          }`}
        >
          <StarIcon size={18} fill={star.starred ? "currentColor" : "none"} />
        </button>
      ) : null}
    </li>
  );
}

export function PathGrid({ children }: { children: ReactNode }) {
  return <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-3">{children}</ul>;
}

/** The large cover of the path detail (Figma 560 x 315, radius 20), same art as the card cover. */
export function LargeCover({ topic }: { topic: TopicSlug }) {
  const style = { "--h": TOPIC_LOOK[topic].cover } as CSSProperties;
  return (
    <div
      aria-hidden="true"
      style={style}
      className="relative aspect-video w-full shrink-0 overflow-clip rounded-[20px] bg-[color-mix(in_srgb,var(--h)_14%,var(--matr-bg-base))]"
    >
      <div className="absolute inset-[22.22%_-25%_-50%_53.13%] rounded-full bg-[color-mix(in_srgb,var(--h)_26%,var(--matr-bg-base))]" />
      <div className="absolute inset-[-27.78%_71.88%_55.56%_-12.5%] rounded-full bg-[color-mix(in_srgb,var(--h)_22%,var(--matr-bg-base))]" />
      <div className="absolute inset-[49.82%_54.43%_-6.39%_13.75%] -rotate-14 rounded-[20px] bg-[color-mix(in_srgb,var(--h)_55%,var(--matr-bg-base))]" />
      <div className="absolute top-[14.44%] left-[66.25%] size-3.5 rounded-full bg-(--h)" />
      <div className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[18px] bg-bg-base text-(--h) shadow-e2">
        <TopicIcon topic={topic} size={30} />
      </div>
    </div>
  );
}

export const BUTTON_PRIMARY = `btn-lift inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 font-medium text-[14px] text-static-white leading-5 tracking-[-0.14px] ${FOCUS}`;
export const BUTTON_SECONDARY = `btn-lift inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-elevation-1 px-2.5 py-2 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] shadow-e1 ${FOCUS}`;

/** "Filters match nothing" and "no search results" (Figma Empty States): art, copy, buttons. */
export function EmptyState({
  title,
  body,
  children,
  art = "filter",
}: {
  title: string;
  body: string;
  children?: ReactNode;
  art?: "filter" | "paths" | "done";
}) {
  return (
    <div className="mx-auto flex w-full max-w-[360px] flex-col items-center gap-6 px-5 py-12 text-center md:pt-20">
      {art === "filter" ? <FilterArt /> : <ListArt done={art === "done"} />}
      <div className="flex flex-col gap-1.5">
        <h2 className="font-medium text-[16px] text-text leading-6 tracking-[-0.16px]">{title}</h2>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">{body}</p>
      </div>
      {children ? <div className="flex flex-wrap justify-center gap-2.5">{children}</div> : null}
    </div>
  );
}

function FilterArt() {
  return (
    <div aria-hidden="true" className="flex w-[119px] flex-col gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-primary-border bg-bg-base px-2 py-1.5">
        <FunnelXIcon size={16} className="shrink-0 text-primary-text" />
        <div className="flex w-full flex-col gap-1">
          <div className="h-[5px] w-full rounded-[1px] bg-primary-accent" />
          <div className="h-[5px] w-[52px] rounded-[1px] bg-primary-accent" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border border-primary-border border-dashed bg-bg-base px-2 py-1.5">
        <div className="size-4 shrink-0 rounded-full border border-primary-border bg-primary-accent" />
        <div className="flex w-full flex-col gap-1">
          <div className="h-[5px] w-full rounded-[1px] bg-primary-accent" />
          <div className="h-[5px] w-[52px] rounded-[1px] bg-primary-accent" />
        </div>
      </div>
    </div>
  );
}

/** My paths empty art: stacked rows, with check marks for "Completed". */
function ListArt({ done }: { done: boolean }) {
  return (
    <div aria-hidden="true" className="flex w-[104px] flex-col gap-2">
      {[0, 1].map((row) => (
        <div
          key={row}
          className={`flex items-center gap-1.5 rounded-lg border bg-bg-base px-2 py-1.5 ${
            row === 0 ? "border-primary-border" : "border-primary-border border-dashed"
          }`}
        >
          <div
            className={`flex size-4 shrink-0 items-center justify-center rounded-full border border-primary-border bg-primary-accent ${done ? "text-primary-text" : ""}`}
          >
            {done ? <CheckIcon size={10} /> : null}
          </div>
          <div className="flex w-full flex-col gap-1">
            <div className="h-[5px] w-full rounded-[1px] bg-primary-accent" />
            <div className="h-[5px] w-[40px] rounded-[1px] bg-primary-accent" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** "We couldn't load paths" / "This path isn't available" (Figma states: icon badge, title, copy, button). */
export function ErrorState({
  title,
  body,
  children,
  level = 1,
}: {
  title: string;
  body: string;
  children: ReactNode;
  /** The title is the page h1 unless the screen already has one (My paths keeps its header). */
  level?: 1 | 2;
}) {
  const Title = level === 1 ? "h1" : "h2";
  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-[460px] flex-col items-center gap-3.5 px-4 pt-16 pb-16 text-center md:pt-24"
    >
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-full border-[1.5px] border-border border-dashed bg-error-accent text-error-text"
      >
        <RouteIcon size={28} />
      </span>
      <Title className="font-semibold text-[24px] text-text leading-8 tracking-[-0.24px]">
        {title}
      </Title>
      <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">{body}</p>
      <div className="pt-1.5">{children}</div>
    </div>
  );
}

/** Dark "Try again" / "Browse paths" button of the error states (Figma Button-Primary, text fill). */
export const BUTTON_INVERSE = `btn-lift inline-flex items-center justify-center gap-1.5 rounded-lg bg-text px-3 py-2.5 font-medium text-[14px] text-bg-base leading-5 tracking-[-0.14px] ${FOCUS}`;

export const SKELETON = "rounded-md bg-bg-fill2 motion-safe:animate-pulse";

/**
 * Toast (Figma "Toast": green check, title, copy, close), centred at the top of the page like the
 * auth toasts. Presentational: the path detail only mounts it when a real star handler exists.
 */
export function Toast({
  title,
  body,
  onClose,
}: {
  title: string;
  body: string;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4 md:top-5">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-[440px] items-start gap-3 rounded-xl border border-border-soft bg-bg-base p-3.5 shadow-e2"
      >
        <CircleCheckIcon size={20} className="mt-0.5 shrink-0 text-success-text" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">{title}</p>
          <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">{body}</p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className={`-m-1 flex size-7 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:text-text ${FOCUS}`}
        >
          <CloseIcon size={16} />
        </button>
      </div>
    </div>
  );
}
