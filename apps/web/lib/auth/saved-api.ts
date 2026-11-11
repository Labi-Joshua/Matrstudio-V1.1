import { isRecord, request } from "./api";

/**
 * Typed client for the learner's saved resources (packages/backend/SAVED.md). Same rules as the
 * rest of lib/auth/api.ts: nothing throws, every call resolves to an ApiResult, nothing logs.
 *
 * - GET    /api/me/saved -> {saved: [{resourceId, savedAt}]}, newest first.
 * - PUT    /api/me/saved/{id} -> {saved: {resourceId, savedAt}}. Idempotent. 409 saved_limit past 500,
 *   400 invalid_request for a bad id, 429 rate_limited (retryAfterSeconds).
 * - DELETE /api/me/saved/{id} -> {removed: true}. Idempotent.
 */
export type SavedResource = {
  resourceId: string;
  /** Unix seconds. */
  savedAt: number;
};

/** Exported for tests. Undefined when the payload is not a usable saved row. */
export function parseSavedResource(json: unknown): SavedResource | undefined {
  if (!isRecord(json)) return undefined;
  const { resourceId, savedAt } = json;
  if (typeof resourceId !== "string" || resourceId === "") return undefined;
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return undefined;
  return { resourceId, savedAt };
}

/** Exported for tests. Rows that cannot be read are dropped; an answer without a list is invalid. */
export function parseSavedList(json: unknown): SavedResource[] | undefined {
  if (!isRecord(json) || !Array.isArray(json.saved)) return undefined;
  return json.saved.flatMap((row) => {
    const parsed = parseSavedResource(row);
    return parsed ? [parsed] : [];
  });
}

const parseOne = (json: unknown) => (isRecord(json) ? parseSavedResource(json.saved) : undefined);
const parseRemoved = (json: unknown) =>
  isRecord(json) && json.removed === true ? (true as const) : undefined;

const savedPath = (resourceId: string) => `/api/me/saved/${encodeURIComponent(resourceId)}`;

export function listSaved(signal?: AbortSignal) {
  return request("GET", "/api/me/saved", { signal }, parseSavedList);
}

export function saveResource(resourceId: string, signal?: AbortSignal) {
  return request("PUT", savedPath(resourceId), { signal }, parseOne);
}

export function unsaveResource(resourceId: string, signal?: AbortSignal) {
  return request("DELETE", savedPath(resourceId), { signal }, parseRemoved);
}
