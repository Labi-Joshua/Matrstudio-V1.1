import type { Level, TopicSlug } from "../catalogue/types";
import { isLevelId, LEVEL_IDS, type OnboardingAnswers } from "../pages/onboarding-content";

/**
 * Picks the learning path to recommend from the three onboarding answers. Pure: no catalogue, no
 * network, so it is tested on its own and works with whatever paths exist (including none).
 *
 * Order of importance, as asked: topic first, then level, then goal.
 * - A path "matches" when its topic is one the learner picked. No match means the flow shows all
 *   paths instead of recommending one.
 * - Among matches the nearest level wins (beginner for a beginner). When two paths are the same
 *   distance from the learner's level (one above, one below) the goal breaks the tie: people who
 *   want to grow or build get the harder one, people learning or switching get the easier one.
 * - Anything still tied goes to the topic the learner listed first, then to catalogue order.
 */
export type RecommendablePath = { topicSlug: TopicSlug; level: Level };

export type Recommendation<T> =
  /** At least one path covers a chosen topic: `path` is the best of them. */
  | { kind: "match"; path: T }
  /** Nothing covers a chosen topic. `closest` is the best fit by level and goal (null if no paths). */
  | { kind: "none"; closest: T | null };

const PREFERS_HARDER_GOALS: ReadonlySet<string> = new Set(["grow_in_role", "build_projects"]);

type Ranked<T> = {
  path: T;
  index: number;
  distance: number;
  goalPenalty: number;
  topicRank: number;
};

function rank<T extends RecommendablePath>(
  paths: readonly T[],
  answers: Pick<OnboardingAnswers, "goal" | "level" | "topics">,
): Ranked<T>[] {
  const wanted = isLevelId(answers.level) ? LEVEL_IDS.indexOf(answers.level) : null;
  const harder = answers.goal !== null && PREFERS_HARDER_GOALS.has(answers.goal);
  return paths.map((path, index) => {
    const offset = wanted === null ? 0 : LEVEL_IDS.indexOf(path.level) - wanted;
    const wrongWay = harder ? offset < 0 : offset > 0;
    const topicRank = answers.topics.indexOf(path.topicSlug);
    return {
      path,
      index,
      distance: Math.abs(offset),
      goalPenalty: wrongWay ? 1 : 0,
      topicRank: topicRank === -1 ? Number.POSITIVE_INFINITY : topicRank,
    };
  });
}

function byFit<T>(a: Ranked<T>, b: Ranked<T>): number {
  // Infinity - Infinity is NaN, so compare topic ranks explicitly.
  const topic = a.topicRank === b.topicRank ? 0 : a.topicRank < b.topicRank ? -1 : 1;
  return a.distance - b.distance || a.goalPenalty - b.goalPenalty || topic || a.index - b.index;
}

export function recommendPath<T extends RecommendablePath>(
  paths: readonly T[],
  answers: Pick<OnboardingAnswers, "goal" | "level" | "topics">,
): Recommendation<T> {
  const ranked = rank(paths, answers);
  const matches = ranked.filter((r) => Number.isFinite(r.topicRank)).sort(byFit);
  const best = matches[0];
  if (best) return { kind: "match", path: best.path };
  const closest = [...ranked].sort(byFit)[0];
  return { kind: "none", closest: closest ? closest.path : null };
}

/** The path to mark "Closest match" on the all-paths screen. */
export function closestPath<T extends RecommendablePath>(
  paths: readonly T[],
  answers: Pick<OnboardingAnswers, "goal" | "level" | "topics">,
): T | null {
  const result = recommendPath(paths, answers);
  return result.kind === "match" ? result.path : result.closest;
}
