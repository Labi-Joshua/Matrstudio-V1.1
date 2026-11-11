import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listNotifications,
  markNotificationsRead,
  parseApiNotification,
  parseNotificationList,
  safeHref,
} from "./notifications-api";

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

function mockFetch(response: Response) {
  const fn = vi.fn(async (..._args: unknown[]) => response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

const row = {
  id: "n1",
  kind: "support-reply",
  title: "Support replied",
  body: "We answered.",
  href: "/learn/help/request?id=t1",
  createdAt: "2026-11-11T10:00:00.000Z",
  readAt: null,
};

describe("parsing", () => {
  it("reads a row", () => {
    expect(parseApiNotification(row)).toEqual(row);
    expect(parseApiNotification({ ...row, readAt: "2026-11-11T11:00:00.000Z" })?.readAt).toBe(
      "2026-11-11T11:00:00.000Z",
    );
  });

  it("rejects unknown kinds and bad times, and tolerates a missing href", () => {
    expect(parseApiNotification({ ...row, kind: "other" })).toBeUndefined();
    expect(parseApiNotification({ ...row, createdAt: "x" })).toBeUndefined();
    expect(parseApiNotification({ ...row, href: undefined })?.href).toBeNull();
  });

  it("only follows in-app paths", () => {
    expect(safeHref("/learn/help")).toBe("/learn/help");
    for (const bad of ["//evil.test", "https://evil.test", "javascript:1", "/a b", 5, null]) {
      expect(safeHref(bad)).toBeNull();
    }
  });

  it("drops unreadable list rows but needs a list", () => {
    expect(parseNotificationList({ notifications: [row, { nope: 1 }] })).toHaveLength(1);
    expect(parseNotificationList({})).toBeUndefined();
  });
});

describe("calls", () => {
  it("lists the feed", async () => {
    mockFetch(json({ notifications: [row] }));
    const result = await listNotifications();
    expect(result.ok && result.data).toHaveLength(1);
  });

  it("marks some or all as read", async () => {
    const fn = mockFetch(json({ updated: 2 }));
    await markNotificationsRead(["a", "b"]);
    expect(JSON.parse(String((fn.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
      ids: ["a", "b"],
    });
    await markNotificationsRead();
    expect(JSON.parse(String((fn.mock.calls[1] as [string, RequestInit])[1].body))).toEqual({});
  });

  it("caps the ids at 50", async () => {
    const fn = mockFetch(json({ updated: 1 }));
    await markNotificationsRead(Array.from({ length: 60 }, (_, i) => `n${i}`));
    const sent = JSON.parse(String((fn.mock.calls[0] as [string, RequestInit])[1].body));
    expect(sent.ids).toHaveLength(50);
  });
});
