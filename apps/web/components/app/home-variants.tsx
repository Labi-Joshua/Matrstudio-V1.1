"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import {
  type HomeProgress,
  type HomeVariant,
  homeIntro,
  lastActiveLabel,
  type ProgressPath,
  progressPercent,
  SECTION_TIPS,
} from "../../lib/app/dashboard";
import { ROUTES } from "../../lib/routes";
import { PathCover, TOPIC_LOOK } from "../landing/at-work-art";
import { CardRow, PathCard, SectionHeader } from "./home-parts";
import { ArrowRightIcon, PlayCircleIcon, ShareIcon, StarIcon } from "./icons";
import { NotificationList } from "./notification-list";
import { FOCUS } from "./ui";

/**
 * The progress layouts of Home (Figma "Learning in progress", "Welcome back", "Path finished").
 * Pure view components over `HomeProgress` (built from the learner's path progress in
 * lib/app/home-data.ts); covered by tests with HOME_FIXTURES.
 */

const BUTTON_PRIMARY = `btn-lift inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 font-medium text-[14px] text-static-white leading-5 tracking-[-0.14px] ${FOCUS}`;
const BUTTON_QUIET = `btn-lift inline-flex h-10 items-center rounded-lg border border-border bg-bg-base px-3.5 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] ${FOCUS}`;

function ProgressBar({ done, total }: { done: number; total: number }) {
  const percent = progressPercent(done, total);
  return (
    <div
      role="progressbar"
      aria-label="Path progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1.5 w-full overflow-hidden rounded-full bg-bg-fill2"
    >
      <div style={{ width: `${percent}%` }} className="h-full rounded-full bg-primary" />
    </div>
  );
}

/** "Continue learning" card: cover, next lesson, progress, and the two actions. */
export function ContinueCard({ path }: { path: ProgressPath }) {
  const percent = progressPercent(path.lessonsDone, path.lessons);
  const href = path.href ?? ROUTES.app.pathTopic(path.topicSlug);
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-bg-base p-3 md:flex-row md:items-center md:gap-6">
      <div className="overflow-hidden rounded-xl md:w-[320px] md:shrink-0">
        <PathCover topic={path.topicSlug} hue={TOPIC_LOOK[path.topicSlug].cover} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-2 pb-2 md:px-0 md:pb-0">
        <p className="font-medium text-[12px] text-text-tertiary uppercase leading-4 tracking-[0.6px]">
          Continue learning
        </p>
        <h3 className="font-medium text-[24px] text-text leading-8 tracking-[-0.24px]">
          {path.title}
        </h3>
        {path.next ? (
          <p className="flex items-center gap-1.5 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
            <PlayCircleIcon size={16} className="shrink-0" />
            Next: Lesson {path.next.number} · {path.next.title} · {path.next.format}
            {path.next.minutes === null ? "" : ` · ${path.next.minutes} min`}
          </p>
        ) : null}
        <ProgressBar done={path.lessonsDone} total={path.lessons} />
        <p className="text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
          {path.lessonsDone} of {path.lessons} lessons done · {percent}% ·{" "}
          {lastActiveLabel(path.lastActiveDays)}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={path.next?.href ?? href} className={BUTTON_PRIMARY}>
            {path.next ? `Continue lesson ${path.next.number}` : "Open path"}
            <ArrowRightIcon size={16} />
          </Link>
          <Link href={href} className={BUTTON_QUIET}>
            View path
          </Link>
        </div>
      </div>
    </div>
  );
}

function FinishedCard({ finished }: { finished: NonNullable<HomeProgress["finished"]> }) {
  const { path, daysAgo } = finished;
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const when = daysAgo <= 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-bg-base p-3 md:flex-row md:items-center md:gap-6">
      <div className="overflow-hidden rounded-xl md:w-[320px] md:shrink-0">
        <PathCover topic={path.topicSlug} hue="var(--matr-primary)" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-2 pb-2 md:px-0 md:pb-0">
        <h3 className="font-medium text-[24px] text-text leading-8 tracking-[-0.24px]">
          {path.title}
        </h3>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          {path.lessons} lessons{path.hours === null ? "" : ` · ${path.hours} hrs`} · Finished{" "}
          {when}.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {canShare ? (
            <button
              type="button"
              onClick={() =>
                navigator
                  .share({ title: path.title, text: `I finished ${path.title} on Matr Studio.` })
                  .catch(() => {})
              }
              className={BUTTON_PRIMARY}
            >
              <ShareIcon size={16} />
              Share achievement
            </button>
          ) : null}
          <Link href={path.href ?? ROUTES.app.pathTopic(path.topicSlug)} className={BUTTON_QUIET}>
            View path
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Five stars; the choice is local to the page (there is nowhere to save a rating yet). */
export function RatePath({ title }: { title: string }) {
  const [rating, setRating] = useState(0);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-soft p-4 sm:flex-row sm:items-center">
      <p className="flex-1 text-[15px] text-text-secondary leading-5 tracking-[-0.15px]">
        How useful was this path? Your rating helps curators improve it.
      </p>
      <fieldset className="m-0 flex gap-1 border-0 p-0">
        <legend className="sr-only">Rate {title}</legend>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={rating >= value}
            aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
            onClick={() => setRating(value)}
            className={`flex size-8 items-center justify-center rounded-md ${FOCUS} ${
              rating >= value ? "text-primary" : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            <StarIcon size={22} fill={rating >= value ? "currentColor" : "none"} />
          </button>
        ))}
      </fieldset>
    </div>
  );
}

function Section({
  id,
  title,
  tip,
  action,
  children,
}: {
  id: string;
  title: string;
  tip: string;
  action?: { label: string; href: string };
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <SectionHeader id={id} title={title} tip={tip} action={action} />
      {children}
    </section>
  );
}

export function ProgressHome({
  variant,
  progress,
  firstName,
  hour,
  now,
}: {
  variant: Exclude<HomeVariant, "new-account">;
  progress: HomeProgress;
  firstName: string | null;
  hour: number;
  now: Date;
}) {
  const intro = homeIntro(variant, progress, firstName, hour);
  const lead = progress.started[0];
  const others = progress.started.slice(variant === "finished" ? 0 : 1);
  return (
    <>
      <header className="flex flex-col gap-1.5">
        <h1 className="font-medium text-[30px] text-text leading-9 tracking-[-0.6px] md:text-[34px] md:leading-10 md:tracking-[-0.68px]">
          {intro.title}
        </h1>
        <p className="text-[18px] text-text-secondary leading-7 tracking-[-0.18px]">
          {intro.subtitle}
        </p>
      </header>

      {variant === "finished" && progress.finished ? (
        <>
          <Section id="finished-heading" title="You finished a path" tip={SECTION_TIPS.finished}>
            <FinishedCard finished={progress.finished} />
          </Section>
          <Section
            id="next-heading"
            title="What to learn next"
            tip={SECTION_TIPS.learnNext}
            action={{ label: "Browse paths", href: ROUTES.app.paths }}
          >
            <CardRow columns="md:grid-cols-3">
              {progress.recommended.map((path) => (
                <PathCard key={path.slug} path={path} />
              ))}
            </CardRow>
          </Section>
          <Section
            id="rate-heading"
            title={`Rate ${progress.finished.path.title}`}
            tip={SECTION_TIPS.rate}
          >
            <RatePath title={progress.finished.path.title} />
          </Section>
          {others.length > 0 ? (
            <Section
              id="others-heading"
              title="Other paths in progress"
              tip={SECTION_TIPS.otherInProgress}
            >
              {others.map((path) => (
                <ContinueCard key={path.slug} path={path} />
              ))}
            </Section>
          ) : null}
        </>
      ) : lead ? (
        <>
          <Section
            id="continue-heading"
            title={variant === "welcome-back" ? "Pick up where you left off" : "Continue learning"}
            tip={variant === "welcome-back" ? SECTION_TIPS.pickUp : SECTION_TIPS.continueLearning}
          >
            <ContinueCard path={lead} />
            {variant === "welcome-back" && lead.lastDone ? (
              <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">
                Last time you finished Lesson {lead.lastDone.number} · {lead.lastDone.title}
              </p>
            ) : null}
          </Section>
          {variant === "welcome-back" && progress.away.length > 0 ? (
            <Section id="away-heading" title="While you were away" tip={SECTION_TIPS.whileAway}>
              <div className="rounded-2xl border border-border-soft">
                <NotificationList items={progress.away} now={now} plain />
              </div>
            </Section>
          ) : null}
          <Section
            id="paths-heading"
            title="Your paths"
            tip={SECTION_TIPS.yourPaths}
            action={{ label: "See all paths", href: ROUTES.app.paths }}
          >
            <CardRow columns="md:grid-cols-3">
              {progress.started.map((path) => (
                <PathCard
                  key={path.slug}
                  path={path}
                  progress={{ done: path.lessonsDone, total: path.lessons }}
                />
              ))}
            </CardRow>
          </Section>
          {variant === "in-progress" && progress.recommended.length > 0 ? (
            <Section
              id="recommended-heading"
              title="Recommended next"
              tip={SECTION_TIPS.recommendedNext}
              action={{ label: "Browse paths", href: ROUTES.app.paths }}
            >
              <CardRow columns="md:grid-cols-3">
                {progress.recommended.map((path) => (
                  <PathCard key={path.slug} path={path} />
                ))}
              </CardRow>
            </Section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
