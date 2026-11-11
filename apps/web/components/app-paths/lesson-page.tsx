"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { aboutText } from "../../lib/app/detail-state";
import { pathHref } from "../../lib/app/paths-catalogue";
import { lessonMeta } from "../../lib/app/paths-detail";
import { buildLessonView, lessonHref, lessonOf } from "../../lib/app/paths-lessons";
import {
  doneCount,
  isCompleted,
  isLessonDone,
  nextLesson,
  previousLesson,
  upNext,
} from "../../lib/app/progress-logic";
import { getCatalogue } from "../../lib/catalogue/data";
import type { TopicSlug } from "../../lib/catalogue/types";
import { LEVEL_TEXT } from "../../lib/pages/browse-library";
import { ROUTES } from "../../lib/routes";
import { AlertCircleIcon, ArrowRightIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { SourceCard, VideoBlock } from "../app-library/detail-source";
import { usePaths } from "../app-progress/progress-provider";
import { ArrowLeftIcon, CheckIcon } from "./icons";
import { KindGlyph, Outline } from "./lesson-outline";
import { BUTTON_INVERSE, BUTTON_PRIMARY, BUTTON_SECONDARY, ErrorState, SampleTag } from "./parts";
import { CompleteDialog } from "./path-complete";
import { useSkeletonGate } from "./skeleton-gate";
import { LessonSkeleton } from "./skeletons";

/**
 * /learn/paths/{topic}/{path}/lessons/{lesson} (Figma "Take a lesson": video lesson, article
 * lesson, reading window, video unavailable, marked done, and the phone outline). Lessons link out
 * to their free source, which cannot be framed here (the app's content security policy and the
 * publishers' own rules), so the video block and the article card open the original, exactly as the
 * Library resource page does, including its reading window. Progress comes from usePaths().
 */

const CARD = "rounded-2xl bg-bg-fill1 p-5";

export function LessonPage({
  topic,
  pathSlug,
  lessonId,
}: {
  topic: TopicSlug;
  pathSlug: string;
  lessonId: string;
}) {
  const view = useMemo(
    () => buildLessonView(getCatalogue(), topic, pathSlug, lessonId),
    [topic, pathSlug, lessonId],
  );
  const paths = usePaths();
  const showSkeleton = useSkeletonGate(paths.status === "loading");

  if (!view) {
    return (
      <div className="mx-auto w-full">
        <ErrorState
          title="This lesson isn’t available"
          body="It may have been removed from the path, or the link is wrong."
        >
          <Link href={ROUTES.app.paths} className={BUTTON_INVERSE}>
            Browse all paths
          </Link>
        </ErrorState>
      </div>
    );
  }
  if (paths.status === "loading") {
    return showSkeleton ? <LessonSkeleton /> : <div aria-busy="true" className="min-h-[60vh]" />;
  }
  return <LessonBody view={view} />;
}

function LessonBody({ view }: { view: NonNullable<ReturnType<typeof buildLessonView>> }) {
  const router = useRouter();
  const paths = usePaths();
  const [celebrate, setCelebrate] = useState(false);
  const { detail, lesson, number, total, item } = view;
  const { path } = detail;
  const entry = paths.get(path.slug);
  const done = isLessonDone(entry, lesson.id);
  const pending = paths.isPending(path.slug);
  const ready = paths.status === "ready";
  const prev = previousLesson(detail.lessons, lesson.id);
  const next = nextLesson(detail.lessons, lesson.id);
  const up = upNext(detail.lessons, lesson.id, entry);
  const pathUrl = pathHref(path, detail.topicPaths);
  const hrefOf = (id: string) => lessonHref(path.topicSlug, path.slug, id);

  async function markDone() {
    const completing = !isCompleted(entry) && doneCount(entry, total) + 1 >= total;
    const ok = await paths.markDone(path.slug, lesson.id, total, number);
    if (ok && completing) setCelebrate(true);
  }
  const undo = () => void paths.undo(path.slug, lesson.id, total, number);

  const doneButton = done ? (
    <button
      type="button"
      aria-pressed="true"
      disabled={pending}
      onClick={undo}
      title="Mark this lesson as not done"
      className={`${BUTTON_SECONDARY} h-10 w-full md:w-auto`}
    >
      <CheckIcon size={16} className="text-success-text" />
      Done
    </button>
  ) : (
    <button
      type="button"
      disabled={pending || !ready}
      aria-busy={pending}
      onClick={() => void markDone()}
      className={`${BUTTON_PRIMARY} h-10 w-full disabled:opacity-60 md:w-auto`}
    >
      <CheckIcon size={16} />
      Mark as done
    </button>
  );

  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      <Link
        href={pathUrl}
        className={`-ml-2.5 inline-flex items-center gap-1 self-start rounded-md px-2.5 py-1.5 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] hover:bg-bg-fill1 ${FOCUS}`}
      >
        <ArrowLeftIcon size={18} />
        <span className="px-0.5">{path.title}</span>
      </Link>

      {paths.status === "error" ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl bg-warning-focus px-4 py-3 text-[14px] text-text leading-5 tracking-[-0.14px]"
        >
          <AlertCircleIcon size={18} className="shrink-0 text-warning-text" />
          <span className="min-w-0 flex-1">
            We couldn’t load your progress, so Mark as done is paused. The lesson itself still
            works.
          </span>
          <button type="button" onClick={paths.reload} className={`${BUTTON_SECONDARY} h-9`}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <header className="flex flex-col gap-2">
            <p className="font-medium text-[12px] text-text-tertiary uppercase leading-4 tracking-[0.6px]">
              {lessonOf(number, total)}
            </p>
            <h1 className="font-semibold text-[26px] text-text leading-8 tracking-[-0.26px] md:text-[32px] md:leading-10 md:tracking-[-0.32px]">
              {lesson.title}
            </h1>
            <p className="flex flex-wrap items-center gap-1.5 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
              <KindGlyph kind={lesson.kind} size={16} />
              {lessonMeta(lesson)}
              {detail.sample ? <SampleTag /> : null}
            </p>
          </header>

          {view.unavailable ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl bg-warning-focus px-4 py-3 text-[14px] leading-5 tracking-[-0.14px]"
            >
              <AlertCircleIcon size={18} className="mt-0.5 shrink-0 text-warning-text" />
              <div className="flex flex-col">
                <span className="font-medium text-text">
                  This lesson’s link isn’t available right now
                </span>
                <span className="text-text-secondary">
                  You can still mark it done, and the rest of the path works.
                </span>
              </div>
            </div>
          ) : null}

          {lesson.kind === "video" ? <VideoBlock item={item} /> : <SourceCard item={item} />}

          <div className="md:hidden">
            <Outline view={detail} entry={entry} currentId={lesson.id} collapsible />
          </div>

          <section aria-label="About this lesson" className={`${CARD} flex flex-col gap-2`}>
            <h2 className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
              About this lesson
            </h2>
            <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">
              {aboutText(item, (level) => LEVEL_TEXT[level])}
            </p>
          </section>

          <nav
            aria-label="Lesson navigation"
            className="flex flex-col gap-3 border-border-soft border-t pt-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="order-2 flex items-center justify-between md:order-1 md:flex-1">
              {prev ? (
                <Link
                  href={hrefOf(prev.lesson.id)}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-lg px-2 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] hover:bg-bg-fill1 ${FOCUS}`}
                >
                  <ArrowLeftIcon size={16} />
                  Previous
                  <span className="sr-only">: {prev.lesson.title}</span>
                </Link>
              ) : (
                <span aria-hidden="true" className="w-20" />
              )}
              <span className="hidden text-[14px] text-text-tertiary leading-5 md:inline">
                {lessonOf(number, total)}
              </span>
              {next ? (
                <Link
                  href={hrefOf(next.lesson.id)}
                  className={`${BUTTON_SECONDARY} md:hidden ${done ? "bg-primary text-static-white" : ""}`}
                >
                  {done ? "Next lesson" : "Next"}
                  <ArrowRightIcon size={16} />
                  <span className="sr-only">: {next.lesson.title}</span>
                </Link>
              ) : null}
            </div>
            <div className="order-1 flex flex-col gap-2 md:order-2 md:flex-row md:items-center">
              {doneButton}
              {next ? (
                <Link
                  href={hrefOf(next.lesson.id)}
                  className={`hidden h-10 items-center justify-center gap-1.5 rounded-lg px-3 font-medium text-[14px] leading-5 tracking-[-0.14px] md:inline-flex ${FOCUS} ${
                    done
                      ? "btn-lift bg-primary text-static-white"
                      : "border border-border bg-bg-base text-text shadow-e1"
                  }`}
                >
                  {done ? "Next lesson" : "Next"}
                  <ArrowRightIcon size={16} />
                  <span className="sr-only">: {next.lesson.title}</span>
                </Link>
              ) : null}
            </div>
          </nav>
          {!next && total > detail.lessons.length ? (
            <p className="rounded-xl border border-border border-dashed bg-bg-fill1 px-4 py-3 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
              That’s the last of the {detail.lessons.length} lessons listed so far. The other{" "}
              {total - detail.lessons.length} are on their way.
            </p>
          ) : null}

          <div className="hidden md:block xl:hidden">
            <Outline view={detail} entry={entry} currentId={lesson.id} />
          </div>
        </div>

        <aside aria-label="Your path" className="hidden w-[320px] shrink-0 flex-col gap-4 xl:flex">
          {done && up && up.lesson.id !== lesson.id ? (
            <section
              aria-label="Up next"
              className="flex flex-col gap-3 rounded-2xl bg-bg-fill1 p-4"
            >
              <p className="font-medium text-[12px] text-text-tertiary uppercase leading-4 tracking-[0.6px]">
                Up next
              </p>
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-fill2 font-semibold text-[14px] text-text-secondary"
                >
                  {up.number}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
                    {up.lesson.title}
                  </span>
                  <span className="text-[12px] text-text-tertiary leading-4">
                    {lessonMeta(up.lesson)}
                  </span>
                </span>
              </div>
              <Link href={hrefOf(up.lesson.id)} className={`${BUTTON_PRIMARY} h-10 w-full`}>
                Start lesson {up.number}
                <ArrowRightIcon size={16} />
              </Link>
            </section>
          ) : null}
          <Outline view={detail} entry={entry} currentId={lesson.id} />
        </aside>
      </div>

      {celebrate && entry ? (
        <CompleteDialog
          view={detail}
          entry={paths.get(path.slug) ?? entry}
          onClose={() => setCelebrate(false)}
          onBack={() => {
            setCelebrate(false);
            router.push(pathUrl);
          }}
        />
      ) : null}
    </div>
  );
}
