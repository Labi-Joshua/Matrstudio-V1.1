import {
  isGoalId,
  isLevelId,
  isTopicId,
  type OnboardingAnswers,
} from "../pages/onboarding-content";
import { ROUTES } from "../routes";
import type { Me } from "./api";

/**
 * The onboarding flow as a pure step machine (Figma "Flow connectors · onboarding"):
 *
 *   welcome -> goal -> level -> topics -> finding -> recommended -> (see other paths) paths
 *                                                  \-> paths (no match)
 *
 * "Skip for now" and "Go to dashboard" leave for the dashboard from any screen. Nothing here
 * touches the browser or the network, so it is all unit tested.
 */
export type StepId = "welcome" | "goal" | "level" | "topics" | "finding" | "recommended" | "paths";

export const QUESTION_STEPS = ["goal", "level", "topics"] as const;
export type QuestionStep = (typeof QUESTION_STEPS)[number];

export const isQuestionStep = (step: StepId): step is QuestionStep =>
  (QUESTION_STEPS as readonly StepId[]).includes(step);

/** 1 to 3 for the question screens ("Step 2 of 3"), null elsewhere. */
export function stepNumber(step: StepId): number | null {
  const index = (QUESTION_STEPS as readonly StepId[]).indexOf(step);
  return index === -1 ? null : index + 1;
}

export const hasAllAnswers = (answers: OnboardingAnswers): boolean =>
  answers.goal !== null && answers.level !== null && answers.topics.length > 0;

/** Answers as the API stores them, with anything we do not recognise dropped. */
export function answersFromMe(onboarding: Me["onboarding"]): OnboardingAnswers {
  const topics: OnboardingAnswers["topics"] = [];
  for (const topic of onboarding.topics) {
    if (isTopicId(topic) && !topics.includes(topic)) topics.push(topic);
  }
  return {
    goal: isGoalId(onboarding.goal) ? onboarding.goal : null,
    level: isLevelId(onboarding.level) ? onboarding.level : null,
    topics,
  };
}

/** The first question without an answer, or null when all three are answered. */
export function firstMissingStep(answers: OnboardingAnswers): QuestionStep | null {
  if (answers.goal === null) return "goal";
  if (answers.level === null) return "level";
  if (answers.topics.length === 0) return "topics";
  return null;
}

/**
 * Where to start. Nobody who is done goes through it again unless they asked to retake
 * ("dashboard"). Nobody with partial answers sees the welcome screen again: they resume at the
 * first unanswered question.
 */
export function initialStep(
  onboarding: Me["onboarding"],
  options: { retake?: boolean } = {},
): StepId | "dashboard" {
  if (onboarding.completed && !options.retake) return "dashboard";
  if (options.retake) return "goal";
  const answers = answersFromMe(onboarding);
  const untouched = answers.goal === null && answers.level === null && answers.topics.length === 0;
  if (untouched) return "welcome";
  return firstMissingStep(answers) ?? "finding";
}

/** Whether Continue is allowed on a question screen (topics need at least one pick). */
export function canContinue(step: StepId, answers: OnboardingAnswers): boolean {
  switch (step) {
    case "goal":
      return answers.goal !== null;
    case "level":
      return answers.level !== null;
    case "topics":
      return answers.topics.length > 0;
    default:
      return true;
  }
}

export function nextStep(step: StepId): StepId | null {
  switch (step) {
    case "welcome":
      return "goal";
    case "goal":
      return "level";
    case "level":
      return "topics";
    case "topics":
      return "finding";
    default:
      return null;
  }
}

/**
 * The screen the Back button goes to. From "paths" it depends on how we got there: after a
 * recommendation Back returns to it, after "no match" it returns to the topics.
 */
export function previousStep(step: StepId, cameFromRecommendation = false): StepId | null {
  switch (step) {
    case "goal":
      return "welcome";
    case "level":
      return "goal";
    case "topics":
      return "level";
    case "paths":
      return cameFromRecommendation ? "recommended" : "topics";
    case "recommended":
      return "topics";
    default:
      return null;
  }
}

/** Never show a screen whose earlier answers are missing (a stale or hand-typed URL hash). */
export function clampStep(step: StepId, answers: OnboardingAnswers): StepId {
  if (step === "welcome" || step === "goal") return step;
  // level needs the goal, topics need goal and level, the rest need everything.
  const missing = firstMissingStep(answers);
  if (missing === null) return step;
  if (step === "level") return missing === "goal" ? "goal" : step;
  if (step === "topics") return missing === "topics" ? step : missing;
  return missing;
}

// ---------------------------------------------------------------------------------------------
// URL hash, so the browser Back button walks the steps. "finding" has no hash: it is a moment,
// not a place, and Back must never land on it.
// ---------------------------------------------------------------------------------------------

const HASH_BY_STEP: Record<Exclude<StepId, "finding">, string> = {
  welcome: "",
  goal: "#goal",
  level: "#level",
  topics: "#topics",
  recommended: "#path",
  paths: "#paths",
};

export function stepToHash(step: StepId): string {
  return step === "finding" ? HASH_BY_STEP.topics : HASH_BY_STEP[step];
}

export function stepFromHash(hash: string): StepId | null {
  const clean = hash.replace(/^#/, "");
  if (clean === "") return "welcome";
  const entry = (Object.entries(HASH_BY_STEP) as [StepId, string][]).find(
    ([, value]) => value === `#${clean}`,
  );
  return entry ? entry[0] : null;
}

// ---------------------------------------------------------------------------------------------
// The left-pane list: Your goal, Your level, Topics, Your path
// ---------------------------------------------------------------------------------------------

export type RowId = "goal" | "level" | "topics" | "path";
export type RowState = "done" | "active" | "idle";

export const ROW_IDS: RowId[] = ["goal", "level", "topics", "path"];

/** "done" rows show their answer and a green check, "active" is the current one. */
export function rowStates(step: StepId): Record<RowId, RowState> {
  const current: RowId =
    step === "goal" || step === "level" || step === "topics"
      ? step
      : step === "welcome"
        ? "goal"
        : "path";
  const at = ROW_IDS.indexOf(current);
  const out = {} as Record<RowId, RowState>;
  for (const [i, id] of ROW_IDS.entries()) {
    out[id] = step === "welcome" ? "idle" : i < at ? "done" : i === at ? "active" : "idle";
  }
  return out;
}

/** Share of the mobile progress bar that is filled on each question screen. */
export function progressFraction(step: StepId): number {
  const n = stepNumber(step);
  return n === null ? 0 : n / QUESTION_STEPS.length;
}

/** Where leaving the flow goes: skip for now and go to dashboard are the same place. */
export const EXIT_HREF = ROUTES.dashboard;
