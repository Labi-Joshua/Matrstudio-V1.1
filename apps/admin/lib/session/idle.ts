import type { AdminMe } from "./types";

/** Fresh-auth window of the API (ADMIN_FRESH_AUTH_SECONDS) and the margin we keep to be safe. */
export const FRESH_AUTH_SECONDS = 300;
export const FRESH_AUTH_MARGIN_SECONDS = 10;

/** Warn this long before the idle timeout. */
export const WARN_SECONDS = 120;
/** Someone who acted in the last 5 minutes keeps their session alive without a prompt. */
export const ACTIVE_WINDOW_SECONDS = 300;

export type IdleState =
  | { kind: "ok" }
  | { kind: "refresh" }
  | { kind: "warn"; secondsLeft: number }
  | { kind: "expired" };

/**
 * What the shell should do now. `now` is unix seconds, `idleFor` seconds since the last click, key
 * or scroll. Past the idle or absolute end: expired. Inside the warning window: refresh quietly if
 * the admin is active, otherwise warn. The absolute cap cannot be extended, so it never refreshes.
 */
export function idleState(
  me: Pick<AdminMe, "sessionExpiresAt" | "sessionAbsoluteExpiresAt">,
  now: number,
  idleFor: number,
): IdleState {
  if (now >= me.sessionAbsoluteExpiresAt || now >= me.sessionExpiresAt) return { kind: "expired" };
  const left = me.sessionExpiresAt - now;
  if (left > WARN_SECONDS) return { kind: "ok" };
  const capLeft = me.sessionAbsoluteExpiresAt - now;
  if (capLeft <= left) {
    return capLeft <= WARN_SECONDS
      ? { kind: "warn", secondsLeft: Math.ceil(capLeft) }
      : { kind: "ok" };
  }
  if (idleFor <= ACTIVE_WINDOW_SECONDS && idleFor < left) return { kind: "refresh" };
  return { kind: "warn", secondsLeft: Math.ceil(left) };
}
