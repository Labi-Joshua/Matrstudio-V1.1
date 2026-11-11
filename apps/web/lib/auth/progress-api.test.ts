import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listPaths,
  markLessonDone,
  parsePathList,
  parsePathProgress,
  starPath,
  startPath,
  undoLessonDone,
  unstarPath,
} from "./progress-api";

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

function mockFetch(response: Response) {
  const fn = vi.fn(async (..._args: unknown[]) => response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

const row = {
  slug: "p",
  startedAt: "2024-01-01T00:00:00.000Z",
  lastActivityAt: "2024-01-02T00:00:00.000Z",
  completedAt: null,
  starredAt: null,
  completedLessonIds: ["a", "b"],
};

describe("parsing", () => {
  it("reads a path row", () => {
    expect(parsePathProgress(row)).toEqual(row);
  });

  it("turns bad times into null and drops non-string lesson ids", () => {
    expect(
      parsePathProgress({
        ...row,
        startedAt: "nope",
        completedAt: 5,
        completedLessonIds: ["a", 1, ""],
      }),
    ).toEqual({ ...row, startedAt: null, completedAt: null, completedLessonIds: ["a"] });
  });

  it("rejects bad shapes", () => {
    for (const bad of [
      null,
      [],
      {},
      { slug: "" },
      { slug: "p" },
      { slug: "p", completedLessonIds: "x" },
    ]) {
      expect(parsePathProgress(bad)).toBeUndefined();
    }
  });

  it("drops unreadable rows but needs a list", () => {
    expect(parsePathList({ paths: [row, { nope: 1 }, null] })).toEqual([row]);
    expect(parsePathList({ paths: "x" })).toBeUndefined();
    expect(parsePathList(null)).toBeUndefined();
  });
});

describe("requests", () => {
  it("lists paths", async () => {
    const fetchFn = mockFetch(json({ paths: [row] }));
    const r = await listPaths();
    expect(r.ok && r.data).toEqual([row]);
    expect(fetchFn.mock.calls[0]?.[0]).toBe("/api/me/paths");
  });

  it("starts, stars and unstars with the right method and path", async () => {
    const fetchFn = mockFetch(json({ path: row }));
    await startPath("a b");
    await starPath("p");
    await unstarPath("p");
    const calls = fetchFn.mock.calls.map((c) => [c[0], (c[1] as RequestInit).method]);
    expect(calls).toEqual([
      ["/api/me/paths/a%20b/start", "POST"],
      ["/api/me/paths/p/star", "PUT"],
      ["/api/me/paths/p/star", "DELETE"],
    ]);
  });

  it("sends the lesson count when marking done and nothing when undoing", async () => {
    const fetchFn = mockFetch(json({ path: row }));
    const done = await markLessonDone("p", "l1", 10);
    expect(done.ok && done.data.slug).toBe("p");
    const init = fetchFn.mock.calls[0]?.[1] as RequestInit;
    expect(fetchFn.mock.calls[0]?.[0]).toBe("/api/me/paths/p/lessons/l1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ total: 10 });
    await undoLessonDone("p", "l1");
    const undo = fetchFn.mock.calls[1]?.[1] as RequestInit;
    expect(undo.method).toBe("DELETE");
    expect(undo.body).toBeUndefined();
  });

  it("maps path_limit, rate_limited and an unreadable answer", async () => {
    mockFetch(json({ code: "path_limit", message: "full" }, { status: 409 }));
    const full = await startPath("p");
    expect(!full.ok && full.code).toBe("path_limit");
    mockFetch(
      json({ code: "rate_limited", message: "slow", retryAfterSeconds: 30 }, { status: 429 }),
    );
    const slow = await starPath("p");
    expect(!slow.ok && slow.code).toBe("rate_limited");
    mockFetch(json({ nope: true }));
    const bad = await startPath("p");
    expect(!bad.ok && bad.code).toBe("invalid_response");
  });
});
