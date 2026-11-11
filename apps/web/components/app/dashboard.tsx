"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  buildDashboard,
  type DashboardView,
  pickHomeVariant,
  SECTION_TIPS,
} from "../../lib/app/dashboard";
import { buildHomeProgress, ownedSlugs } from "../../lib/app/home-data";
import { firstName, welcomeTitle } from "../../lib/app/profile";
import { getCatalogue } from "../../lib/catalogue/data";
import { USE_SAMPLE_WHEN_EMPTY } from "../../lib/pages/topic-content";
import { ROUTES } from "../../lib/routes";
import { usePaths } from "../app-progress/progress-provider";
import { ResourceCard } from "../pages/browse/resource-card";
import { SavedSection, SubmissionsSection } from "./home-lists";
import { CardRow, PathCard, SectionHeader } from "./home-parts";
import { HomeError, HomeSkeleton, OfflineBanner } from "./home-states";
import { ProgressHome } from "./home-variants";
import { useSkeletonGate } from "./hooks";
import { ArrowRightIcon, CircleCheckIcon, FileTextIcon, SparklesIcon, UploadIcon } from "./icons";
import { useSession } from "./session";
import { FOCUS } from "./ui";

/**
 * Home (Figma "Home" page). The learner's path progress (usePaths) picks the layout: new account
 * (nothing started), learning in progress, welcome back (no activity for a week) or path finished
 * (lib/app/home-data.ts, lib/app/dashboard.ts pickHomeVariant). Library picks, Saved, Your
 * submissions and Share a resource follow every layout. New-account order: greeting, the
 * finish-setup prompt (only while onboarding is incomplete), Picked for you, How Matr Studio
 * works.
 *
 * States: the gated skeleton while the progress loads, "couldn't load" with Try again when it
 * fails (or the page cannot be built), and an offline strip above everything while the browser
 * reports no connection. Saved and Your submissions load on their own and fail on their own.
 * Sample paths and library cards (empty catalogue only) carry a "Sample content" tag.
 */

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

function NewAccountHome({ view }: { view: DashboardView }) {
  const { me } = useSession();
  const pickedHeading = view.personalised ? "Picked for you" : "Paths to start with";
  return (
    <>
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
          action={{ label: "Browse all paths", href: ROUTES.app.paths }}
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
              href={ROUTES.app.paths}
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
          tip={SECTION_TIPS.howItWorks}
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
    </>
  );
}

export function Dashboard() {
  const { me } = useSession();
  const paths = usePaths();
  const showSkeleton = useSkeletonGate(paths.status === "loading");
  const [attempt, setAttempt] = useState(0);
  const owned = useMemo(() => ownedSlugs(paths.entries), [paths.entries]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` rebuilds the view on Try again
  const view = useMemo(() => {
    try {
      return buildDashboard(getCatalogue(), me.onboarding, USE_SAMPLE_WHEN_EMPTY, owned);
    } catch {
      return null;
    }
  }, [me.onboarding, owned, attempt]);
  const progress = useMemo(() => {
    if (!view || paths.status !== "ready") return null;
    try {
      return buildHomeProgress({
        entries: paths.entries,
        catalogue: getCatalogue(),
        recommended: view.paths,
        now: Date.now(),
      });
    } catch {
      return null;
    }
  }, [view, paths.status, paths.entries]);
  const variant = pickHomeVariant(progress);

  if (paths.status === "loading") {
    return showSkeleton ? <HomeSkeleton /> : <div aria-busy="true" className="min-h-[60vh]" />;
  }
  if (!view || paths.status === "error") {
    return (
      <HomeError
        onRetry={() => {
          setAttempt((value) => value + 1);
          if (paths.status === "error") paths.reload();
        }}
      />
    );
  }
  const libraryHeading = view.personalised ? "Library picks for you" : "From the library";

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-10">
      <OfflineBanner />
      {variant !== "new-account" && progress ? (
        <ProgressHome
          variant={variant}
          progress={progress}
          firstName={firstName(me.name)}
          hour={new Date().getHours()}
          now={new Date()}
        />
      ) : (
        <NewAccountHome view={view} />
      )}

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
            action={{ label: "Open the library", href: ROUTES.app.library }}
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

      <SavedSection quiet={variant === "new-account"} />
      <SubmissionsSection quiet={variant === "new-account"} />

      <section aria-labelledby="share-heading" className="flex flex-col gap-4">
        <SectionHeader id="share-heading" title="Share a resource" tip={SECTION_TIPS.share} />
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
              href={ROUTES.app.submit}
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
