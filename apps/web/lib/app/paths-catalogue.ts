import { recommendPath } from "../auth/recommend-path";
import type { Catalogue, Level, TopicSlug } from "../catalogue/types";
import { type BrowseResource, filterOf, TYPE_LABEL } from "../pages/browse-library";
import { type BrowsePath, getBrowsePaths } from "../pages/browse-paths";
import {
  type GoalId,
  goalLabel,
  isGoalId,
  isLevelId,
  isTopicId,
  type LevelId,
  levelLabel,
  topicsLabel,
} from "../pages/onboarding-content";
import { USE_SAMPLE_WHEN_EMPTY } from "../pages/topic-content";
import { ROUTES } from "../routes";

/**
 * The in-app Paths catalogue (Figma "Learning Paths", frames 1 to 4): which paths show, how the
 * topic and level filters and the ?q= search narrow them, and the copy of each state. Pure and
 * empty-safe: with no paths every function returns an empty list and the screen shows its
 * "on their way" state.
 *
 * Until the catalogue has published paths the design sample paths stand in (the same eight cards
 * the public /paths page shows), flagged `sample` so the screen can tag them.
 */

export const LEVELS: readonly Level[] = ["beginner", "intermediate", "advanced"];
export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export type TopicFilter = "all" | TopicSlug;
export type LevelFilter = "all" | Level;
export type Filters = { topic: TopicFilter; level: LevelFilter };
export const NO_FILTERS: Filters = { topic: "all", level: "all" };

export const hasFilters = (filters: Filters) => filters.topic !== "all" || filters.level !== "all";

export type CatalogueData = {
  paths: BrowsePath[];
  /** True when the paths are the Figma design samples (empty catalogue). */
  sample: boolean;
};

/** Published catalogue paths; the design samples while there are none and `useSample` is on. */
export function getCatalogueData(
  catalogue: Catalogue,
  useSample: boolean = USE_SAMPLE_WHEN_EMPTY,
): CatalogueData {
  const { paths, isSample } = getBrowsePaths(catalogue);
  if (isSample && !useSample) return { paths: [], sample: false };
  return { paths, sample: isSample };
}

export const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
export const pathCount = (n: number) => `${n} ${plural(n, "path", "paths")}`;

export function filterPaths(paths: readonly BrowsePath[], filters: Filters): BrowsePath[] {
  return paths.filter(
    (path) =>
      (filters.topic === "all" || path.topicSlug === filters.topic) &&
      (filters.level === "all" || path.level === filters.level),
  );
}

/** Topics that actually have a path, so a chip never leads to an empty page by design. */
export function topicsWithPaths(paths: readonly BrowsePath[]): Set<TopicSlug> {
  return new Set(paths.map((path) => path.topicSlug));
}

// ---------------------------------------------------------------------------------------------
// Search (?q=)
// ---------------------------------------------------------------------------------------------

/** Trim, collapse whitespace and cap the length; null when nothing is left to search for. */
export function normaliseQuery(raw: string | null | undefined): string | null {
  const text = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
  return text ? text : null;
}

const fold = (text: string) => text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Every word of the query must appear somewhere in the haystack (order does not matter). */
export function matchesQuery(haystack: string, query: string): boolean {
  const text = fold(haystack);
  return fold(query)
    .split(" ")
    .filter(Boolean)
    .every((word) => text.includes(word));
}

export function searchPaths(
  paths: readonly BrowsePath[],
  query: string,
  topicName: (slug: TopicSlug) => string,
): BrowsePath[] {
  return paths.filter((path) =>
    matchesQuery(
      [path.title, path.description, topicName(path.topicSlug), LEVEL_LABEL[path.level]].join(" "),
      query,
    ),
  );
}

export function searchResources(
  resources: readonly BrowseResource[],
  query: string,
): BrowseResource[] {
  return resources.filter((resource) =>
    matchesQuery(
      [
        resource.title,
        resource.sourceName,
        resource.topicName,
        TYPE_LABEL[filterOf(resource.format)],
      ].join(" "),
      query,
    ),
  );
}

export type ResultType = "all" | "paths" | "resources";

export type SearchView = {
  query: string;
  paths: BrowsePath[];
  resources: BrowseResource[];
  total: number;
  /** "2 paths and 5 resources" */
  summary: string;
};

export function buildSearchView(
  query: string,
  paths: readonly BrowsePath[],
  resources: readonly BrowseResource[],
  topicName: (slug: TopicSlug) => string,
): SearchView {
  const foundPaths = searchPaths(paths, query, topicName);
  const foundResources = searchResources(resources, query);
  return {
    query,
    paths: foundPaths,
    resources: foundResources,
    total: foundPaths.length + foundResources.length,
    summary: `${pathCount(foundPaths.length)} and ${foundResources.length} ${plural(foundResources.length, "resource", "resources")}`,
  };
}

/** Which sections the "Result type" chips show; a type with no results falls back to all. */
export function visibleSections(
  view: Pick<SearchView, "paths" | "resources">,
  type: ResultType,
): { paths: boolean; resources: boolean } {
  const paths = view.paths.length > 0 && type !== "resources";
  const resources = view.resources.length > 0 && type !== "paths";
  return { paths, resources };
}

// ---------------------------------------------------------------------------------------------
// "Filters match nothing" copy
// ---------------------------------------------------------------------------------------------

export type EmptyFiltersCopy = {
  title: string;
  body: string;
  /** Buttons, in order; the last one is the primary. */
  actions: { id: "clear" | "all-levels" | "all-topics"; label: string }[];
};

/**
 * "There’s no advanced Dev handoff path yet. Try another level, or clear the filters." for both
 * filters; one-filter variants say the same about just that filter.
 */
export function emptyFiltersCopy(filters: Filters, topicName: string | null): EmptyFiltersCopy {
  const level = filters.level === "all" ? null : filters.level;
  const topic = filters.topic === "all" ? null : (topicName ?? "this topic");
  const title = "No paths match these filters";
  if (level && topic) {
    return {
      title,
      body: `There’s no ${level} ${topic} path yet. Try another level, or clear the filters.`,
      actions: [
        { id: "clear", label: "Clear filters" },
        { id: "all-levels", label: "Show all levels" },
      ],
    };
  }
  if (level) {
    return {
      title,
      body: `There’s no ${level} path yet. Try another level.`,
      actions: [{ id: "all-levels", label: "Show all levels" }],
    };
  }
  return {
    title,
    body: `There’s no ${topic ?? "matching"} path yet. Try another topic.`,
    actions: [{ id: "all-topics", label: "Show all topics" }],
  };
}

// ---------------------------------------------------------------------------------------------
// "Start here" banner (Figma "Picked for you")
// ---------------------------------------------------------------------------------------------

export type PickedBanner = { path: BrowsePath; title: string; summary: string };

type OnboardingLike = { goal: string | null; level: string | null; topics: readonly string[] };

/**
 * The one path to highlight above the grid, from the onboarding answers (lib/auth/recommend-path
 * ranks them). Only shown when the learner picked a topic that has a path: otherwise there is
 * nothing honest to say, and the banner is left out.
 */
export function pickedBanner(
  paths: readonly BrowsePath[],
  onboarding: OnboardingLike,
): PickedBanner | null {
  const topics = onboarding.topics.filter(isTopicId);
  if (topics.length === 0) return null;
  const goal: GoalId | null = isGoalId(onboarding.goal) ? onboarding.goal : null;
  const level: LevelId | null = isLevelId(onboarding.level) ? onboarding.level : null;
  const result = recommendPath(paths, { goal, level, topics });
  if (result.kind !== "match") return null;
  const { path } = result;
  const answers = [
    goalLabel(goal)?.toLowerCase(),
    levelLabel(level)?.toLowerCase(),
    topicsLabel(topics),
  ].filter(Boolean);
  const size = `${path.lessons} ${plural(path.lessons, "lesson", "lessons")}, about ${path.hours} hrs.`;
  return {
    path,
    title: `Start here: ${path.title}`,
    summary: `Picked from your onboarding answers: ${answers.join(", ")}. ${size}`,
  };
}

// ---------------------------------------------------------------------------------------------
// Links between the catalogue and the path detail
// ---------------------------------------------------------------------------------------------

/**
 * The detail route is per topic (/learn/paths/{topic}). A topic with more than one path (UI/UX
 * has two) names the path in ?path=; the topic's first path needs no query.
 */
export function pathHref(path: BrowsePath, all: readonly BrowsePath[]): string {
  const inTopic = all.filter((p) => p.topicSlug === path.topicSlug);
  const base = ROUTES.app.pathTopic(path.topicSlug);
  return inTopic.length > 1 && inTopic[0]?.slug !== path.slug
    ? `${base}?path=${encodeURIComponent(path.slug)}`
    : base;
}
