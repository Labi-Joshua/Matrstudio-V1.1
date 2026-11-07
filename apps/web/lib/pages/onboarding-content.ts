import { lessonsOf, pathHours } from "../catalogue/derive";
import type { Catalogue, Level, TopicSlug } from "../catalogue/types";
import { USE_SAMPLE_WHEN_EMPTY } from "./topic-content";

/**
 * Copy and options of the onboarding screens ("User Auth and Onboarding" page in Figma: welcome,
 * three questions, finding your path, recommended path, all paths). Option ids are the values the
 * API stores (packages/types ONBOARDING_GOALS / ONBOARDING_LEVELS / ONBOARDING_TOPICS); keep them
 * in step with that file. Topic ids are the catalogue topic slugs.
 */

export const GOAL_IDS = [
  "learn_new_skill",
  "grow_in_role",
  "switch_careers",
  "build_projects",
] as const;
export type GoalId = (typeof GOAL_IDS)[number];

export const LEVEL_IDS = [
  "beginner",
  "intermediate",
  "advanced",
] as const satisfies readonly Level[];
export type LevelId = (typeof LEVEL_IDS)[number];

export const TOPIC_IDS = [
  "ui-ux",
  "brand",
  "product",
  "seo",
  "social-media",
  "design-systems",
  "dev-handoff",
] as const satisfies readonly TopicSlug[];

/** What the learner has told us so far. Topics keep the order they were chosen in. */
export type OnboardingAnswers = {
  goal: GoalId | null;
  level: LevelId | null;
  topics: TopicSlug[];
};

export const EMPTY_ANSWERS: OnboardingAnswers = { goal: null, level: null, topics: [] };

export type ChoiceOption<Id extends string> = { id: Id; title: string; description: string };

export const GOAL_OPTIONS: ChoiceOption<GoalId>[] = [
  {
    id: "learn_new_skill",
    title: "Learn a new skill",
    description: "Start a new discipline from scratch.",
  },
  {
    id: "grow_in_role",
    title: "Grow in my current role",
    description: "Sharpen skills I use at work every day.",
  },
  {
    id: "switch_careers",
    title: "Switch careers",
    description: "Move into design or design-adjacent work.",
  },
  {
    id: "build_projects",
    title: "Build my own projects",
    description: "Ship a brand, product or site of my own.",
  },
];

export const LEVEL_OPTIONS: ChoiceOption<LevelId>[] = [
  {
    id: "beginner",
    title: "Beginner",
    description: "I’m new to this and want to learn the basics.",
  },
  {
    id: "intermediate",
    title: "Intermediate",
    description: "I’ve done a few projects and know the fundamentals.",
  },
  {
    id: "advanced",
    title: "Advanced",
    description: "I work in design or development and want to go deeper.",
  },
];

export type TopicOption = ChoiceOption<TopicSlug> & {
  /** Short form for the "Topics" row once answered ("UI/UX, Product design"). */
  short: string;
};

export const TOPIC_OPTIONS: TopicOption[] = [
  {
    id: "ui-ux",
    title: "UI/UX design",
    short: "UI/UX",
    description: "Research, wireframes, interfaces.",
  },
  {
    id: "product",
    title: "Product design",
    short: "Product design",
    description: "Solve problems end to end.",
  },
  {
    id: "brand",
    title: "Brand design",
    short: "Brand design",
    description: "Logos, identity, guidelines.",
  },
  {
    id: "social-media",
    title: "Social media design",
    short: "Social media design",
    description: "Posts, campaigns, motion.",
  },
  { id: "seo", title: "SEO", short: "SEO", description: "Get found in search." },
  {
    id: "design-systems",
    title: "Design systems",
    short: "Design systems",
    description: "Tokens, components, docs.",
  },
  {
    id: "dev-handoff",
    title: "Dev handoff",
    short: "Dev handoff",
    description: "Specs, assets, working with devs.",
  },
];

export const WELCOME_FEATURES = [
  {
    id: "paths",
    title: "Learning paths",
    description: "Follow step-by-step paths built from free resources.",
  },
  {
    id: "library",
    title: "Resource library",
    description: "Search hand-picked tools, articles and videos.",
  },
  {
    id: "collections",
    title: "Collections",
    description: "Save resources you like in one place.",
  },
  {
    id: "submit",
    title: "Submit resources",
    description: "Share something great and help others learn.",
  },
  {
    id: "progress",
    title: "Track progress",
    description: "Pick up where you left off and earn badges.",
  },
] as const;

export type WelcomeFeatureId = (typeof WELCOME_FEATURES)[number]["id"];

/** Narrowing helpers for values that come from the API (which may hold an older or odd value). */
export const isGoalId = (v: unknown): v is GoalId => GOAL_IDS.some((id) => id === v);
export const isLevelId = (v: unknown): v is LevelId => LEVEL_IDS.some((id) => id === v);
export const isTopicId = (v: unknown): v is TopicSlug => TOPIC_IDS.some((id) => id === v);

const optionTitle = <Id extends string>(options: ChoiceOption<Id>[], id: Id | null) =>
  options.find((o) => o.id === id)?.title ?? null;

export const goalLabel = (id: GoalId | null) => optionTitle(GOAL_OPTIONS, id);
export const levelLabel = (id: LevelId | null) => optionTitle(LEVEL_OPTIONS, id);
export const topicsLabel = (ids: TopicSlug[]) =>
  ids
    .map((id) => TOPIC_OPTIONS.find((o) => o.id === id)?.short)
    .filter((label): label is string => Boolean(label))
    .join(", ");

// ---------------------------------------------------------------------------------------------
// Paths shown by the recommendation and "all paths" screens
// ---------------------------------------------------------------------------------------------

export type OnboardingLesson = {
  title: string;
  /** Second line: "YouTube · 12 min". */
  meta: string;
};

export type OnboardingPath = {
  slug: string;
  topicSlug: TopicSlug;
  title: string;
  level: Level;
  lessons: number;
  /** Total length in hours; null when unknown (design samples show it for one path only). */
  hours: number | null;
  /** The first lessons, in order (the design shows three). */
  firstLessons: OnboardingLesson[];
  /** True when this is Figma sample data, not a catalogue path. */
  sample: boolean;
};

const samplePath = (
  slug: string,
  topicSlug: TopicSlug,
  title: string,
  level: Level,
  lessons: number,
): OnboardingPath => ({
  slug,
  topicSlug,
  title,
  level,
  lessons,
  hours: null,
  firstLessons: [],
  sample: true,
});

/**
 * What the "all paths" and "recommended" frames show, as design sample data only: the seven paths
 * (one per topic) and the first three lessons and hours of the UI/UX one. Used while the
 * catalogue has no published paths and USE_SAMPLE_WHEN_EMPTY (lib/pages/topic-content.ts) is true.
 * Nothing here is invented beyond the frames: unknown hours and lessons stay absent.
 */
export const SAMPLE_PATHS: OnboardingPath[] = [
  {
    ...samplePath("ui-ux-design-foundations", "ui-ux", "UI/UX Design Foundations", "beginner", 12),
    hours: 8,
    firstLessons: [
      { title: "What UX design is (and isn’t)", meta: "YouTube · 12 min" },
      { title: "Design thinking in practice", meta: "Article · 8 min" },
      { title: "Sketch your first wireframe", meta: "YouTube · 22 min" },
    ],
  },
  samplePath("product-design-essentials", "product", "Product Design Essentials", "beginner", 10),
  samplePath("brand-identity-basics", "brand", "Brand Identity Basics", "beginner", 9),
  samplePath("social-media-design", "social-media", "Social Media Design", "beginner", 8),
  samplePath("seo-for-designers", "seo", "SEO for Designers", "beginner", 7),
  samplePath("design-systems-101", "design-systems", "Design Systems 101", "intermediate", 11),
  samplePath("dev-handoff", "dev-handoff", "Dev Handoff", "intermediate", 6),
];

const FIRST_LESSON_COUNT = 3;

const ORIGIN_BY_FORMAT = { article: "Article", docs: "Docs", tool: "Tool" } as const;

/**
 * Published catalogue paths in onboarding shape. With none published, the design samples stand in
 * when `useSample` is on (default USE_SAMPLE_WHEN_EMPTY); otherwise the result is empty and the
 * flow ends at the dashboard instead of recommending nothing.
 */
export function buildOnboardingPaths(
  catalogue: Catalogue,
  useSample: boolean = USE_SAMPLE_WHEN_EMPTY,
): OnboardingPath[] {
  const resources = new Map(catalogue.resources.map((r) => [r.id, r]));
  const sources = new Map(catalogue.sources.map((s) => [s.slug, s.name]));
  const real = catalogue.paths
    .filter((path) => path.status === "published")
    .map((path): OnboardingPath => {
      const lessons = lessonsOf(catalogue, path.slug);
      const firstLessons = lessons.slice(0, FIRST_LESSON_COUNT).flatMap((lesson) => {
        const resource = resources.get(lesson.resourceId);
        if (!resource) return [];
        const origin =
          resource.format === "video"
            ? (sources.get(resource.sourceSlug) ?? "Video")
            : ORIGIN_BY_FORMAT[resource.format];
        return [{ title: resource.title, meta: `${origin} · ${resource.lengthMinutes} min` }];
      });
      return {
        slug: path.slug,
        topicSlug: path.topicSlug,
        title: path.title,
        level: path.level,
        lessons: lessons.length,
        hours: pathHours(catalogue, path.slug),
        firstLessons,
        sample: false,
      };
    });
  return real.length === 0 && useSample ? SAMPLE_PATHS : real;
}
