import type { PathProgress } from "../auth/progress-api";
import type { Submission } from "../auth/submissions-api";
import type { Catalogue } from "../catalogue/types";
import type { BrowsePath } from "../pages/browse-paths";
import { USE_SAMPLE_WHEN_EMPTY } from "../pages/topic-content";
import type { DashboardPath, HomeProgress, ProgressPath } from "./dashboard";
import { getCatalogueData, pathHref } from "./paths-catalogue";
import { buildPathDetail, type DetailLesson } from "./paths-detail";
import { lessonHref } from "./paths-lessons";
import { doneCount, isCompleted, isStarted, resumeTarget } from "./progress-logic";
import { sortSubmissions } from "./submit-state";

/**
 * What the Home dashboard learns from the learner's path progress (GET /api/me/paths, lib/app/
 * progress-logic.ts) and the catalogue: the paths on the go with their resume target, the path
 * finished most recently, and how long since each was touched. Pure, so the layouts can be
 * tested without a browser. A path that has left the catalogue is skipped without a word.
 */
const DAY_MS = 86_400_000;
const FORMAT = { video: "Video", article: "Article", tool: "Tool" } as const;

/** Whole days from `iso` to `now` (never negative); 0 for a time that cannot be read. */
export function daysSince(iso: string | null, now: number): number {
  const then = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(then) ? 0 : Math.max(0, Math.floor((now - then) / DAY_MS));
}

function toProgressPath(
  catalogue: Catalogue,
  path: BrowsePath,
  all: readonly BrowsePath[],
  entry: PathProgress,
  sample: boolean,
  now: number,
  useSample: boolean,
): ProgressPath {
  const lessons: DetailLesson[] =
    buildPathDetail(catalogue, path.topicSlug, path.slug, useSample)?.lessons ?? [];
  const target = resumeTarget(lessons, entry);
  const lastId = entry.completedLessonIds[entry.completedLessonIds.length - 1];
  const lastIndex = lessons.findIndex((l) => l.id === lastId);
  const lastLesson = lessons[lastIndex];
  return {
    slug: path.slug,
    topicSlug: path.topicSlug,
    title: path.title,
    level: path.level,
    lessons: path.lessons,
    hours: path.hours,
    firstLessons: [],
    sample,
    description: path.description,
    href: pathHref(path, all),
    lessonsDone: doneCount(entry, path.lessons),
    next: target
      ? {
          number: target.number,
          title: target.lesson.title,
          format: FORMAT[target.lesson.kind],
          minutes: target.lesson.minutes,
          href: lessonHref(path.topicSlug, path.slug, target.lesson.id),
        }
      : null,
    lastDone: lastLesson ? { number: lastIndex + 1, title: lastLesson.title } : null,
    lastActiveDays: daysSince(entry.lastActivityAt ?? entry.startedAt, now),
  };
}

export function buildHomeProgress(input: {
  entries: readonly PathProgress[];
  catalogue: Catalogue;
  /** Paths to suggest next (already without the ones the learner has). */
  recommended: DashboardPath[];
  now: number;
  useSample?: boolean;
}): HomeProgress {
  const { entries, catalogue, recommended, now, useSample = USE_SAMPLE_WHEN_EMPTY } = input;
  const data = getCatalogueData(catalogue, useSample);
  const bySlug = new Map(data.paths.map((p) => [p.slug, p]));
  const build = (entry: PathProgress): ProgressPath | null => {
    const path = bySlug.get(entry.slug);
    return path
      ? toProgressPath(catalogue, path, data.paths, entry, data.sample, now, useSample)
      : null;
  };

  const started = entries
    .filter((e) => isStarted(e) && !isCompleted(e))
    .sort((a, b) => lastTouched(b) - lastTouched(a))
    .flatMap((e) => build(e) ?? []);

  const latest = entries
    .filter(isCompleted)
    .filter((e) => bySlug.has(e.slug))
    .sort((a, b) => Date.parse(b.completedAt ?? "") - Date.parse(a.completedAt ?? ""))[0];
  const finishedPath = latest ? build(latest) : null;

  return {
    started,
    finished:
      latest && finishedPath
        ? { path: finishedPath, daysAgo: daysSince(latest.completedAt, now) }
        : null,
    recommended,
    away: [],
  };
}

const lastTouched = (e: PathProgress) => Date.parse(e.lastActivityAt ?? e.startedAt ?? "") || 0;

/** Slugs of every path the learner started or finished: not recommended again. */
export function ownedSlugs(entries: readonly PathProgress[]): Set<string> {
  return new Set(entries.filter((e) => isStarted(e) || isCompleted(e)).map((e) => e.slug));
}

/** The newest `limit` submissions for Home. */
export function recentSubmissions(rows: readonly Submission[], limit = 4): Submission[] {
  return sortSubmissions(rows).slice(0, limit);
}
