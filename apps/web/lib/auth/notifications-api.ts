import { isRecord, request } from "./api";

/**
 * Typed client for the learner's notification feed (contract B). Nothing throws: every call
 * resolves to an ApiResult, and nothing here logs.
 *
 * - GET  /api/me/notifications -> {notifications: [{id, kind, title, body, href, createdAt, readAt}]},
 *   newest first, at most 50. Times are ISO 8601.
 * - POST /api/me/notifications/read {ids?: string[]} (at most 50; omit for all) -> {updated}.
 */
export const API_NOTIFICATION_KINDS = [
  "path-reminder",
  "new-lesson",
  "support-reply",
  "report-fixed",
  "report-cant-reproduce",
] as const;
export type ApiNotificationKind = (typeof API_NOTIFICATION_KINDS)[number];

export type ApiNotification = {
  id: string;
  kind: ApiNotificationKind;
  title: string;
  body: string;
  /** An in-app path, or null when the notification is informational. */
  href: string | null;
  createdAt: string;
  readAt: string | null;
};

const validTime = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

/** Only same-app paths are followed: a feed row can never send the learner to another site. */
export function safeHref(value: unknown): string | null {
  return typeof value === "string" && /^\/(?!\/)[^\s\\]*$/.test(value) ? value : null;
}

/** Exported for tests. Undefined when the payload is not a usable notification. */
export function parseApiNotification(json: unknown): ApiNotification | undefined {
  if (!isRecord(json)) return undefined;
  const { id, kind, title, body, createdAt } = json;
  if (typeof id !== "string" || id === "") return undefined;
  if (typeof kind !== "string" || !(API_NOTIFICATION_KINDS as readonly string[]).includes(kind)) {
    return undefined;
  }
  if (typeof title !== "string" || typeof body !== "string" || !validTime(createdAt)) {
    return undefined;
  }
  return {
    id,
    kind: kind as ApiNotificationKind,
    title,
    body,
    href: safeHref(json.href),
    createdAt,
    readAt: validTime(json.readAt) ? json.readAt : null,
  };
}

/** Exported for tests. Rows that cannot be read are dropped; an answer without a list is invalid. */
export function parseNotificationList(json: unknown): ApiNotification[] | undefined {
  if (!isRecord(json) || !Array.isArray(json.notifications)) return undefined;
  return json.notifications.flatMap((row) => {
    const parsed = parseApiNotification(row);
    return parsed ? [parsed] : [];
  });
}

const parseUpdated = (json: unknown) =>
  isRecord(json) && typeof json.updated === "number" ? json.updated : undefined;

export function listNotifications(signal?: AbortSignal) {
  return request("GET", "/api/me/notifications", { signal }, parseNotificationList);
}

/** No ids marks everything read; the API accepts at most 50 ids per call. */
export function markNotificationsRead(ids?: readonly string[], signal?: AbortSignal) {
  const body = ids ? { ids: ids.slice(0, 50) } : {};
  return request("POST", "/api/me/notifications/read", { body, signal }, parseUpdated);
}
