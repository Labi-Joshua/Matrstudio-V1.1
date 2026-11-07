"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiFailure } from "../../lib/auth/api";
import { authErrorCopy } from "../../lib/auth/messages";
import { type OnboardingPatch, saveOnboarding } from "../../lib/auth/onboarding-api";
import {
  answersFromMe,
  canContinue,
  clampStep,
  EXIT_HREF,
  initialStep,
  nextStep,
  previousStep,
  type QuestionStep,
  rowStates,
  type StepId,
  stepFromHash,
  stepToHash,
} from "../../lib/auth/onboarding-steps";
import { closestPath, recommendPath } from "../../lib/auth/recommend-path";
import { useMe } from "../../lib/auth/use-me";
import { getCatalogue } from "../../lib/catalogue/data";
import type { TopicSlug } from "../../lib/catalogue/types";
import {
  buildOnboardingPaths,
  type GoalId,
  goalLabel,
  type LevelId,
  levelLabel,
  type OnboardingAnswers,
  topicsLabel,
  WELCOME_FEATURES,
} from "../../lib/pages/onboarding-content";
import { ROUTES } from "../../lib/routes";
import { Banner, bannerActionClasses, StatusRegion } from "../auth/banner";
import { SpinnerIcon } from "../auth/icons";
import { ChartIcon, FEATURE_ICONS, LayersIcon, RouteIcon, TargetIcon } from "./icons";
import {
  AllPaths,
  FindingState,
  GoalQuestion,
  LevelQuestion,
  RecommendedPath,
  TopicsQuestion,
  WelcomePreview,
} from "./screens";
import {
  ExitLink,
  ObButton,
  ObButtonLink,
  OnboardingModal,
  StepList,
  type StepRowView,
} from "./ui";

/**
 * Onboarding, one client page that walks the steps (Figma "User Auth and Onboarding" onboarding
 * frames and the "Flow connectors · onboarding" map). It needs a session, saves each answer the
 * moment it is chosen, and keeps the step in the URL hash so the browser Back button works.
 *
 * Saving: the choice shows at once (optimistic) and is sent to POST /api/me/onboarding in a queue,
 * one request at a time, always sending the latest value. If it fails the toast from the error
 * frame appears and Continue sends it again before moving on. Answers are never logged or stored
 * in the browser.
 */

const FIRST_NAME = /^\S+/;

type Field = QuestionStep;

const sameSet = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

function sameAnswer(field: Field, a: OnboardingAnswers, b: OnboardingAnswers): boolean {
  return field === "topics" ? sameSet(a.topics, b.topics) : a[field] === b[field];
}

function hasAnswer(field: Field, answers: OnboardingAnswers): boolean {
  return field === "topics" ? answers.topics.length > 0 : answers[field] !== null;
}

function patchFor(field: Field, answers: OnboardingAnswers): OnboardingPatch {
  if (field === "goal" && answers.goal) return { goal: answers.goal };
  if (field === "level" && answers.level) return { level: answers.level };
  return { topics: answers.topics };
}

export function OnboardingFlow() {
  const router = useRouter();
  const { state, refresh } = useMe();

  useEffect(() => {
    if (state.status === "unauthenticated") router.replace(ROUTES.signIn);
  }, [state, router]);

  if (state.status === "authenticated") {
    return <Flow name={state.me.name} onboarding={state.me.onboarding} />;
  }
  if (state.status === "error") {
    const copy = authErrorCopy(state.failure);
    return (
      <Shell>
        <div className="w-full max-w-[440px]">
          <Banner
            tone="error"
            title={copy.title}
            action={
              <button type="button" onClick={refresh} className={bannerActionClasses}>
                Try again
              </button>
            }
          >
            {copy.description}
          </Banner>
        </div>
      </Shell>
    );
  }
  return (
    <Shell>
      <StatusRegion>
        <SpinnerIcon size={24} className="text-text-secondary" />
        <span className="sr-only">Loading</span>
      </StatusRegion>
    </Shell>
  );
}

/** Full screen backdrop for the states before the card can show (loading, redirecting, error). */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg-base px-4 lg:bg-bg-fill2">
      {children}
    </div>
  );
}

function Flow({
  name,
  onboarding,
}: {
  name: string | null;
  onboarding: Parameters<typeof initialStep>[0];
}) {
  const router = useRouter();
  const paths = useMemo(() => buildOnboardingPaths(getCatalogue()), []);

  // Decided once, on first render in the browser (this component only mounts after /api/me).
  const [start] = useState(() => {
    const retake = new URLSearchParams(window.location.search).get("retake") === "1";
    const resume = initialStep(onboarding, { retake });
    const answers = answersFromMe(onboarding);
    const hash = window.location.hash ? stepFromHash(window.location.hash) : null;
    const step: StepId | "dashboard" =
      resume === "dashboard" ? "dashboard" : hash ? clampStep(hash, answers) : resume;
    return { step, answers };
  });

  const [answers, setAnswers] = useState<OnboardingAnswers>(start.answers);
  const [step, setStep] = useState<StepId>(start.step === "dashboard" ? "welcome" : start.step);
  const [notice, setNotice] = useState<ApiFailure | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [pick, setPick] = useState<string | null>(null);

  const answersRef = useRef(answers);
  const savedRef = useRef(start.answers);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const depth = useRef(0);

  // Finished learners have nothing to do here.
  useEffect(() => {
    if (start.step === "dashboard") router.replace(ROUTES.dashboard);
  }, [start.step, router]);

  // ---- history: one entry per step, so Back walks the steps -------------------------------------

  const go = useCallback((next: StepId, mode: "push" | "replace" = "push") => {
    setStep(next);
    if (next === "finding") return; // a moment, not a place: no history entry
    const url = `${window.location.pathname}${window.location.search}${stepToHash(next)}`;
    if (mode === "push") {
      depth.current += 1;
      window.history.pushState({ ob: depth.current }, "", url);
    } else {
      window.history.replaceState({ ob: depth.current }, "", url);
    }
  }, []);

  useEffect(() => {
    if (start.step !== "dashboard" && start.step !== "finding") {
      window.history.replaceState(
        { ob: 0 },
        "",
        `${window.location.pathname}${window.location.search}${stepToHash(start.step)}`,
      );
    }
    const onPop = () => {
      const target = stepFromHash(window.location.hash);
      depth.current = Number(window.history.state?.ob ?? 0) || 0;
      if (target) setStep(clampStep(target, answersRef.current));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [start.step]);

  // ---- saving -----------------------------------------------------------------------------------

  /** Sends the latest value of one answer unless the server already has it. Resolves true when saved. */
  const sync = useCallback(
    (field: Field): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        const current = answersRef.current;
        if (!hasAnswer(field, current)) return true; // nothing to save (Continue blocks empty topics)
        if (sameAnswer(field, current, savedRef.current)) return true;
        const result = await saveOnboarding(patchFor(field, current));
        if (result.ok) {
          savedRef.current = { ...savedRef.current, [field]: current[field] };
          setNotice(null);
          return true;
        }
        if (result.code === "unauthorized") {
          router.replace(ROUTES.signIn);
          return false;
        }
        setNotice(result);
        return false;
      };
      const next = queue.current.then(run);
      queue.current = next.catch(() => false);
      return next;
    },
    [router],
  );

  const syncAll = useCallback(async (): Promise<boolean> => {
    for (const field of ["goal", "level", "topics"] as const) {
      if (!(await sync(field))) return false;
    }
    return true;
  }, [sync]);

  const choose = useCallback(
    (next: OnboardingAnswers, field: Field) => {
      answersRef.current = next;
      setAnswers(next);
      void sync(field);
    },
    [sync],
  );

  const chooseGoal = (goal: GoalId) => choose({ ...answersRef.current, goal }, "goal");
  const chooseLevel = (level: LevelId) => choose({ ...answersRef.current, level }, "level");
  const toggleTopic = (topic: TopicSlug) => {
    const have = answersRef.current.topics;
    const topics = have.includes(topic) ? have.filter((t) => t !== topic) : [...have, topic];
    choose({ ...answersRef.current, topics }, "topics");
  };

  // ---- recommendation -----------------------------------------------------------------------------

  const recommendation = useMemo(() => recommendPath(paths, answers), [paths, answers]);
  const closest = useMemo(() => closestPath(paths, answers), [paths, answers]);
  // A hand-typed #path with nothing to recommend shows all paths instead.
  const shown: StepId = step === "recommended" && recommendation.kind !== "match" ? "paths" : step;

  // The "finding your path" moment: wait for every answer to be saved (and a beat so it does not
  // flash), then recommend. Reduced motion shortens the beat.
  useEffect(() => {
    if (step !== "finding") return;
    let cancelled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const beat = new Promise<void>((resolve) => setTimeout(resolve, reduced ? 400 : 1400));
    void (async () => {
      const [saved] = await Promise.all([syncAll(), beat]);
      if (cancelled) return;
      if (!saved) {
        go("topics", "replace"); // the toast explains; Continue retries
        return;
      }
      if (paths.length === 0) {
        router.replace(EXIT_HREF);
        return;
      }
      const result = recommendPath(paths, answersRef.current);
      go(result.kind === "match" ? "recommended" : "paths");
    })();
    return () => {
      cancelled = true;
    };
  }, [step, syncAll, go, paths, router]);

  // ---- actions -----------------------------------------------------------------------------------

  async function onContinue() {
    if (advancing || !canContinue(step, answers)) return;
    const next = nextStep(step);
    if (!next) return;
    if (step === "welcome") {
      go(next);
      return;
    }
    setAdvancing(true);
    const saved = step === "topics" ? await syncAll() : await sync(step as Field);
    setAdvancing(false);
    if (saved) go(next);
  }

  function onBack() {
    const target = previousStep(shown, recommendation.kind === "match");
    if (!target) return;
    // Use the browser history when we pushed this step ourselves, so Back and the button agree.
    if (Number(window.history.state?.ob ?? 0) > 0) window.history.back();
    else go(target, "replace");
  }

  // ---- view --------------------------------------------------------------------------------------

  const states = rowStates(shown);
  const rowIcon = {
    goal: <TargetIcon />,
    level: <ChartIcon />,
    topics: <LayersIcon />,
    path: <RouteIcon />,
  };
  const rows: StepRowView[] =
    shown === "welcome"
      ? WELCOME_FEATURES.map((feature, index) => {
          const Icon = FEATURE_ICONS[feature.id];
          return {
            id: feature.id,
            title: feature.title,
            subtitle: feature.description,
            icon: <Icon size={20} />,
            state: index === 0 ? "active" : "idle",
          };
        })
      : [
          {
            id: "goal",
            title: "Your goal",
            subtitle:
              (states.goal === "done" ? goalLabel(answers.goal) : null) ??
              "What you want to achieve",
            icon: rowIcon.goal,
            state: states.goal,
          },
          {
            id: "level",
            title: "Your level",
            subtitle:
              (states.level === "done" ? levelLabel(answers.level) : null) ??
              "How much experience you have",
            icon: rowIcon.level,
            state: states.level,
          },
          {
            id: "topics",
            title: "Topics",
            subtitle:
              (states.topics === "done" && answers.topics.length > 0
                ? topicsLabel(answers.topics)
                : null) ?? "What you want to learn",
            icon: rowIcon.topics,
            state: states.topics,
          },
          {
            id: "path",
            title: "Your path",
            subtitle: "A learning path picked for you",
            icon: rowIcon.path,
            state: states.path,
          },
        ];

  const firstName = name?.match(FIRST_NAME)?.[0];
  const selectedSlug = pick ?? closest?.slug ?? paths[0]?.slug ?? null;
  const selectedPath = paths.find((p) => p.slug === selectedSlug) ?? null;
  const recommended = recommendation.kind === "match" ? recommendation.path : null;

  if (start.step === "dashboard")
    return (
      <Shell>
        <SpinnerIcon size={24} className="text-text-secondary" />
      </Shell>
    );

  const exitSkip = <ExitLink href={EXIT_HREF}>Skip for now</ExitLink>;
  const exitDashboard = <ExitLink href={EXIT_HREF}>Go to dashboard</ExitLink>;
  const back = (
    <ObButton variant="secondary" onClick={onBack}>
      Back
    </ObButton>
  );

  let modal: ReactNode;
  switch (shown) {
    case "welcome":
      modal = (
        <OnboardingModal
          leftIsH1
          leftOnMobile
          leftTitle={firstName ? `Welcome to Matr Studio, ${firstName}` : "Welcome to Matr Studio"}
          leftDescription="Thanks for joining. Here’s what you can do here."
          leftBody={<StepList label="What you can do in Matr Studio" rows={rows} />}
          mobileExit={exitSkip}
          footerRight={
            <>
              <ObButtonLink href={EXIT_HREF} variant="ghost" className="hidden lg:inline-flex">
                Skip for now
              </ObButtonLink>
              <ObButton onClick={onContinue}>Set up my path</ObButton>
            </>
          }
        >
          <WelcomePreview />
        </OnboardingModal>
      );
      break;
    case "goal":
    case "level":
    case "topics":
      modal = (
        <OnboardingModal
          leftTitle="Let’s set up your learning"
          leftDescription="Three quick questions, then we’ll suggest a path."
          leftBody={<StepList label="Setup progress" rows={rows} />}
          mobileExit={exitSkip}
          footerLeft={exitSkip}
          footerRight={
            <>
              {shown === "goal" ? null : back}
              <ObButton
                onClick={onContinue}
                pending={advancing}
                inactive={!canContinue(shown, answers)}
              >
                {shown === "topics" ? "See my path" : "Continue"}
              </ObButton>
            </>
          }
        >
          {shown === "goal" ? <GoalQuestion value={answers.goal} onChange={chooseGoal} /> : null}
          {shown === "level" ? (
            <LevelQuestion value={answers.level} onChange={chooseLevel} />
          ) : null}
          {shown === "topics" ? (
            <TopicsQuestion value={answers.topics} onToggle={toggleTopic} />
          ) : null}
        </OnboardingModal>
      );
      break;
    case "finding":
      modal = (
        <OnboardingModal
          leftTitle="Finding your path"
          leftDescription="This only takes a moment."
          leftBody={<StepList label="Setup progress" rows={rows} />}
        >
          <FindingState />
        </OnboardingModal>
      );
      break;
    case "recommended":
      modal = (
        <OnboardingModal
          leftTitle="You’re all set"
          leftDescription="We used your answers to pick a starting point."
          leftBody={<StepList label="Setup progress" rows={rows} />}
          mobileExit={exitDashboard}
          footerLeft={exitDashboard}
          footerRight={
            <>
              <ObButton variant="secondary" grow onClick={() => go("paths")}>
                <span className="lg:hidden">Other paths</span>
                <span className="hidden lg:inline">See other paths</span>
              </ObButton>
              <ObButtonLink
                href={recommended ? ROUTES.topic(recommended.topicSlug) : EXIT_HREF}
                grow
              >
                Start this path
              </ObButtonLink>
            </>
          }
        >
          {recommended ? <RecommendedPath path={recommended} /> : null}
        </OnboardingModal>
      );
      break;
    case "paths":
      modal = (
        <OnboardingModal
          leftTitle="Choose a path"
          leftDescription="Pick any path to see what’s inside. You can follow more than one."
          leftBody={<StepList label="Setup progress" rows={rows} />}
          mobileExit={exitDashboard}
          footerLeft={exitDashboard}
          footerRight={
            <>
              {back}
              <ObButtonLink
                href={selectedPath ? ROUTES.topic(selectedPath.topicSlug) : EXIT_HREF}
                grow
              >
                View path
              </ObButtonLink>
            </>
          }
        >
          <AllPaths
            paths={paths}
            selected={selectedSlug}
            closestSlug={closest?.slug ?? null}
            noMatch={recommendation.kind !== "match"}
            onSelect={setPick}
          />
        </OnboardingModal>
      );
      break;
  }

  return (
    <>
      {modal}
      <StatusRegion className="sr-only">
        {shown === "finding" ? "Finding your path. Matching your goal, level and topics." : null}
      </StatusRegion>
      <div className="pointer-events-none fixed inset-x-4 top-4 z-50 flex justify-center">
        <StatusRegion politeness="assertive" className="pointer-events-auto w-full max-w-[440px]">
          {notice ? <SaveFailedBanner failure={notice} onDismiss={() => setNotice(null)} /> : null}
        </StatusRegion>
      </div>
    </>
  );
}

/** The toast from the "couldn't save answers" frame. Rate limits say how long to wait instead. */
function SaveFailedBanner({ failure, onDismiss }: { failure: ApiFailure; onDismiss: () => void }) {
  if (failure.code === "rate_limited" || failure.code === "too_many_attempts") {
    const copy = authErrorCopy(failure);
    return (
      <Banner tone="error" title={copy.title} onDismiss={onDismiss}>
        {copy.description}
      </Banner>
    );
  }
  return (
    <Banner tone="error" title="Your answer didn’t save" onDismiss={onDismiss}>
      Check your connection and tap Continue again.
    </Banner>
  );
}
