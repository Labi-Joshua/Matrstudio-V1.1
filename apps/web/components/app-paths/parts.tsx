import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { LEVEL_LABEL, plural } from "../../lib/app/paths-catalogue";
import type { Level, TopicSlug } from "../../lib/catalogue/types";
import type { BrowsePath } from "../../lib/pages/browse-paths";
import { RouteIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { BookIcon, ClockIcon, PathCover, TOPIC_LOOK, TopicIcon } from "../landing/at-work-art";
import { FunnelXIcon } from "./icons";

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

/** Path Card (Figma "Path Card"), without the star: starring needs the saved-items API. */
export function PathCard({ path, href }: { path: BrowsePath; href: string }) {
  return (
    <li className="min-w-0">
      <Link
        href={href}
        className={`card-lift flex h-full flex-col overflow-clip rounded-2xl border border-border-soft bg-bg-base ${FOCUS}`}
      >
        <PathCover topic={path.topicSlug} hue={TOPIC_LOOK[path.topicSlug].cover} />
        <span className="flex flex-col items-start gap-2 px-4 pt-4 pb-[18px]">
          <LevelBadge level={path.level} />
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
    </li>
  );
}

export function PathGrid({ children }: { children: ReactNode }) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 xl:grid-cols-3">
      {children}
    </ul>
  );
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
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[360px] flex-col items-center gap-6 px-5 py-12 text-center md:pt-20">
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
      <div className="flex flex-col gap-1.5">
        <h2 className="font-medium text-[16px] text-text leading-6 tracking-[-0.16px]">{title}</h2>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">{body}</p>
      </div>
      {children ? <div className="flex flex-wrap justify-center gap-2.5">{children}</div> : null}
    </div>
  );
}

/** "We couldn't load paths" / "This path isn't available" (Figma states: icon badge, title, copy, button). */
export function ErrorState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
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
      <h1 className="font-semibold text-[24px] text-text leading-8 tracking-[-0.24px]">{title}</h1>
      <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">{body}</p>
      <div className="pt-1.5">{children}</div>
    </div>
  );
}

/** Dark "Try again" / "Browse paths" button of the error states (Figma Button-Primary, text fill). */
export const BUTTON_INVERSE = `btn-lift inline-flex items-center justify-center gap-1.5 rounded-lg bg-text px-3 py-2.5 font-medium text-[14px] text-bg-base leading-5 tracking-[-0.14px] ${FOCUS}`;

export const SKELETON = "rounded-md bg-bg-fill2 motion-safe:animate-pulse";
