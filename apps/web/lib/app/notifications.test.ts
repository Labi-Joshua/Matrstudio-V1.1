import { describe, expect, it } from "vitest";
import {
  filterNotifications,
  groupNotifications,
  isSubmissionKind,
  loadNotifications,
  markAllRead,
  markRead,
  type NotificationItem,
  relativeTime,
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
  it("is an empty feed while online (no API yet) and a failure offline", async () => {
    expect(await loadNotifications(true)).toEqual({ ok: true, items: [] });
    expect(await loadNotifications(false)).toEqual({ ok: false });
  });
});
