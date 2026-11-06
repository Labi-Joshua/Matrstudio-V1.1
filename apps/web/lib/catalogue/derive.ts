import type { Catalogue, Level, Source, TopicSlug, TopicStats } from "./types";

// Every number on the landing page comes from these functions. Nothing is typed into the UI:
// paths, lessons, hours and the source strip are all derived from the catalogue (AGENTS.md §7).

const LEVEL_ORDER: Level[] = ["beginner", "intermediate", "advanced"];

/** Only published paths count; drafts and archived paths are not shown to visitors. */
const publishedPaths = (catalogue: Catalogue) =>
  catalogue.paths.filter((path) => path.status === "published");

/** Lessons in a path, in order. */
export function lessonsOf(catalogue: Catalogue, pathSlug: string) {
  return catalogue.pathLessons
    .filter((lesson) => lesson.pathSlug === pathSlug)
    .sort((a, b) => a.position - b.position);
}

const toHours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

/** Total length of a path's lessons in minutes (the exact figure; hours are rounded from it). */
function pathMinutes(catalogue: Catalogue, pathSlug: string): number {
  const byId = new Map(catalogue.resources.map((resource) => [resource.id, resource]));
  return lessonsOf(catalogue, pathSlug).reduce(
    (total, lesson) => total + (byId.get(lesson.resourceId)?.lengthMinutes ?? 0),
    0,
  );
}

/** Total length of a path's lessons in hours, to one decimal place. */
export function pathHours(catalogue: Catalogue, pathSlug: string): number {
  return toHours(pathMinutes(catalogue, pathSlug));
}

/** Stat chips for one topic's panel. Sums exact minutes and rounds once, so rounding never compounds. */
export function topicStats(catalogue: Catalogue, topic: TopicSlug): TopicStats {
  const paths = publishedPaths(catalogue).filter((path) => path.topicSlug === topic);
  const lessons = paths.reduce((total, path) => total + lessonsOf(catalogue, path.slug).length, 0);
  const minutes = paths.reduce((total, path) => total + pathMinutes(catalogue, path.slug), 0);
  const levels = LEVEL_ORDER.filter((level) => paths.some((path) => path.level === level));
  return { paths: paths.length, lessons, hours: toHours(minutes), levels };
}

/**
 * Sources for the strip under the hero, most resources first. Only live resources count; sources
 * with equal counts keep their catalogue order, so the strip never reshuffles between builds.
 */
export function sourcesByResourceCount(catalogue: Catalogue): Source[] {
  const counts = new Map<string, number>();
  for (const resource of catalogue.resources) {
    if (resource.status === "live") {
      counts.set(resource.sourceSlug, (counts.get(resource.sourceSlug) ?? 0) + 1);
    }
  }
  return catalogue.sources
    .map((source, index) => ({ source, index, count: counts.get(source.slug) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map(({ source }) => source);
}
