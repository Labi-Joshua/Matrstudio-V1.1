import type { TopicSlug } from "../catalogue/types";
import type { GoalId, LevelId } from "../pages/onboarding-content";
import { isRecord, type Me, orNull, request, stringArray } from "./api";

/**
 * Onboarding calls (packages/backend/AUTH.md, "Onboarding"). Same rules as api.ts: never throws,
 * never logs, resolves to an ApiResult. Answers are personal data: they are not logged anywhere.
 */

/** Any of the three answers; the API saves what is sent and leaves the rest as it was. */
export type OnboardingPatch = { goal?: GoalId; level?: LevelId; topics?: TopicSlug[] };

/** Exported for tests. Returns undefined when the payload is not a usable onboarding answer. */
export function parseOnboardingResponse(json: unknown): Me["onboarding"] | undefined {
  if (!isRecord(json) || !isRecord(json.onboarding)) return undefined;
  const o = json.onboarding;
  return {
    goal: orNull(o.goal),
    level: orNull(o.level),
    topics: stringArray(o.topics),
    completed: o.completed === true,
    completedAt: typeof o.completedAt === "string" ? o.completedAt : null,
  };
}

/**
 * POST /api/me/onboarding. Partial and idempotent: saving the same answer twice is harmless.
 * Failures to expect: unauthorized (signed out: go to sign in), invalid_request (a value the API
 * does not know), rate_limited, network_error.
 */
export function saveOnboarding(patch: OnboardingPatch, signal?: AbortSignal) {
  return request("POST", "/api/me/onboarding", { body: patch, signal }, parseOnboardingResponse);
}
