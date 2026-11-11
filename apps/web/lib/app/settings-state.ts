import type { ApiFailure } from "../auth/api";
import { formatWait } from "../auth/messages";
import type { Prefs, PrefsPatch } from "../auth/prefs-api";

/** Load state of one Settings resource (account, preferences, profile switch). */
export type Loaded<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; failure: ApiFailure };

/** Applies a partial patch to preferences without touching what it leaves out. */
export function applyPrefsPatch(prefs: Prefs, patch: PrefsPatch): Prefs {
  return {
    notifications: { ...prefs.notifications, ...patch.notifications },
    email: { ...prefs.email, ...patch.email },
    reminders: { ...prefs.reminders, ...patch.reminders },
    learning: { ...prefs.learning, ...patch.learning },
  };
}

/** The part of `before` that `patch` is about to change: what a rollback restores. */
export function inversePatch(before: Prefs, patch: PrefsPatch): PrefsPatch {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [group, values] of Object.entries(patch)) {
    const previous = before[group as keyof Prefs] as Record<string, unknown>;
    out[group] = Object.fromEntries(Object.keys(values ?? {}).map((k) => [k, previous[k]]));
  }
  return out as PrefsPatch;
}

/** Whether the choice of topics may be saved: the API needs at least one. */
export function canSaveTopics(topics: readonly string[]): boolean {
  return topics.length > 0;
}

export function toggleTopic(topics: readonly string[], id: string): string[] {
  return topics.includes(id) ? topics.filter((t) => t !== id) : [...topics, id];
}

export type SettingsToast = { tone: "success" | "error" | "info"; title: string; body?: string };

export const savedToast = (): SettingsToast => ({ tone: "success", title: "Saved" });

/** The toast for a setting that could not be saved (the control has already gone back). */
export function saveFailureToast(failure: ApiFailure): SettingsToast {
  if (failure.code === "rate_limited") {
    return {
      tone: "error",
      title: "Too many changes",
      body: failure.retryAfterSeconds
        ? `Try again in ${formatWait(failure.retryAfterSeconds)}.`
        : "Try again in a little while.",
    };
  }
  if (failure.code === "unauthorized") {
    return { tone: "error", title: "You’re signed out", body: "Sign in again to change settings." };
  }
  return {
    tone: "error",
    title: "Couldn’t save that",
    body:
      failure.code === "network_error"
        ? "Check your connection. Your setting went back to what it was."
        : "Your setting went back to what it was. Try again.",
  };
}
