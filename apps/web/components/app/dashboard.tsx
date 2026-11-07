"use client";

import Link from "next/link";
import { type ReactNode, useId, useMemo } from "react";
import { buildDashboard, type DashboardPath } from "../../lib/app/dashboard";
import { welcomeTitle } from "../../lib/app/profile";
import { getCatalogue } from "../../lib/catalogue/data";
import { ROUTES } from "../../lib/routes";
import { BookIcon, ClockIcon, PathCover, TOPIC_LOOK } from "../landing/at-work-art";
import { ResourceCard } from "../pages/browse/resource-card";
import { usePopover } from "./hooks";
import {
  ArrowRightIcon,
  CircleCheckIcon,
  FileTextIcon,
  HelpCircleIcon,
  SparklesIcon,
  UploadIcon,
} from "./icons";
import { useSession } from "./session";
import { FOCUS } from "./ui";

/**
 * Home (Figma "Home" page, frame "Home: new account", with "Home / Desktop no paths" for the
 * empty case). Order: greeting, the finish-setup prompt (only while onboarding is incomplete),
 * Picked for you, How Matr Studio works, library picks, Share a resource.
 *
 * There is no progress, saved-items or notifications API yet, so the "learning in progress",
 * "welcome back" and "path finished" frames (progress rings, lesson counts, last active) are not
 * built: every learner sees the new-account layout. Sample paths and library cards (empty
 * catalogue only) carry a visible "Sample content" tag.
 */

const LEVEL_LABEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const LEVEL_CLASS = {
  beginner: "bg-success-focus text-success-text",
  intermediate: "bg-warning-focus text-warning-text",
  advanced: "bg-error-focus text-error-text",
};
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** The "?" next to a section title (Figma "Section tooltips"): click or Enter shows the hint. */
function InfoTip({ title, children }: { title: string; children: ReactNode }) {
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

function SampleTag() {
  return (
    <span className="rounded-md bg-bg-fill2 px-1.5 py-0.5 font-medium text-[12px] text-text-secondary leading-4 tracking-[-0.12px]">
      Sample content
    </span>
  );
}

function SectionHeader({
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
function CardRow({ children, columns }: { children: ReactNode; columns: string }) {
  return (
    <ul
      className={`-mx-5 m-0 flex list-none snap-x gap-4 overflow-x-auto p-0 px-5 pb-1 md:mx-0 md:grid md:overflow-visible md:px-0 ${columns}`}
    >
      {children}
    </ul>
  );
}

function PathCard({ path }: { path: DashboardPath }) {
  return (
    <li className="w-[300px] shrink-0 snap-start md:w-auto">
      <Link
        href={ROUTES.topic(path.topicSlug)}
        className={`card-lift flex h-full flex-col overflow-clip rounded-2xl border border-border-soft bg-bg-base ${FOCUS}`}
      >
        <PathCover topic={path.topicSlug} hue={TOPIC_LOOK[path.topicSlug].cover} />
        <span className="flex flex-col items-start gap-2 px-4 pt-4 pb-[18px]">
          <span className={`rounded-md px-1.5 py-[3px] ${LEVEL_CLASS[path.level]}`}>
            <span className="block px-0.5 font-medium text-[13px] leading-[18px] tracking-[-0.13px]">
              {LEVEL_LABEL[path.level]}
            </span>
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

const STEPS = [
  {
    icon: SparklesIcon,
    title: "1. Pick a path",
    body: "Step-by-step lessons built from free videos and articles.",
  },
  {
    icon: FileTextIcon,
    title: "2. Learn at your pace",
    body: "Open each lesson here and mark it done when you finish.",
  },
  {
    icon: CircleCheckIcon,
    title: "3. Track your progress",
    body: "Your paths and progress live in the sidebar.",
  },
];

export function Dashboard() {
  const { me } = useSession();
  const view = useMemo(() => buildDashboard(getCatalogue(), me.onboarding), [me.onboarding]);
  const pickedHeading = view.personalised ? "Picked for you" : "Paths to start with";
  const libraryHeading = view.personalised ? "Library picks for you" : "From the library";

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-medium text-[30px] text-text leading-9 tracking-[-0.6px] md:text-[34px] md:leading-10 md:tracking-[-0.68px]">
          {welcomeTitle(me.name)}
        </h1>
        <p className="text-[18px] text-text-secondary leading-7 tracking-[-0.18px]">
          {view.topicsSentence
            ? `Here’s where to start, based on what you told us: ${view.topicsSentence}.`
            : "Here’s where to start."}
        </p>
      </header>

      {me.onboarding.completed ? null : (
        <section
          aria-labelledby="setup-heading"
          className="flex flex-col items-start gap-3 rounded-2xl border border-border-soft bg-bg-fill1 p-5 md:flex-row md:items-center md:gap-6"
        >
          <div className="flex-1">
            <h2
              id="setup-heading"
              className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]"
            >
              Finish setting up
            </h2>
            <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
              Tell us your goal, level and topics and we’ll pick paths for you.
            </p>
          </div>
          <Link
            href={ROUTES.onboarding}
            className={`btn-lift inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 font-medium text-[14px] text-static-white leading-5 tracking-[-0.14px] ${FOCUS}`}
          >
            Continue setup
            <ArrowRightIcon size={16} />
          </Link>
        </section>
      )}

      <section aria-labelledby="picked-heading" className="flex flex-col gap-4">
        <SectionHeader
          id="picked-heading"
          title={pickedHeading}
          sample={view.samplePaths && view.paths.length > 0}
          tip={
            view.personalised
              ? "Paths matched to the interests you chose when you signed up."
              : "A few paths to get you started. Tell us your interests to get better picks."
          }
          action={{ label: "Browse all paths", href: ROUTES.paths }}
        />
        {view.paths.length > 0 ? (
          <CardRow columns="md:grid-cols-3">
            {view.paths.map((path) => (
              <PathCard key={path.slug} path={path} />
            ))}
          </CardRow>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-border border-dashed bg-bg-fill1 p-6">
            <p className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
              No paths yet
            </p>
            <p className="max-w-[480px] text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
              Paths are on their way. Browse what’s available and start one to see it here.
            </p>
            <Link
              href={ROUTES.paths}
              className={`link-slide inline-flex items-center gap-1 rounded-md font-semibold text-[14px] text-primary-text leading-5 tracking-[-0.14px] ${FOCUS}`}
            >
              Browse paths
              <ArrowRightIcon size={14} />
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="works-heading" className="flex flex-col gap-4">
        <SectionHeader
          id="works-heading"
          title="How Matr Studio works"
          tip="A quick look at how paths, lessons and progress work."
        />
        <ol className="m-0 flex list-none flex-col gap-6 rounded-2xl border border-border-soft p-5 md:flex-row md:gap-8 md:p-6">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex flex-1 items-start gap-4">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border-soft bg-bg-fill1 text-text-secondary"
              >
                <Icon size={20} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-[16px] text-text leading-6 tracking-[-0.16px]">
                  {title}
                </span>
                <span className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
                  {body}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {view.library.length > 0 ? (
        <section aria-labelledby="library-heading" className="flex flex-col gap-4">
          <SectionHeader
            id="library-heading"
            title={libraryHeading}
            sample={view.sampleLibrary}
            tip={
              view.personalised
                ? "Free videos, articles and tools outside your paths, picked by curators for your topics."
                : "Free videos, articles and tools from the library."
            }
            action={{ label: "Open the library", href: ROUTES.library }}
          />
          <CardRow columns="md:grid-cols-2 xl:grid-cols-4">
            {view.library.map((resource) => (
              <li key={resource.id} className="w-[300px] shrink-0 snap-start md:w-auto">
                <ResourceCard resource={resource} />
              </li>
            ))}
          </CardRow>
        </section>
      ) : null}

      <section aria-labelledby="share-heading" className="flex flex-col gap-4">
        <SectionHeader
          id="share-heading"
          title="Share a resource"
          tip="Know something useful? Send it to the curators for the library."
        />
        <div className="flex items-start gap-3 rounded-xl border border-primary-border/30 bg-primary-accent p-4">
          <UploadIcon size={20} className="mt-0.5 shrink-0 text-primary-text" />
          <div className="flex flex-col gap-1">
            <p className="font-medium text-[15px] text-text leading-5 tracking-[-0.15px]">
              Know a great free resource?
            </p>
            <p className="text-[15px] text-text-secondary leading-5 tracking-[-0.15px]">
              Share it with other learners. A curator reviews every submission.
            </p>
            <Link
              href={ROUTES.submit}
              className={`link-slide mt-1 inline-flex items-center gap-1 self-start rounded-md font-medium text-[15px] text-primary-text leading-5 tracking-[-0.15px] ${FOCUS}`}
            >
              Submit a resource
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
