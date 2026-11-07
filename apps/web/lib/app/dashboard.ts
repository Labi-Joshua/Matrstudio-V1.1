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

export type DashboardPath = OnboardingPath & { description: string | null };

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
): DashboardView {
  const answers = answersFromMe(onboarding);
  const all = buildOnboardingPaths(catalogue, useSample);
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
