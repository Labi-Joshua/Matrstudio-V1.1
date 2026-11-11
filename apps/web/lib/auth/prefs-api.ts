import { isRecord, request } from "./api";

/**
 * Typed client for the settings preferences (packages/backend/SETTINGS.md) and the profile
 * visibility switch (`/api/me/profile`, PROFILE.md). Same rules as lib/auth/api.ts: nothing
 * throws, every call resolves to an ApiResult, nothing logs.
 */
export const REMINDER_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type ReminderDay = (typeof REMINDER_DAYS)[number];
export const WEEKLY_GOAL_MIN = 1;
export const WEEKLY_GOAL_MAX = 14;

export type Prefs = {
  notifications: { submissions: boolean; lessons: boolean; helpReplies: boolean };
  email: { digest: boolean; reminders: boolean; news: boolean };
  reminders: { days: ReminderDay[]; time: string };
  learning: { weeklyGoal: number };
};

export type PrefsPatch = {
  notifications?: Partial<Prefs["notifications"]>;
  email?: Partial<Prefs["email"]>;
  reminders?: Partial<Prefs["reminders"]>;
  learning?: Partial<Prefs["learning"]>;
};

/** Exported for tests. Undefined when the payload is not a complete preferences object. */
export function parsePrefs(json: unknown): Prefs | undefined {
  const root = isRecord(json) && isRecord(json.prefs) ? json.prefs : undefined;
  if (!root) return undefined;
  const { notifications: n, email: e, reminders: r, learning: l } = root;
  if (!isRecord(n) || !isRecord(e) || !isRecord(r) || !isRecord(l)) return undefined;
  const flags = [n.submissions, n.lessons, n.helpReplies, e.digest, e.reminders, e.news];
  if (!flags.every((v): v is boolean => typeof v === "boolean")) return undefined;
  if (!Array.isArray(r.days) || typeof r.time !== "string") return undefined;
  if (typeof l.weeklyGoal !== "number" || !Number.isInteger(l.weeklyGoal)) return undefined;
  const days = REMINDER_DAYS.filter((d) => (r.days as unknown[]).includes(d));
  return {
    notifications: {
      submissions: n.submissions as boolean,
      lessons: n.lessons as boolean,
      helpReplies: n.helpReplies as boolean,
    },
    email: {
      digest: e.digest as boolean,
      reminders: e.reminders as boolean,
      news: e.news as boolean,
    },
    reminders: { days, time: r.time },
    learning: { weeklyGoal: l.weeklyGoal },
  };
}

export function getPrefs(signal?: AbortSignal) {
  return request("GET", "/api/me/prefs", { signal }, parsePrefs);
}

/** Partial and idempotent: only the fields sent change. 400 invalid_request, 429 rate_limited. */
export function patchPrefs(patch: PrefsPatch, signal?: AbortSignal) {
  return request("PATCH", "/api/me/prefs", { body: patch, signal }, parsePrefs);
}

/** Exported for tests: `{ profile: { isPublic } }` from the profile contract. */
export function parseIsPublic(json: unknown): boolean | undefined {
  if (!isRecord(json) || !isRecord(json.profile)) return undefined;
  return typeof json.profile.isPublic === "boolean" ? json.profile.isPublic : undefined;
}

export function getProfileIsPublic(signal?: AbortSignal) {
  return request("GET", "/api/me/profile", { signal }, parseIsPublic);
}

export function setProfileIsPublic(isPublic: boolean, signal?: AbortSignal) {
  return request("PATCH", "/api/me/profile", { body: { isPublic }, signal }, parseIsPublic);
}
