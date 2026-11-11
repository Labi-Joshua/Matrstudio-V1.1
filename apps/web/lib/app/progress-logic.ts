import type { PathProgress } from "../auth/progress-api";
import type { BrowsePath } from "../pages/browse-paths";
import { plural } from "./paths-catalogue";
import type { MyPath } from "./paths-state";

/**
 * Pure logic of path progress (packages/backend/PROGRESS.md): percent, the resume target, the next
 * lesson, completion, ordering, the optimistic changes the provider applies before the API
 * answers, and the one-line progress texts the sidebar, cards and path page show. Lessons are
 * passed as ids in path order; the catalogue lives in the client.
 */

export type LessonRef = { id: string };

const DAY_MS = 86_400_000;

export const percent = (done: number, total: number) =>
  total > 0 ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : 0;

/** Lessons done, never more than the path has (stale ids from an older catalogue do not count). */
export const doneCount = (entry: PathProgress | undefined, total: number) =>
  Math.min(entry?.completedLessonIds.length ?? 0, total);

export const isStarted = (entry: PathProgress | undefined): entry is PathProgress =>
  entry?.startedAt != null;

export const isCompleted = (entry: PathProgress | undefined) => entry?.completedAt != null;

export const isLessonDone = (entry: PathProgress | undefined, lessonId: string) =>
  entry?.completedLessonIds.includes(lessonId) ?? false;

/** The lesson "Continue" opens: the first one not done, in path order. Null when none is left. */
export function resumeTarget<T extends LessonRef>(
  lessons: readonly T[],
  entry: PathProgress | undefined,
): { lesson: T; number: number } | null {
  const index = lessons.findIndex((l) => !isLessonDone(entry, l.id));
  const lesson = lessons[index];
  return lesson ? { lesson, number: index + 1 } : null;
}

/** The lesson after `currentId` in path order (the Next button); null on the last one. */
export function nextLesson<T extends LessonRef>(
  lessons: readonly T[],
  currentId: string,
): { lesson: T; number: number } | null {
  const index = lessons.findIndex((l) => l.id === currentId);
  const lesson = index >= 0 ? lessons[index + 1] : undefined;
  return lesson ? { lesson, number: index + 2 } : null;
}

export function previousLesson<T extends LessonRef>(
  lessons: readonly T[],
  currentId: string,
): { lesson: T; number: number } | null {
  const index = lessons.findIndex((l) => l.id === currentId);
  const lesson = index > 0 ? lessons[index - 1] : undefined;
  return lesson ? { lesson, number: index } : null;
}

/** "Up next" after finishing a lesson: the first one not done after it, else the first not done. */
export function upNext<T extends LessonRef>(
  lessons: readonly T[],
  currentId: string,
  entry: PathProgress | undefined,
): { lesson: T; number: number } | null {
  const at = lessons.findIndex((l) => l.id === currentId);
  const after = lessons.findIndex((l, i) => i > at && !isLessonDone(entry, l.id));
  const index = after >= 0 ? after : lessons.findIndex((l) => !isLessonDone(entry, l.id));
  const lesson = lessons[index];
  return lesson ? { lesson, number: index + 1 } : null;
}

/** Most recent activity first (a star alone counts as activity), ties by slug. */
export function sortEntries(entries: readonly PathProgress[]): PathProgress[] {
  const key = (e: PathProgress) => Date.parse(e.lastActivityAt ?? e.starredAt ?? "") || 0;
  return [...entries].sort((a, b) => key(b) - key(a) || a.slug.localeCompare(b.slug));
}

/** An entry for a path nothing has happened to yet. */
export const emptyEntry = (slug: string): PathProgress => ({
  slug,
  startedAt: null,
  lastActivityAt: null,
  completedAt: null,
  starredAt: null,
  completedLessonIds: [],
});

/** An entry that records nothing is dropped from the list (the server does the same). */
export const isBlank = (e: PathProgress) =>
  e.startedAt === null && e.starredAt === null && e.completedLessonIds.length === 0;

// ---------------------------------------------------------------------------------------------
// Optimistic changes: what the screen shows before the API answers. The API's answer replaces them.
// ---------------------------------------------------------------------------------------------

export function withStart(entry: PathProgress | undefined, slug: string, now: string) {
  const e = entry ?? emptyEntry(slug);
  return { ...e, startedAt: e.startedAt ?? now, lastActivityAt: now };
}

export function withLessonDone(
  entry: PathProgress | undefined,
  slug: string,
  lessonId: string,
  total: number,
  now: string,
): PathProgress {
  const e = withStart(entry, slug, now);
  const ids = e.completedLessonIds.includes(lessonId)
    ? e.completedLessonIds
    : [...e.completedLessonIds, lessonId];
  return {
    ...e,
    completedLessonIds: ids,
    completedAt: e.completedAt ?? (ids.length >= total ? now : null),
  };
}

export function withLessonUndone(
  entry: PathProgress | undefined,
  lessonId: string,
  now: string,
): PathProgress | undefined {
  if (!entry?.completedLessonIds.includes(lessonId)) return entry;
  return {
    ...entry,
    completedLessonIds: entry.completedLessonIds.filter((id) => id !== lessonId),
    completedAt: null,
    lastActivityAt: now,
  };
}

export function withStar(
  entry: PathProgress | undefined,
  slug: string,
  starred: boolean,
  now: string,
): PathProgress | undefined {
  const e = entry ?? emptyEntry(slug);
  const next = { ...e, starredAt: starred ? (e.starredAt ?? now) : null };
  return isBlank(next) ? undefined : next;
}

// ---------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------

/** "today", "yesterday", "3 days ago", "2 weeks ago", "5 months ago" (null for a bad time). */
export function ago(iso: string | null, now: number): string | null {
  const then = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(then)) return null;
  const days = Math.max(0, Math.floor((now - then) / DAY_MS));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/** Whole days between starting and finishing: "12 days", "1 day", "under a day". */
export function finishedIn(entry: PathProgress): string | null {
  const from = Date.parse(entry.startedAt ?? "");
  const to = Date.parse(entry.completedAt ?? "");
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  const days = Math.max(0, Math.round((to - from) / DAY_MS));
  return days === 0 ? "under a day" : `${days} ${plural(days, "day", "days")}`;
}

export const lessonsDoneText = (done: number, total: number) =>
  `${done} of ${total} ${plural(total, "lesson", "lessons")} done`;

/** The line next to the path page buttons, per state (Figma "Path started", "resume", "completed"). */
export function pathStatusLine(
  entry: PathProgress | undefined,
  total: number,
  now: number,
): string | null {
  if (!entry || !isStarted(entry)) return null;
  const done = doneCount(entry, total);
  if (isCompleted(entry)) {
    const took = finishedIn(entry);
    const when = took
      ? took === "under a day"
        ? " in under a day"
        : ` ${took} after starting`
      : "";
    return `Completed${when} · ${lessonsDoneText(done, total)}`;
  }
  if (done === 0) {
    return `Started ${ago(entry.startedAt, now) ?? "today"} · ${lessonsDoneText(done, total)}`;
  }
  const last = ago(entry.lastActivityAt, now);
  return `${lessonsDoneText(done, total)}${last ? ` · last active ${last}` : ""}`;
}

/** Sidebar line under a path name: "Lesson 3 of 12 · 25%", "Starred · not started", "Completed". */
export function sidebarLine(entry: PathProgress, total: number): string {
  if (isCompleted(entry)) return "Completed";
  if (!isStarted(entry)) return "Starred · not started";
  const done = doneCount(entry, total);
  return `Lesson ${Math.min(done + 1, total)} of ${total} · ${percent(done, total)}%`;
}

// ---------------------------------------------------------------------------------------------
// My paths
// ---------------------------------------------------------------------------------------------

/** The entries as My paths cards; a path that left the catalogue is skipped without a word. */
export function buildMine(
  entries: readonly PathProgress[],
  paths: readonly BrowsePath[],
): MyPath[] {
  const bySlug = new Map(paths.map((p) => [p.slug, p]));
  return sortEntries(entries).flatMap((entry) => {
    const path = bySlug.get(entry.slug);
    if (!path) return [];
    return [
      {
        path,
        starred: entry.starredAt !== null,
        done: isStarted(entry) ? doneCount(entry, path.lessons) : null,
        completed: isCompleted(entry),
      },
    ];
  });
}
