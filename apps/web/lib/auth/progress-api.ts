import { isRecord, request } from "./api";

/**
 * Typed client for path progress (packages/backend/PROGRESS.md). Same rules as the rest of
 * lib/auth/api.ts: nothing throws, every call resolves to an ApiResult, nothing logs. Times are
 * ISO 8601 strings, kept as sent.
 *
 * - GET    /api/me/paths -> {paths: PathProgress[]}, most recent activity first.
 * - POST   /api/me/paths/{slug}/start -> {path}. Idempotent.
 * - PUT    /api/me/paths/{slug}/lessons/{lessonId} body {total} -> {path}. Marks a lesson done.
 * - DELETE /api/me/paths/{slug}/lessons/{lessonId} -> {path}. Undo.
 * - PUT / DELETE /api/me/paths/{slug}/star -> {path}. Idempotent.
 * Errors: 400 invalid_request, 409 path_limit, 429 rate_limited (retryAfterSeconds).
 */
export type PathProgress = {
  slug: string;
  startedAt: string | null;
  lastActivityAt: string | null;
  completedAt: string | null;
  starredAt: string | null;
  completedLessonIds: string[];
};

const time = (v: unknown): string | null =>
  typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null;

/** Exported for tests. Undefined when the payload is not a usable path row. */
export function parsePathProgress(json: unknown): PathProgress | undefined {
  if (!isRecord(json)) return undefined;
  const { slug, completedLessonIds } = json;
  if (typeof slug !== "string" || slug === "") return undefined;
  if (!Array.isArray(completedLessonIds)) return undefined;
  return {
    slug,
    startedAt: time(json.startedAt),
    lastActivityAt: time(json.lastActivityAt),
    completedAt: time(json.completedAt),
    starredAt: time(json.starredAt),
    completedLessonIds: completedLessonIds.filter(
      (id): id is string => typeof id === "string" && id !== "",
    ),
  };
}

/** Exported for tests. Rows that cannot be read are dropped; an answer without a list is invalid. */
export function parsePathList(json: unknown): PathProgress[] | undefined {
  if (!isRecord(json) || !Array.isArray(json.paths)) return undefined;
  return json.paths.flatMap((row) => {
    const parsed = parsePathProgress(row);
    return parsed ? [parsed] : [];
  });
}

const parseOne = (json: unknown) => (isRecord(json) ? parsePathProgress(json.path) : undefined);

const base = (slug: string) => `/api/me/paths/${encodeURIComponent(slug)}`;
const lessonUrl = (slug: string, lessonId: string) =>
  `${base(slug)}/lessons/${encodeURIComponent(lessonId)}`;

export function listPaths(signal?: AbortSignal) {
  return request("GET", "/api/me/paths", { signal }, parsePathList);
}

export function startPath(slug: string, signal?: AbortSignal) {
  return request("POST", `${base(slug)}/start`, { signal }, parseOne);
}

/** `total` is the number of lessons in the path: the catalogue lives in the client. */
export function markLessonDone(
  slug: string,
  lessonId: string,
  total: number,
  signal?: AbortSignal,
) {
  return request("PUT", lessonUrl(slug, lessonId), { body: { total }, signal }, parseOne);
}

export function undoLessonDone(slug: string, lessonId: string, signal?: AbortSignal) {
  return request("DELETE", lessonUrl(slug, lessonId), { signal }, parseOne);
}

export function starPath(slug: string, signal?: AbortSignal) {
  return request("PUT", `${base(slug)}/star`, { signal }, parseOne);
}

export function unstarPath(slug: string, signal?: AbortSignal) {
  return request("DELETE", `${base(slug)}/star`, { signal }, parseOne);
}
