/**
 * Notifications model (Figma "Notifications panel"). Two sources are merged, newest first:
 * - the notifications API (path reminders, new lessons, support replies, report outcomes), whose
 *   rows carry their own `readAt`, so read state is the server's;
 * - curator decisions derived from the learner's submissions (lib/app/submit-notifications.ts),
 *   which have no server row, so their read state is a per-device convenience in localStorage.
 */
import {
  type ApiNotification,
  listNotifications,
  markNotificationsRead,
} from "../auth/notifications-api";
import { listSubmissions, type Submission } from "../auth/submissions-api";
import { submissionNotifications } from "./submit-notifications";

export type NotificationKind =
  | "path-reminder"
  | "new-lesson"
  | "curator-approved"
  | "curator-changes"
  | "curator-declined"
  | "support-reply"
  | "report-fixed"
  | "report-cant-reproduce";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** ISO 8601 time the notification was created. */
  createdAt: string;
  read: boolean;
  /** Where "open" goes, an in-app path; absent when the notification is only informational. */
  href?: string;
  /** Derived items (curator decisions) are read per device; everything else is a server row. */
  derived?: boolean;
};

export type NotificationFilter = "all" | "unread" | "submissions";

export const FILTER_LABEL: Record<NotificationFilter, string> = {
  all: "All",
  unread: "Unread",
  submissions: "Submissions",
};

/** Curator decisions on shared resources are the "Submissions" tab. */
export function isSubmissionKind(kind: NotificationKind): boolean {
  return kind === "curator-approved" || kind === "curator-changes" || kind === "curator-declined";
}

export function unreadCount(items: readonly NotificationItem[]): number {
  return items.filter((item) => !item.read).length;
}

export function filterNotifications(
  items: readonly NotificationItem[],
  filter: NotificationFilter,
): NotificationItem[] {
  if (filter === "unread") return items.filter((item) => !item.read);
  if (filter === "submissions") return items.filter((item) => isSubmissionKind(item.kind));
  return [...items];
}

export function markAllRead(items: readonly NotificationItem[]): NotificationItem[] {
  return items.map((item) => (item.read ? item : { ...item, read: true }));
}

export function markRead(items: readonly NotificationItem[], id: string): NotificationItem[] {
  return items.map((item) => (item.id === id && !item.read ? { ...item, read: true } : item));
}

export type NotificationGroup = { label: "Today" | "Earlier"; items: NotificationItem[] };

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today" is the same calendar day as `now`; everything older is "Earlier". Newest first. */
export function groupNotifications(
  items: readonly NotificationItem[],
  now: Date,
): NotificationGroup[] {
  const sorted = [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const today = startOfDay(now);
  const recent = sorted.filter((item) => Date.parse(item.createdAt) >= today);
  const older = sorted.filter((item) => Date.parse(item.createdAt) < today);
  const groups: NotificationGroup[] = [];
  if (recent.length > 0) groups.push({ label: "Today", items: recent });
  if (older.length > 0) groups.push({ label: "Earlier", items: older });
  return groups;
}

/** "Just now", "2h ago", "Yesterday", "2 days ago", else the date. */
export function relativeTime(iso: string, now: Date): string {
  const then = new Date(iso);
  const diff = now.getTime() - then.getTime();
  if (Number.isNaN(diff)) return "";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return `${Math.floor(minutes / 60)}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export type FeedResult = { ok: true; items: NotificationItem[] } | { ok: false };

const KIND_BY_TONE = {
  success: "curator-approved",
  warning: "curator-changes",
  neutral: "curator-declined",
} as const;

/** Curator decisions on the learner's submissions as feed items, unread unless seen on this device. */
export function submissionFeed(
  submissions: readonly Submission[],
  read: ReadonlySet<string>,
): NotificationItem[] {
  return submissionNotifications(submissions).map((entry) => ({
    id: entry.id,
    kind: KIND_BY_TONE[entry.tone],
    title: entry.title,
    body: entry.body,
    createdAt: entry.at,
    read: read.has(entry.id),
    href: entry.href,
    derived: true,
  }));
}

/** API rows as feed items: read is the server's `readAt`. */
export function apiFeed(rows: readonly ApiNotification[]): NotificationItem[] {
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt,
    read: row.readAt !== null,
    ...(row.href ? { href: row.href } : {}),
  }));
}

/** Both sources in one list, newest first. */
export function mergeFeeds(...feeds: readonly (readonly NotificationItem[])[]): NotificationItem[] {
  return feeds.flat().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Ids the server should be told about: unread API rows among `ids` (derived items stay local). */
export function serverUnreadIds(
  items: readonly NotificationItem[],
  ids?: readonly string[],
): string[] {
  const wanted = ids ? new Set(ids) : null;
  return items
    .filter((item) => !item.derived && !item.read && (!wanted || wanted.has(item.id)))
    .map((item) => item.id);
}

/**
 * Tells the API which rows were read, 50 at a time (its limit). Resolves false when any call
 * fails, so the caller can roll its optimistic update back.
 */
export async function pushRead(ids: readonly string[]): Promise<boolean> {
  for (let i = 0; i < ids.length; i += 50) {
    const result = await markNotificationsRead(ids.slice(i, i + 50));
    if (!result.ok) return false;
  }
  return true;
}

const READ_KEY = "ms_notifications_read";

/** Ids the learner has already seen on this device. Storage can be blocked: then everything is new. */
export function loadReadIds(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(READ_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveReadIds(items: readonly NotificationItem[]): void {
  try {
    const ids = items.filter((item) => item.derived && item.read).map((item) => item.id);
    if (ids.length > 0) localStorage.setItem(READ_KEY, JSON.stringify(ids));
  } catch {
    // Read state is a convenience; a blocked store only means items show as new again.
  }
}

/**
 * Loads the learner's notifications: the API feed plus curator decisions from the submissions
 * API. Offline, or both requests failing, is a failure so the panel offers Try again instead of
 * claiming "all caught up"; one failing alone shows what the other returned.
 */
export async function loadNotifications(online: boolean): Promise<FeedResult> {
  if (!online) return { ok: false };
  const [feed, submissions] = await Promise.all([listNotifications(), listSubmissions()]);
  if (!feed.ok && !submissions.ok) return { ok: false };
  const items = mergeFeeds(
    feed.ok ? apiFeed(feed.data) : [],
    submissions.ok ? submissionFeed(submissions.data, loadReadIds()) : [],
  );
  return { ok: true, items };
}

export const NOTIFICATION_FIXTURES = {
  now: "2026-11-11T14:00:00.000Z",
  items: [
    {
      id: "n1",
      kind: "curator-approved",
      title: "Your resource was approved",
      body: "“Figma auto layout guide” is now in the library. Thanks for sharing.",
      createdAt: "2026-11-11T12:00:00.000Z",
      read: false,
    },
    {
      id: "n2",
      kind: "new-lesson",
      title: "New lesson in UI/UX Design Foundations",
      body: "Lesson 4, Usability testing basics, has been added to your path.",
      createdAt: "2026-11-11T09:00:00.000Z",
      read: false,
    },
    {
      id: "n3",
      kind: "path-reminder",
      title: "Pick up Design Systems 101",
      body: "It’s been a few days. Lesson 2 is about 20 minutes.",
      createdAt: "2026-11-10T10:00:00.000Z",
      read: true,
    },
    {
      id: "n4",
      kind: "curator-changes",
      title: "Your submission needs a change",
      body: "Add a short note on why “Colour theory 101” helps beginners, then resubmit.",
      createdAt: "2026-11-09T10:00:00.000Z",
      read: true,
    },
    {
      id: "n5",
      kind: "support-reply",
      title: "Support replied to your message",
      body: "We’ve answered your question about changing your email address.",
      createdAt: "2026-11-08T10:00:00.000Z",
      read: true,
    },
    {
      id: "n6",
      kind: "report-fixed",
      title: "Your report was fixed",
      body: "The broken link in “Auto layout, explained” has been replaced.",
      createdAt: "2026-11-07T10:00:00.000Z",
      read: true,
    },
    {
      id: "n7",
      kind: "report-cant-reproduce",
      title: "We couldn’t reproduce your report",
      body: "The page loaded for us. Tell us your browser and we’ll look again.",
      createdAt: "2026-11-06T10:00:00.000Z",
      read: true,
    },
  ] satisfies NotificationItem[],
};
