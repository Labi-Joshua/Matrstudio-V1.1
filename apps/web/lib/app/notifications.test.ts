import { describe, expect, it } from "vitest";
import type { Submission } from "../auth/submissions-api";
import {
  apiFeed,
  filterNotifications,
  groupNotifications,
  isSubmissionKind,
  loadNotifications,
  markAllRead,
  markRead,
  mergeFeeds,
  type NotificationItem,
  relativeTime,
  serverUnreadIds,
  submissionFeed,
  unreadCount,
} from "./notifications";

const now = new Date(2026, 10, 11, 14, 0, 0);
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0, 0).toISOString();
const item = (over: Partial<NotificationItem> & { id: string }): NotificationItem => ({
  kind: "path-reminder",
  title: "t",
  body: "b",
  createdAt: at(11, 9),
  read: false,
  ...over,
});

describe("notification filters", () => {
  const items = [
    item({ id: "a", kind: "curator-approved" }),
    item({ id: "b", kind: "support-reply", read: true }),
    item({ id: "c", kind: "curator-changes", read: true }),
  ];

  it("counts unread and filters by tab", () => {
    expect(unreadCount(items)).toBe(1);
    expect(filterNotifications(items, "all")).toHaveLength(3);
    expect(filterNotifications(items, "unread").map((i) => i.id)).toEqual(["a"]);
    expect(filterNotifications(items, "submissions").map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("only curator decisions are submissions", () => {
    expect(isSubmissionKind("curator-approved")).toBe(true);
    expect(isSubmissionKind("report-fixed")).toBe(false);
  });

  it("marks one or all as read without mutating", () => {
    expect(markRead(items, "a")[0]?.read).toBe(true);
    expect(items[0]?.read).toBe(false);
    expect(unreadCount(markAllRead(items))).toBe(0);
  });
});

describe("grouping and time", () => {
  it("groups Today and Earlier, newest first, omitting empty groups", () => {
    const groups = groupNotifications(
      [
        item({ id: "old", createdAt: at(9, 10) }),
        item({ id: "early", createdAt: at(11, 8) }),
        item({ id: "late", createdAt: at(11, 12) }),
      ],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Earlier"]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(["late", "early"]);
    expect(groupNotifications([item({ id: "x", createdAt: at(1, 1) })], now)).toHaveLength(1);
    expect(groupNotifications([], now)).toEqual([]);
  });

  it("words the age", () => {
    expect(relativeTime(at(11, 14), now)).toBe("Just now");
    expect(relativeTime(new Date(2026, 10, 11, 13, 30).toISOString(), now)).toBe("30m ago");
    expect(relativeTime(at(11, 12), now)).toBe("2h ago");
    expect(relativeTime(at(10, 20), now)).toBe("Yesterday");
    expect(relativeTime(at(9, 10), now)).toBe("2 days ago");
    expect(relativeTime(at(1, 10), now)).toBe("1 Nov");
    expect(relativeTime("nonsense", now)).toBe("");
  });
});

describe("loadNotifications", () => {
  it("is a failure offline, so the panel offers Try again", async () => {
    expect(await loadNotifications(false)).toEqual({ ok: false });
  });
});

describe("submissionFeed", () => {
  const submission = (id: string, status: Submission["status"]): Submission => ({
    id,
    url: "https://example.com/post",
    title: "A post",
    note: null,
    topic: null,
    status,
    curatorNote: null,
    createdAt: at(10, 9),
    updatedAt: at(11, 9),
  });

  it("turns each curator decision into an item and skips submissions still in review", () => {
    const feed = submissionFeed(
      [
        submission("a", "accepted"),
        submission("b", "needs_changes"),
        submission("c", "declined"),
        submission("d", "in_review"),
      ],
      new Set(),
    );
    expect(feed.map((entry) => entry.kind).sort()).toEqual([
      "curator-approved",
      "curator-changes",
      "curator-declined",
    ]);
    expect(feed.every((entry) => !entry.read && isSubmissionKind(entry.kind))).toBe(true);
  });

  it("marks the ones already seen on this device as read", () => {
    const [first] = submissionFeed([submission("a", "accepted")], new Set());
    const [again] = submissionFeed([submission("a", "accepted")], new Set([first?.id ?? ""]));
    expect(again?.read).toBe(true);
  });
});

describe("API feed", () => {
  const rows = [
    {
      id: "a",
      kind: "support-reply" as const,
      title: "Support replied",
      body: "b",
      href: "/learn/help/request?id=t1",
      createdAt: at(11, 10),
      readAt: null,
    },
    {
      id: "b",
      kind: "report-fixed" as const,
      title: "Fixed",
      body: "b",
      href: null,
      createdAt: at(10, 10),
      readAt: at(10, 11),
    },
  ];

  it("takes read state from readAt and keeps the href", () => {
    const feed = apiFeed(rows);
    expect(feed.map((i) => i.read)).toEqual([false, true]);
    expect(feed[0]?.href).toBe("/learn/help/request?id=t1");
    expect(feed[1]?.href).toBeUndefined();
    expect(feed.every((i) => !i.derived)).toBe(true);
  });

  it("merges with derived items, newest first", () => {
    const merged = mergeFeeds(apiFeed(rows), [
      item({ id: "d", derived: true, createdAt: at(11, 12) }),
    ]);
    expect(merged.map((i) => i.id)).toEqual(["d", "a", "b"]);
  });

  it("only reports unread server rows to the API", () => {
    const items = mergeFeeds(apiFeed(rows), [item({ id: "d", derived: true })]);
    expect(serverUnreadIds(items)).toEqual(["a"]);
    expect(serverUnreadIds(items, ["d", "b"])).toEqual([]);
    expect(serverUnreadIds(items, ["a"])).toEqual(["a"]);
  });
});
