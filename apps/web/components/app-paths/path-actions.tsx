"use client";

import Link from "next/link";
import { useState } from "react";
import type { PathDetailView } from "../../lib/app/paths-detail";
import { lessonHref } from "../../lib/app/paths-lessons";
import {
  doneCount,
  isCompleted,
  isStarted,
  pathStatusLine,
  resumeTarget,
} from "../../lib/app/progress-logic";
import { ArrowRightIcon, ShareIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { usePaths } from "../app-progress/progress-provider";
import { ShareDialog } from "./path-complete";
import { StarControls } from "./star-action";

const SIZE = "h-11 px-3 text-[16px] leading-6 tracking-[-0.16px]";
const PRIMARY = `btn-lift inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary font-medium text-static-white sm:w-auto ${SIZE} ${FOCUS}`;
const SECONDARY = `btn-lift inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-elevation-1 font-medium text-text shadow-e1 sm:w-auto ${SIZE} ${FOCUS}`;

/**
 * The buttons under the path header, per state (Figma "Path started", "Path page: resume", "Path
 * page: completed", and the plain "Start path"): Start path, then Start lesson 1 or Continue lesson
 * N once started, Review lessons and Share once finished; Star path beside them and the progress
 * line after them. Everything follows the learner's real progress (usePaths()).
 */
export function PathActions({ view }: { view: PathDetailView }) {
  const paths = usePaths();
  const [sharing, setSharing] = useState(false);
  const { path, lessons } = view;
  const entry = paths.get(path.slug);
  const started = isStarted(entry);
  const completed = isCompleted(entry);
  const resume = resumeTarget(lessons, entry);
  const first = lessons[0];
  const ready = paths.status === "ready";
  const pending = paths.isPending(path.slug);
  const line = pathStatusLine(entry, path.lessons, Date.now());
  const href = (id: string) => lessonHref(path.topicSlug, path.slug, id);

  let primary: React.ReactNode;
  if (!first) {
    primary = (
      <button type="button" disabled title="No lessons yet" className={`${PRIMARY} opacity-50`}>
        Start path
      </button>
    );
  } else if (!started) {
    primary = (
      <button
        type="button"
        disabled={!ready || pending}
        aria-busy={pending}
        onClick={() => void paths.start(path.slug)}
        className={`${PRIMARY} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        Start path
      </button>
    );
  } else if (completed) {
    primary = (
      <Link href={href(first.id)} className={SECONDARY}>
        Review lessons
      </Link>
    );
  } else if (resume) {
    primary = (
      <Link href={href(resume.lesson.id)} className={PRIMARY}>
        {doneCount(entry, path.lessons) === 0
          ? `Start lesson ${resume.number}`
          : `Continue lesson ${resume.number}`}
        <ArrowRightIcon size={16} />
      </Link>
    );
  } else {
    primary = (
      <button type="button" disabled className={`${PRIMARY} opacity-50`}>
        More lessons on their way
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      {primary}
      <StarControls
        title={path.title}
        starred={paths.isStarred(path.slug)}
        onToggle={() => void paths.toggleStar(path.slug)}
        disabled={!ready || pending}
        hint={completed ? null : line}
      />
      {completed ? (
        <>
          <button type="button" onClick={() => setSharing(true)} className={SECONDARY}>
            <ShareIcon size={16} />
            Share
          </button>
          {line ? (
            <p className="text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]">{line}</p>
          ) : null}
        </>
      ) : null}
      {sharing ? <ShareDialog view={view} onClose={() => setSharing(false)} /> : null}
    </div>
  );
}
