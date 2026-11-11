import type { Me } from "../auth/api";
import { type RecommendablePath, recommendPath } from "../auth/recommend-path";
import type { Catalogue } from "../catalogue/types";
import { type BrowseResource, getLibraryData } from "../pages/browse-library";
import {
  buildOnboardingPaths,
  isGoalId,
  isLevelId,
  isTopicId,
  type OnboardingAnswers,
  type OnboardingPath,
} from "../pages/onboarding-content";
import { TOPIC_CONTENT, USE_SAMPLE_WHEN_EMPTY } from "../pages/topic-content";
import type { NotificationItem } from "./notifications";
import { joinWithAnd } from "./profile";

/**
 * What the Home dashboard shows, worked out from the catalogue and the onboarding answers. Pure
 * and empty-safe: with no paths and no resources every list is empty and the screen falls back to
 * its "browse paths" prompt.
 *
 * There is no progress, saved-items or notifications API yet, so nothing here is "the learner's
 * progress": the view only holds recommendations. Sample content (Figma frames) stands in only
 * while the catalogue is empty and USE_SAMPLE_WHEN_EMPTY is on, and is flagged `sample`.
 */

export const PICKED_COUNT = 3;
export const LIBRARY_COUNT = 4;

/** Onboarding answers from /api/me, dropping any value this app version does not know. */
export function answersFromMe(onboarding: Me["onboarding"]): OnboardingAnswers {
  return {
    goal: isGoalId(onboarding.goal) ? onboarding.goal : null,
    level: isLevelId(onboarding.level) ? onboarding.level : null,
    topics: onboarding.topics.filter(isTopicId),
  };
}

/**
 * The best `limit` paths for the learner, best first: paths on their topics, nearest level first
 * (lib/auth/recommend-path.ts), then the closest of the rest. Never repeats a path.
 */
export function pickForYou<T extends RecommendablePath>(
  paths: readonly T[],
  answers: Pick<OnboardingAnswers, "goal" | "level" | "topics">,
  limit: number = PICKED_COUNT,
): T[] {
  const remaining = [...paths];
  const picked: T[] = [];
  while (picked.length < limit && remaining.length > 0) {
    const result = recommendPath(remaining, answers);
    const next = result.kind === "match" ? result.path : result.closest;
    if (!next) break;
    picked.push(next);
    remaining.splice(remaining.indexOf(next), 1);
  }
  return picked;
}

/** Library cards on the learner's topics first, then the rest, `limit` in all. */
export function libraryPicks(
  resources: readonly BrowseResource[],
  topicNames: readonly string[],
  limit: number = LIBRARY_COUNT,
): BrowseResource[] {
  const wanted = new Set(topicNames.map((name) => name.toLowerCase()));
  const isMine = (r: BrowseResource) => wanted.has(r.topicName.toLowerCase());
  return [...resources.filter(isMine), ...resources.filter((r) => !isMine(r))].slice(0, limit);
}

export type DashboardPath = OnboardingPath & {
  description: string | null;
  /** Where the card opens; the topic page when absent. */
  href?: string;
};

/** Card description: the catalogue's, else the design sample's for the same title, else none. */
function describe(catalogue: Catalogue, path: OnboardingPath): DashboardPath {
  const real = catalogue.paths.find((p) => p.slug === path.slug)?.description;
  const sample = path.sample
    ? TOPIC_CONTENT[path.topicSlug].sample.paths.find((p) => p.title === path.title)?.description
    : undefined;
  return { ...path, description: real ?? sample ?? null };
}

export type DashboardView = {
  /** True when the recommended paths are Figma sample data (empty catalogue). */
  samplePaths: boolean;
  /** True when the library cards are Figma sample data. */
  sampleLibrary: boolean;
  /** The learner picked topics, so "Picked for you" is honest; otherwise it is a plain start list. */
  personalised: boolean;
  /** "UI/UX and Brand", or "" when there are no topics. */
  topicsSentence: string;
  paths: DashboardPath[];
  library: BrowseResource[];
};

export function buildDashboard(
  catalogue: Catalogue,
  onboarding: Me["onboarding"],
  useSample: boolean = USE_SAMPLE_WHEN_EMPTY,
  /** Paths the learner already has (started or finished): never recommended again. */
  exclude: ReadonlySet<string> = new Set(),
): DashboardView {
  const answers = answersFromMe(onboarding);
  const all = buildOnboardingPaths(catalogue, useSample).filter((p) => !exclude.has(p.slug));
  const topicNames = answers.topics.flatMap(
    (slug) => catalogue.topics.find((t) => t.slug === slug)?.name ?? [],
  );
  const libraryData = getLibraryData(catalogue);
  const showLibrary = !libraryData.isSample || useSample;
  return {
    samplePaths: all.some((p) => p.sample),
    sampleLibrary: showLibrary && libraryData.isSample,
    personalised: answers.topics.length > 0,
    topicsSentence: joinWithAnd(topicNames),
    paths: pickForYou(all, answers).map((p) => describe(catalogue, p)),
    library: showLibrary ? libraryPicks(libraryData.resources, topicNames) : [],
  };
}

/**
 * The four Home layouts of the design. The learner's path progress picks one (`pickHomeVariant`,
 * data built in lib/app/home-data.ts); the progress layouts are pure view components over the
 * typed `HomeProgress` below, also exercised with `HOME_FIXTURES`.
 */
export type HomeVariant = "new-account" | "in-progress" | "welcome-back" | "finished";

export type ProgressPath = DashboardPath & {
  lessonsDone: number;
  /** Next lesson to open; null when the path is finished or not started. */
  next: {
    number: number;
    title: string;
    format: "Video" | "Article" | "Tool";
    minutes: number | null;
    /** The lesson page; the path page when absent. */
    href?: string;
  } | null;
  /** The lesson done most recently, for "Last time you finished ...". */
  lastDone?: { number: number; title: string } | null;
  /** Whole days since the learner last opened the path. */
  lastActiveDays: number;
};

export type HomeProgress = {
  /** Paths the learner has started, most recently active first. */
  started: ProgressPath[];
  /** The path finished most recently, if any, and how many days ago (0 = today). */
  finished: { path: ProgressPath; daysAgo: number } | null;
  /** Paths to suggest next. */
  recommended: DashboardPath[];
  /** What changed since the last visit. */
  away: NotificationItem[];
};

/** Days away after which "Welcome back" replaces the plain greeting. */
export const WELCOME_BACK_AFTER_DAYS = 7;

/** Picks the layout; with nothing started (or no progress loaded) it is the new-account one. */
export function pickHomeVariant(progress: HomeProgress | null): HomeVariant {
  if (!progress) return "new-account";
  if (progress.finished && progress.finished.daysAgo <= 1) return "finished";
  const last = progress.started[0];
  if (!last) return "new-account";
  return last.lastActiveDays >= WELCOME_BACK_AFTER_DAYS ? "welcome-back" : "in-progress";
}

export function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}

export function lastActiveLabel(days: number): string {
  if (days <= 0) return "Last active today";
  if (days === 1) return "Last active yesterday";
  return `Last active ${days} days ago`;
}

export function greetingPeriod(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  return hour < 18 ? "afternoon" : "evening";
}

const COUNT_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** Heading and sub-line of each progress layout (Figma wording). */
export function homeIntro(
  variant: Exclude<HomeVariant, "new-account">,
  progress: HomeProgress,
  firstName: string | null,
  hour: number,
): { title: string; subtitle: string } {
  const comma = firstName ? `, ${firstName}` : "";
  if (variant === "finished") {
    return {
      title: `Congratulations${comma}`,
      subtitle: `You finished ${progress.finished?.path.title ?? "your path"}. Here’s what’s next.`,
    };
  }
  if (variant === "welcome-back") {
    const days = progress.started[0]?.lastActiveDays ?? 0;
    return {
      title: `Welcome back${comma}`,
      subtitle: `It’s been ${days} days. Here’s where you stopped.`,
    };
  }
  const count = progress.started.length;
  const word = COUNT_WORD[count] ?? String(count);
  return {
    title: `Good ${greetingPeriod(hour)}${comma}`,
    subtitle: `You have ${word} ${count === 1 ? "path" : "paths"} on the go. Pick up where you left off.`,
  };
}

/** Copy of the section tooltips (Figma "Section tooltips"). */
export const SECTION_TIPS = {
  continueLearning: "Jump straight back into the next lesson of the path you used last.",
  pickUp: "The lesson you stopped at, so you can carry on without searching.",
  yourPaths: "Paths you’ve started or starred. Progress updates as you mark lessons done.",
  recommendedNext: "Paths matched to your interests and the paths you’ve taken.",
  pickedForYou:
    "Paths matched to the interests you chose when you signed up. Star one to keep it in your sidebar.",
  howItWorks: "A quick look at how paths, lessons and progress work.",
  libraryPicks:
    "Free videos, articles and tools outside your paths, picked by curators for your topics.",
  popularLibrary: "Free resources other learners are opening this week.",
  saved: "Resources you bookmarked. Tap the bookmark on any resource to save it.",
  submissions: "Resources you shared and where each one is in review.",
  share: "Know something useful? Send it to the curators for the library.",
  whileAway:
    "What changed since your last visit: curator decisions on your submissions and new lessons in your paths.",
  finished: "Celebrate and share the path you just completed.",
  learnNext: "Paths that build on the one you just finished. Start one and it joins your sidebar.",
  rate: "Your rating helps curators improve the path and helps others choose.",
  otherInProgress: "Paths you started that are still waiting for you.",
} as const;

const samplePathCard = (
  slug: string,
  title: string,
  topicSlug: DashboardPath["topicSlug"],
  lessons: number,
  hours: number,
  description: string,
): DashboardPath => ({
  slug,
  title,
  topicSlug,
  level: "beginner",
  lessons,
  hours,
  firstLessons: [],
  sample: true,
  description,
});

const foundations = samplePathCard(
  "ui-ux-foundations",
  "UI/UX Foundations",
  "ui-ux",
  12,
  8,
  "Go from layout basics to a tested prototype.",
);
const productDesign = samplePathCard(
  "product-design-essentials",
  "Product Design Essentials",
  "product",
  10,
  7,
  "Frame problems, talk to users, map flows and ship features.",
);

const productInProgress: ProgressPath = {
  ...productDesign,
  lessonsDone: 4,
  next: { number: 5, title: "Mapping user flows", format: "Video", minutes: 15 },
  lastActiveDays: 3,
};
const foundationsInProgress: ProgressPath = {
  ...foundations,
  lessonsDone: 3,
  next: { number: 4, title: "Wireframing basics", format: "Article", minutes: 8 },
  lastActiveDays: 5,
};
const recommended = [
  samplePathCard(
    "design-systems-101",
    "Design Systems 101",
    "design-systems",
    11,
    9,
    "Build and document a small design system in Figma.",
  ),
  samplePathCard(
    "seo-for-designers",
    "SEO for Designers",
    "seo",
    8,
    5,
    "Design pages that people and search engines can find.",
  ),
  samplePathCard(
    "dev-handoff-essentials",
    "Dev Handoff Essentials",
    "dev-handoff",
    9,
    6,
    "Specs, tokens and hand-off habits developers love.",
  ),
];

/** Design sample data for the three progress layouts: tests and previews only, never shown in production. */
export const HOME_FIXTURES: Record<Exclude<HomeVariant, "new-account">, HomeProgress> = {
  "in-progress": {
    started: [productInProgress, foundationsInProgress],
    finished: null,
    recommended,
    away: [],
  },
  "welcome-back": {
    started: [{ ...foundationsInProgress, lastActiveDays: 9 }, productInProgress],
    finished: null,
    recommended,
    away: [
      {
        id: "a1",
        kind: "curator-approved",
        title: "Your resource was approved",
        body: "“Grid systems for web” is now in the library.",
        createdAt: "2026-11-08T10:00:00.000Z",
        read: false,
      },
      {
        id: "a2",
        kind: "curator-changes",
        title: "Your submission needs a change",
        body: "“Prototyping micro-interactions”: please link to the full video, not a short clip.",
        createdAt: "2026-11-06T10:00:00.000Z",
        read: false,
      },
      {
        id: "a3",
        kind: "new-lesson",
        title: "New lesson in UI/UX Foundations",
        body: "Lesson 13, Accessibility basics, was added to your path.",
        createdAt: "2026-11-05T10:00:00.000Z",
        read: false,
      },
    ],
  },
  finished: {
    started: [productInProgress],
    finished: {
      path: { ...foundations, lessonsDone: 12, next: null, lastActiveDays: 0 },
      daysAgo: 0,
    },
    recommended,
    away: [],
  },
};
