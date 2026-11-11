"use client";

import Link from "next/link";
import { type ReactNode, useId } from "react";
import { type DashboardPath, progressPercent } from "../../lib/app/dashboard";
import { ROUTES } from "../../lib/routes";
import { BookIcon, ClockIcon, PathCover, TOPIC_LOOK } from "../landing/at-work-art";
import { usePopover } from "./hooks";
import { HelpCircleIcon } from "./icons";
import { FOCUS } from "./ui";

/** Pieces of the Home screen shared by every layout: section headers with their tooltip, card rows, path cards. */
export type PathProgress = { done: number; total: number };

export const LEVEL_LABEL = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};
const LEVEL_CLASS = {
  beginner: "bg-success-focus text-success-text",
  intermediate: "bg-warning-focus text-warning-text",
  advanced: "bg-error-focus text-error-text",
};
export const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** The "?" next to a section title (Figma "Section tooltips"): click or Enter shows the hint. */
export function InfoTip({ title, children }: { title: string; children: ReactNode }) {
  const { open, toggle, buttonRef, panelRef } = usePopover();
  const id = useId();
  return (
    <span className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        className={`flex size-6 items-center justify-center rounded-full text-text-tertiary hover:text-text ${FOCUS}`}
      >
        <HelpCircleIcon size={16} />
      </button>
      {open ? (
        <div
          id={id}
          ref={panelRef}
          className="absolute top-full left-0 z-20 mt-2 flex w-[280px] max-w-[calc(100vw-2.5rem)] flex-col gap-1 rounded-lg border border-border-soft bg-bg-base p-3 shadow-e2"
        >
          <p className="font-medium text-[13px] text-text leading-[18px] tracking-[-0.13px]">
            {title}
          </p>
          <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">{children}</p>
        </div>
      ) : null}
    </span>
  );
}

export function SampleTag() {
  return (
    <span className="rounded-md bg-bg-fill2 px-1.5 py-0.5 font-medium text-[12px] text-text-secondary leading-4 tracking-[-0.12px]">
      Sample content
    </span>
  );
}

export function SectionHeader({
  id,
  title,
  tip,
  sample = false,
  action,
}: {
  id: string;
  title: string;
  tip: ReactNode;
  sample?: boolean;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-center gap-2">
      <h2
        id={id}
        className="font-medium text-[22px] text-text leading-7 tracking-[-0.22px] md:text-[24px] md:leading-8 md:tracking-[-0.24px]"
      >
        {title}
      </h2>
      <InfoTip title={title}>{tip}</InfoTip>
      {sample ? <SampleTag /> : null}
      <span className="flex-1" />
      {action ? (
        <Link
          href={action.href}
          className={`rounded-md text-[14px] text-text-secondary leading-5 tracking-[-0.14px] hover:text-text ${FOCUS}`}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/** Cards scroll sideways on phones (as in the mobile frames) and sit in a grid from md up. */
export function CardRow({ children, columns }: { children: ReactNode; columns: string }) {
  return (
    <ul
      className={`-mx-5 m-0 flex list-none snap-x gap-4 overflow-x-auto p-0 px-5 pb-1 md:mx-0 md:grid md:overflow-visible md:px-0 ${columns}`}
    >
      {children}
    </ul>
  );
}

export function PathCard({ path, progress }: { path: DashboardPath; progress?: PathProgress }) {
  const percent = progress ? progressPercent(progress.done, progress.total) : 0;
  return (
    <li className="w-[300px] shrink-0 snap-start md:w-auto">
      <Link
        href={ROUTES.app.pathTopic(path.topicSlug)}
        className={`card-lift flex h-full flex-col overflow-clip rounded-2xl border border-border-soft bg-bg-base ${FOCUS}`}
      >
        <span className="relative block">
          <PathCover topic={path.topicSlug} hue={TOPIC_LOOK[path.topicSlug].cover} />
          {progress ? (
            <span
              aria-hidden="true"
              style={{ width: `${percent}%` }}
              className="absolute bottom-0 left-0 block h-1 bg-primary"
            />
          ) : null}
        </span>
        <span className="flex flex-col items-start gap-2 px-4 pt-4 pb-[18px]">
          <span className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-1.5 py-[3px] ${LEVEL_CLASS[path.level]}`}>
              <span className="block px-0.5 font-medium text-[13px] leading-[18px] tracking-[-0.13px]">
                {LEVEL_LABEL[path.level]}
              </span>
            </span>
            {progress ? (
              <span className="rounded-md bg-primary-focus px-1.5 py-[3px] font-medium text-[13px] text-primary-text leading-[18px] tracking-[-0.13px]">
                {progress.done === progress.total
                  ? "Completed"
                  : `Lesson ${progress.done + 1} of ${progress.total} · ${percent}%`}
              </span>
            ) : null}
          </span>
          <span className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
            {path.title}
          </span>
          {path.description ? (
            <span className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
              {path.description}
            </span>
          ) : null}
          <span className="flex items-center gap-3.5 pt-1 font-medium text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
            <span className="flex items-center gap-1">
              <BookIcon />
              {path.lessons} {plural(path.lessons, "lesson", "lessons")}
            </span>
            {path.hours === null ? null : (
              <span className="flex items-center gap-1">
                <ClockIcon />
                {path.hours} hrs
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
