import {
  type ApiFailure,
  type ApiResult,
  isRecord,
  networkFailure,
  normaliseFailure,
  orNull,
  request,
  stringArray,
} from "./api";

/**
 * Typed client for profiles (packages/backend/PROFILE.md). Same rules as lib/auth/api.ts: nothing
 * throws, every call resolves to an ApiResult, nothing logs. All times are ISO 8601 strings.
 *
 * - GET    /api/me/profile -> {profile}. Created on first use, private.
 * - PATCH  /api/me/profile {displayName?, username?, bio?, isPublic?, visibility?} -> {profile}.
 *   409 (username taken) and 400 (invalid or reserved) carry fieldErrors.username.
 * - GET    /api/me/profile/username-check?u= -> {available, reason?}.
 * - PUT    /api/me/profile/avatar (the image as the body) -> {profile}. 413 too big, 400 not an image.
 * - DELETE /api/me/profile/avatar -> {profile}.
 * - GET    /api/profiles/{username} (no session) -> {profile}; 404 for private and unknown alike.
 */
export type ProfileVisibility = { stats: boolean; paths: boolean; submissions: boolean };

export type OwnProfile = {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  isPublic: boolean;
  visibility: ProfileVisibility;
  createdAt: string;
  updatedAt: string;
};

export type ProfileEdit = {
  displayName?: string;
  username?: string;
  bio?: string;
  isPublic?: boolean;
  visibility?: Partial<ProfileVisibility>;
};

export type UsernameCheck =
  | { available: true }
  | { available: false; reason: "invalid" | "reserved" | "taken" };

export type PublicSubmission = {
  title: string;
  url: string;
  topic: string | null;
  approvedAt: string | null;
};

export type PublicProfileStats = {
  pathsFinished: number;
  lessonsDone: number;
  minutesLearned: number;
  streakDays: number;
};

export type PublicProfile = {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  level: string | null;
  topics: string[];
  joinedAt: string;
  /** Null when the owner hides it, or when there is no progress data yet. */
  stats: PublicProfileStats | null;
  completedPaths: Array<{ slug: string; completedAt: string }> | null;
  submissions: PublicSubmission[] | null;
};

const isIso = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

/** Same-origin images only: the API sends /api/avatars/..., anything else is dropped. */
function safeAvatarUrl(v: unknown): string | null {
  return typeof v === "string" && v.startsWith("/api/avatars/") ? v : null;
}

/** Exported for tests. Undefined when the payload is not a usable profile. */
export function parseOwnProfile(json: unknown): OwnProfile | undefined {
  if (!isRecord(json)) return undefined;
  const { username, displayName, bio, createdAt, updatedAt } = json;
  if (typeof username !== "string" || username === "") return undefined;
  if (typeof displayName !== "string" || typeof bio !== "string") return undefined;
  if (!isIso(createdAt) || !isIso(updatedAt)) return undefined;
  const v = isRecord(json.visibility) ? json.visibility : {};
  return {
    username,
    displayName,
    bio,
    avatarUrl: safeAvatarUrl(json.avatarUrl),
    isPublic: json.isPublic === true,
    visibility: {
      stats: bool(v.stats, true),
      paths: bool(v.paths, true),
      submissions: bool(v.submissions, true),
    },
    createdAt,
    updatedAt,
  };
}

const parseOwn = (json: unknown) => (isRecord(json) ? parseOwnProfile(json.profile) : undefined);

/** Exported for tests. */
export function parseUsernameCheck(json: unknown): UsernameCheck | undefined {
  if (!isRecord(json) || typeof json.available !== "boolean") return undefined;
  if (json.available) return { available: true };
  const reason = json.reason === "reserved" || json.reason === "taken" ? json.reason : "invalid";
  return { available: false, reason };
}

function parseSubmissions(v: unknown): PublicSubmission[] | null {
  if (!Array.isArray(v)) return null;
  return v.flatMap((row) => {
    if (!isRecord(row) || typeof row.title !== "string" || typeof row.url !== "string") return [];
    // Only web links: the URL becomes a link on a public page.
    if (!/^https?:\/\//i.test(row.url)) return [];
    return [
      {
        title: row.title,
        url: row.url,
        topic: orNull(row.topic),
        approvedAt: isIso(row.approvedAt) ? row.approvedAt : null,
      },
    ];
  });
}

function parseStats(v: unknown): PublicProfileStats | null {
  if (!isRecord(v)) return null;
  return {
    pathsFinished: count(v.pathsFinished),
    lessonsDone: count(v.lessonsDone),
    minutesLearned: count(v.minutesLearned),
    streakDays: count(v.streakDays),
  };
}

/** Exported for tests. */
export function parsePublicProfile(json: unknown): PublicProfile | undefined {
  if (!isRecord(json)) return undefined;
  const { username, displayName, bio, joinedAt } = json;
  if (typeof username !== "string" || typeof displayName !== "string") return undefined;
  if (typeof bio !== "string" || !isIso(joinedAt)) return undefined;
  const paths = Array.isArray(json.completedPaths)
    ? json.completedPaths.flatMap((p) =>
        isRecord(p) && typeof p.slug === "string" && isIso(p.completedAt)
          ? [{ slug: p.slug, completedAt: p.completedAt }]
          : [],
      )
    : null;
  return {
    username,
    displayName,
    bio,
    avatarUrl: safeAvatarUrl(json.avatarUrl),
    level: orNull(json.level),
    topics: stringArray(json.topics),
    joinedAt,
    stats: parseStats(json.stats),
    completedPaths: paths,
    submissions: parseSubmissions(json.submissions),
  };
}

const parsePublic = (json: unknown) =>
  isRecord(json) ? parsePublicProfile(json.profile) : undefined;

export function getOwnProfile(signal?: AbortSignal) {
  return request("GET", "/api/me/profile", { signal }, parseOwn);
}

export function updateProfile(edit: ProfileEdit, signal?: AbortSignal) {
  return request("PATCH", "/api/me/profile", { body: edit, signal }, parseOwn);
}

export function checkUsername(username: string, signal?: AbortSignal) {
  return request(
    "GET",
    `/api/me/profile/username-check?u=${encodeURIComponent(username)}`,
    { signal },
    parseUsernameCheck,
  );
}

export function removeAvatar(signal?: AbortSignal) {
  return request("DELETE", "/api/me/profile/avatar", { signal }, parseOwn);
}

/** The body is the resized image itself (lib/app/profile-avatar.ts), not JSON. */
export async function uploadAvatar(
  image: Blob,
  signal?: AbortSignal,
): Promise<ApiResult<OwnProfile>> {
  let response: Response;
  try {
    response = await fetch("/api/me/profile/avatar", {
      method: "PUT",
      credentials: "include",
      cache: "no-store",
      headers: { accept: "application/json", "content-type": image.type || "image/webp" },
      body: image,
      signal,
    });
  } catch {
    return networkFailure();
  }
  let json: unknown;
  try {
    const text = await response.text();
    json = text ? JSON.parse(text) : null;
  } catch {
    json = undefined;
  }
  if (!response.ok) {
    return normaliseFailure(response.status, json, response.headers.get("retry-after"));
  }
  const profile = parseOwn(json);
  return profile
    ? { ok: true, data: profile }
    : ({
        ok: false,
        code: "invalid_response",
        message: "Matr Studio sent a reply we couldn’t read.",
        status: response.status,
      } satisfies ApiFailure);
}

/** Public page data. 404 (private or unknown, deliberately the same) arrives as code not_found. */
export function getPublicProfile(username: string, signal?: AbortSignal) {
  return request("GET", `/api/profiles/${encodeURIComponent(username)}`, { signal }, parsePublic);
}
