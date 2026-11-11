"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import { LEVEL_LABEL, pathHref, plural } from "../../lib/app/paths-catalogue";
import {
  aboutHours,
  buildPathDetail,
  type DetailLesson,
  type DetailSource,
  lessonMeta,
  type PathDetailView,
  sourceCountLabel,
} from "../../lib/app/paths-detail";
import { lessonHref } from "../../lib/app/paths-lessons";
import { isCompleted, isLessonDone, isStarted, resumeTarget } from "../../lib/app/progress-logic";
import { getCatalogue } from "../../lib/catalogue/data";
import type { TopicSlug } from "../../lib/catalogue/types";
import { ROUTES } from "../../lib/routes";
import { CircleCheckIcon, FileTextIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { usePaths } from "../app-progress/progress-provider";
import { BookIcon } from "../landing/at-work-art";
import {
  ArrowLeftIcon,
  BadgeDollarIcon,
  CheckIcon,
  CirclePlayIcon,
  SignalIcon,
  WrenchIcon,
} from "./icons";
import { LessonBadge } from "./lesson-outline";
import { BUTTON_INVERSE, ErrorState, LargeCover, LevelBadge, SampleTag } from "./parts";
import { PathActions } from "./path-actions";

/**
 * /learn/paths/{topic} (Figma "5. Path detail", "New account"): back link, header with facts and
 * Start path, what you'll learn, lessons, sources and who it's for.
 *
 * Progress is real (usePaths()): Start path, Start lesson 1 / Continue lesson N, Star path, Share once
 * finished, per-lesson done marks and the current lesson. Lessons open inside the app
 * (/learn/paths/{topic}/{path}/lessons/{lesson}); their media links out to the free source.
 * The mobile frame shows five lessons and a "Show all N lessons" button; from md up all show.
 */

const PREVIEW_LESSONS = 5;

export function PathDetail({ topic }: { topic: TopicSlug }) {
  const requested = useSearchParams().get("path");
  const view = useMemo(() => buildPathDetail(getCatalogue(), topic, requested), [topic, requested]);

  if (!view) {
    return (
      <div className="mx-auto w-full">
        <ErrorState
          title="This path isn’t available"
          body="It may have been unpublished, or the link is wrong."
        >
          <Link href={ROUTES.app.paths} className={BUTTON_INVERSE}>
            Browse all paths
          </Link>
        </ErrorState>
      </div>
    );
  }
  return <DetailBody view={view} />;
}

const H2 = "font-semibold text-[20px] text-text leading-7 tracking-[-0.2px]";
const CARD = "flex flex-col gap-3.5 rounded-2xl border border-border-soft bg-bg-base p-5";

function DetailBody({ view }: { view: PathDetailView }) {
  const { path } = view;
  const paths = usePaths();
  const completed = isCompleted(paths.get(path.slug));
  return (
    <div className="mx-auto flex w-full flex-col gap-8">
      <Link
        href={ROUTES.app.paths}
        className={`-ml-2.5 inline-flex items-center gap-1 self-start rounded-md px-2.5 py-1.5 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] hover:bg-bg-fill1 ${FOCUS}`}
      >
        <ArrowLeftIcon size={18} />
        <span className="px-0.5">All paths</span>
      </Link>

      <section className="flex flex-col gap-6 xl:flex-row xl:items-center xl:gap-14">
        <div className="order-2 flex min-w-0 flex-1 flex-col gap-5 xl:order-1">
          <div className="flex flex-wrap items-center gap-2">
            {completed ? <CompletedBadge /> : null}
            <LevelBadge level={path.level} large />
            <span className="rounded-md bg-bg-fill1 px-1.5 py-1 font-medium text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
              <span className="block px-0.5">{view.topicName}</span>
            </span>
            {view.sample ? <SampleTag /> : null}
          </div>
          <div className="flex flex-col gap-3.5">
            <h1 className="font-semibold text-[26px] text-text leading-8 tracking-[-0.26px] md:text-[32px] md:leading-10 md:tracking-[-0.32px]">
              {path.title}
            </h1>
            <p className="max-w-[887px] text-[16px] text-text-secondary leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]">
              {view.description}
            </p>
          </div>
          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3.5 sm:flex sm:flex-wrap sm:gap-x-8">
            <Fact
              icon={<BookIcon />}
              label="Lessons"
              value={`${path.lessons} ${plural(path.lessons, "lesson", "lessons")}`}
            />
            <Fact
              icon={<ClockGlyph />}
              label="Time"
              value={path.hours > 0 ? `About ${path.hours} hrs` : "Not yet known"}
            />
            <Fact icon={<SignalIcon size={18} />} label="Level" value={LEVEL_LABEL[path.level]} />
            <Fact icon={<BadgeDollarIcon size={18} />} label="Cost" value="Free" />
          </dl>
          <PathActions view={view} />
        </div>
        <div className="order-1 w-full md:order-3 xl:order-2 xl:w-[560px] xl:shrink-0">
          <LargeCover topic={path.topicSlug} />
        </div>
      </section>

      <hr className="m-0 border-border-soft border-t" />

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-12">
        <div className="flex min-w-0 flex-1 flex-col gap-9">
          {view.outcomes.length > 0 ? <Outcomes outcomes={view.outcomes} /> : null}
          <Lessons view={view} />
        </div>
        <aside
          aria-label="About this path"
          className="flex w-full flex-col gap-5 xl:w-[400px] xl:shrink-0"
        >
          {view.sources.length > 0 ? <Sources sources={view.sources} /> : null}
          {view.audience.length > 0 ? <Audience items={view.audience} /> : null}
          {view.siblings.length > 0 ? <Siblings view={view} /> : null}
        </aside>
      </div>
    </div>
  );
}

function ClockGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

/** Path Fact: a small icon tile with a label above the value. */
function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary"
      >
        {icon}
      </span>
      <div className="flex flex-col">
        <dt className="text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">{label}</dt>
        <dd className="m-0 font-semibold text-[14px] text-text leading-5 tracking-[-0.14px]">
          {value}
        </dd>
      </div>
    </div>
  );
}

function CompletedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-success-focus px-1.5 py-1 font-medium text-[14px] text-success-text leading-5 tracking-[-0.14px]">
      <CircleCheckIcon size={14} />
      Completed
    </span>
  );
}

function Outcomes({ outcomes }: { outcomes: string[] }) {
  return (
    <section aria-labelledby="outcomes-heading" className="flex flex-col gap-4">
      <h2 id="outcomes-heading" className={H2}>
        What you’ll learn
      </h2>
      <ul className="m-0 grid list-none gap-x-4 gap-y-3.5 p-0 md:grid-cols-3 xl:grid-cols-2">
        {outcomes.map((outcome) => (
          <li key={outcome} className="flex items-start gap-2.5">
            <CheckIcon size={20} className="mt-0.5 shrink-0 text-success-text" />
            <span className="text-[16px] text-text leading-6 tracking-[-0.16px]">{outcome}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LessonIcon({ kind }: { kind: DetailLesson["kind"] }) {
  const props = { size: 14, className: "shrink-0" };
  return kind === "video" ? (
    <CirclePlayIcon {...props} />
  ) : kind === "tool" ? (
    <WrenchIcon {...props} />
  ) : (
    <FileTextIcon {...props} />
  );
}

function Lessons({ view }: { view: PathDetailView }) {
  const [all, setAll] = useState(false);
  const entry = usePaths().get(view.path.slug);
  const current =
    isStarted(entry) && !isCompleted(entry) ? resumeTarget(view.lessons, entry) : null;
  const { lessons, path } = view;
  const hours = aboutHours(path.hours);
  const hidden = lessons.length - PREVIEW_LESSONS;
  return (
    <section aria-labelledby="lessons-heading" className="flex flex-col gap-2">
      <div className="flex flex-col gap-1 pb-2">
        <h2 id="lessons-heading" className={H2}>
          Lessons
        </h2>
        <p className="text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]">
          {path.lessons} {plural(path.lessons, "lesson", "lessons")}
          {hours ? ` · ${hours}` : ""}
        </p>
      </div>
      {lessons.length > 0 ? (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {lessons
            .map((lesson, index) => ({ lesson, number: index + 1 }))
            .map(({ lesson, number }) => (
              <li
                key={lesson.id}
                className={!all && number > PREVIEW_LESSONS ? "hidden md:block" : undefined}
              >
                <LessonRow
                  view={view}
                  lesson={lesson}
                  number={number}
                  done={isLessonDone(entry, lesson.id)}
                  current={current?.lesson.id === lesson.id}
                />
              </li>
            ))}
        </ol>
      ) : null}
      {lessons.length > 0 && !view.lessonsComplete ? (
        <p className="rounded-xl border border-border border-dashed bg-bg-fill1 px-4 py-3 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          The first {lessons.length} of {path.lessons} lessons are shown. The full list is on its
          way.
        </p>
      ) : null}
      {lessons.length === 0 ? (
        <p className="rounded-xl border border-border border-dashed bg-bg-fill1 px-4 py-3 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          The lesson list for this path is on its way.
        </p>
      ) : null}
      {hidden > 0 && !all ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          className={`mt-1 inline-flex h-10 items-center justify-center rounded-lg border border-border bg-bg-elevation-1 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] shadow-e1 md:hidden ${FOCUS}`}
        >
          Show all {lessons.length} lessons
        </button>
      ) : null}
    </section>
  );
}

function LessonRow({
  view,
  lesson,
  number,
  done,
  current,
}: {
  view: PathDetailView;
  lesson: DetailLesson;
  number: number;
  done: boolean;
  current: boolean;
}) {
  return (
    <Link
      href={lessonHref(view.path.topicSlug, view.path.slug, lesson.id)}
      aria-current={current ? "step" : undefined}
      className={`flex items-center gap-4 rounded-xl border py-3.5 pr-4 pl-3.5 ${FOCUS} ${
        current ? "border-primary bg-primary-focus" : "border-transparent hover:bg-bg-fill1"
      }`}
    >
      <LessonBadge number={number} done={done} current={current} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium text-[16px] text-text leading-6 tracking-[-0.16px]">
          {lesson.title}
          {done ? <span className="sr-only"> (done)</span> : null}
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
          <LessonIcon kind={lesson.kind} />
          {lessonMeta(lesson)}
        </span>
      </span>
    </Link>
  );
}

function SourceIcon({ kind }: { kind: DetailSource["kind"] }) {
  return kind === "video" ? (
    <CirclePlayIcon size={20} />
  ) : kind === "tool" ? (
    <WrenchIcon size={20} />
  ) : (
    <FileTextIcon size={20} />
  );
}

const SOURCE_BADGE = {
  video: "bg-error-focus text-error-text",
  article: "bg-[color-mix(in_srgb,var(--matr-blue)_16%,var(--matr-bg-base))] text-utility-blue",
  tool: "bg-[color-mix(in_srgb,var(--matr-emerald)_16%,var(--matr-bg-base))] text-utility-emerald",
} as const;
const SOURCE_BADGE_LABEL = { video: "Video", article: "Article", tool: "Tool" } as const;

function Sources({ sources }: { sources: DetailSource[] }) {
  return (
    <section aria-labelledby="sources-heading" className={CARD}>
      <h2
        id="sources-heading"
        className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]"
      >
        Where the lessons come from
      </h2>
      <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
        Every lesson links to a free resource picked and checked by our curators.
      </p>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {sources.map((source) => (
          <li
            key={`${source.name}-${source.kind}`}
            className="flex items-center gap-3 rounded-xl border border-border-soft bg-bg-base py-3 pr-3.5 pl-3"
          >
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary"
            >
              <SourceIcon kind={source.kind} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-semibold text-[14px] text-text leading-5 tracking-[-0.14px]">
                {source.name}
              </span>
              <span className="text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
                {sourceCountLabel(source)}
              </span>
            </span>
            <span
              className={`rounded-md px-1.5 py-[3px] font-medium text-[13px] leading-[18px] tracking-[-0.13px] ${SOURCE_BADGE[source.kind]}`}
            >
              {SOURCE_BADGE_LABEL[source.kind]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Audience({ items }: { items: string[] }) {
  return (
    <section aria-labelledby="audience-heading" className={CARD}>
      <h2
        id="audience-heading"
        className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]"
      >
        Who it’s for
      </h2>
      <ul className="m-0 flex list-disc flex-col gap-3.5 pl-5 text-[14px] text-text-secondary leading-5 tracking-[-0.14px] marker:text-text-tertiary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function Siblings({ view }: { view: PathDetailView }) {
  return (
    <section aria-labelledby="siblings-heading" className={CARD}>
      <h2
        id="siblings-heading"
        className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]"
      >
        More in {view.topicName}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {view.siblings.map((sibling) => (
          <li key={sibling.slug}>
            <Link
              href={pathHref(sibling, view.topicPaths)}
              className={`link-slide rounded-md font-medium text-[14px] text-primary-text leading-5 tracking-[-0.14px] ${FOCUS}`}
            >
              {sibling.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
