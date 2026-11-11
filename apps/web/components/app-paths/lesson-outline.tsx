"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { pathHref } from "../../lib/app/paths-catalogue";
import type { DetailLesson, PathDetailView } from "../../lib/app/paths-detail";
import { lessonMeta } from "../../lib/app/paths-detail";
import { lessonHref } from "../../lib/app/paths-lessons";
import {
  doneCount,
  isLessonDone,
  lessonsDoneText,
  nextLesson,
  percent,
} from "../../lib/app/progress-logic";
import type { PathProgress } from "../../lib/auth/progress-api";
import { ChevronDownIcon, FileTextIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { ArrowLeftIcon, CheckIcon, CirclePlayIcon, WrenchIcon } from "./icons";

/** Thin progress bar (Figma lesson outline, "Next" card): decorative, the text beside it says it. */
export function ProgressBar({ value }: { value: number }) {
  return (
    <span
      aria-hidden="true"
      className="block h-1.5 w-full overflow-hidden rounded-full bg-bg-fill2"
    >
      <span className="block h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
    </span>
  );
}

export function KindGlyph({ kind, size = 14 }: { kind: DetailLesson["kind"]; size?: number }) {
  const props = { size, className: "shrink-0" };
  return kind === "video" ? (
    <CirclePlayIcon {...props} />
  ) : kind === "tool" ? (
    <WrenchIcon {...props} />
  ) : (
    <FileTextIcon {...props} />
  );
}

/** The number or check circle of a lesson row: done is green with a check, current is orange. */
export function LessonBadge({
  number,
  done,
  current,
}: {
  number: number;
  done: boolean;
  current: boolean;
}) {
  const tone = done
    ? "bg-success-focus text-success-text"
    : current
      ? "bg-primary text-static-white"
      : "bg-bg-fill2 text-text-secondary";
  return (
    <span
      aria-hidden="true"
      className={`flex size-8 shrink-0 items-center justify-center rounded-full font-semibold text-[14px] leading-5 tracking-[-0.14px] ${tone}`}
    >
      {done ? <CheckIcon size={16} /> : number}
    </span>
  );
}

function OutlineRow({
  view,
  lesson,
  number,
  entry,
  currentId,
}: {
  view: PathDetailView;
  lesson: DetailLesson;
  number: number;
  entry: PathProgress | undefined;
  currentId: string;
}) {
  const current = lesson.id === currentId;
  const done = isLessonDone(entry, lesson.id);
  return (
    <li>
      <Link
        href={lessonHref(view.path.topicSlug, view.path.slug, lesson.id)}
        aria-current={current ? "page" : undefined}
        className={`flex items-center gap-3 rounded-xl border px-2.5 py-2 ${FOCUS} ${
          current ? "border-primary bg-primary-focus" : "border-transparent hover:bg-bg-fill1"
        }`}
      >
        <LessonBadge number={number} done={done} current={current} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
            {lesson.title}
            {done ? <span className="sr-only"> (done)</span> : null}
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
            <KindGlyph kind={lesson.kind} size={12} />
            {lessonMeta({ ...lesson, sourceName: null })}
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * The path outline of the lesson page (Figma "Lesson: video", right column on desktop, under the
 * lesson on tablet): path name, "4 of 10 lessons done", the bar, every lesson with its state and a
 * link back to the path page. On phones it is the collapsed "Next: ..." card that expands.
 */
export function Outline({
  view,
  entry,
  currentId,
  collapsible = false,
}: {
  view: PathDetailView;
  entry: PathProgress | undefined;
  currentId: string;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const total = view.path.lessons;
  const done = doneCount(entry, total);
  const value = percent(done, total);
  const next = nextLesson(view.lessons, currentId);
  const showList = !collapsible || open;
  const summary = `${lessonsDoneText(done, total)} · ${value}%`;

  return (
    <section
      aria-label="Path outline"
      className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-bg-base p-4"
    >
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-start justify-between gap-3 rounded-lg text-left ${FOCUS}`}
        >
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
              {open ? view.path.title : next ? `Next: ${next.lesson.title}` : view.path.title}
            </span>
            <span className="text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
              {open ? summary : `${view.path.title} · ${Math.min(done + 1, total)}/${total}`}
            </span>
          </span>
          <ChevronDownIcon size={18} className={`mt-1 shrink-0 ${open ? "rotate-180" : ""}`} />
        </button>
      ) : (
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
            {view.path.title}
          </h2>
          <p className="text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">{summary}</p>
        </div>
      )}
      <ProgressBar value={value} />
      <div id={listId} hidden={!showList} className="flex flex-col gap-2">
        <ol className="m-0 flex list-none flex-col gap-1 p-0">
          {view.lessons.map((lesson, index) => (
            <OutlineRow
              key={lesson.id}
              view={view}
              lesson={lesson}
              number={index + 1}
              entry={entry}
              currentId={currentId}
            />
          ))}
        </ol>
        <Link
          href={pathHref(view.path, view.topicPaths)}
          className={`inline-flex items-center gap-1.5 self-start rounded-md px-2 py-1.5 text-[14px] text-text-secondary leading-5 tracking-[-0.14px] hover:text-text ${FOCUS}`}
        >
          <ArrowLeftIcon size={16} />
          Path overview
        </Link>
      </div>
    </section>
  );
}
