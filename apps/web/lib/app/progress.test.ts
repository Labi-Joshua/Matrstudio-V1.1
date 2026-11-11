import { describe, expect, it } from "vitest";
import type { PathProgress } from "../auth/progress-api";
import { SAMPLE_PATHS } from "../pages/browse-paths";
import {
  ago,
  buildMine,
  doneCount,
  emptyEntry,
  finishedIn,
  nextLesson,
  pathStatusLine,
  percent,
  previousLesson,
  resumeTarget,
  sidebarLine,
  sortEntries,
  upNext,
  withLessonDone,
  withLessonUndone,
  withStar,
  withStart,
} from "./progress-logic";
import {
  entryOf,
  INITIAL_PROGRESS,
  isPendingSlug,
  isValidId,
  progressReducer,
} from "./progress-state";
import { failureToast, lessonDoneToast, startedToast } from "./progress-toast";

const T0 = "2024-05-01T10:00:00.000Z";
const T1 = "2024-05-02T10:00:00.000Z";
const NOW = Date.parse("2024-05-10T10:00:00.000Z");
const lessons = ["a", "b", "c", "d"].map((id) => ({ id }));

const entry = (over: Partial<PathProgress> = {}): PathProgress => ({
  ...emptyEntry("p"),
  startedAt: T0,
  lastActivityAt: T1,
  ...over,
});

describe("percent and counts", () => {
  it("rounds, clamps and survives a zero total", () => {
    expect(percent(4, 10)).toBe(40);
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
    expect(percent(12, 10)).toBe(100);
  });

  it("never counts more lessons than the path has", () => {
    expect(doneCount(entry({ completedLessonIds: ["a", "b", "x"] }), 2)).toBe(2);
    expect(doneCount(undefined, 5)).toBe(0);
  });
});

describe("resume target and next lesson", () => {
  it("resumes at the first lesson not done, even after a skipped one", () => {
    expect(resumeTarget(lessons, undefined)).toEqual({ lesson: { id: "a" }, number: 1 });
    expect(resumeTarget(lessons, entry({ completedLessonIds: ["a", "c"] }))).toEqual({
      lesson: { id: "b" },
      number: 2,
    });
  });

  it("has no target when every lesson is done or there are none", () => {
    expect(resumeTarget(lessons, entry({ completedLessonIds: ["a", "b", "c", "d"] }))).toBeNull();
    expect(resumeTarget([], undefined)).toBeNull();
  });

  it("walks the path in order", () => {
    expect(nextLesson(lessons, "b")).toEqual({ lesson: { id: "c" }, number: 3 });
    expect(nextLesson(lessons, "d")).toBeNull();
    expect(nextLesson(lessons, "zzz")).toBeNull();
    expect(previousLesson(lessons, "b")).toEqual({ lesson: { id: "a" }, number: 1 });
    expect(previousLesson(lessons, "a")).toBeNull();
  });

  it("offers the next lesson not done after the current one, else the first not done", () => {
    const e = entry({ completedLessonIds: ["a", "b", "c"] });
    expect(upNext(lessons, "c", e)).toEqual({ lesson: { id: "d" }, number: 4 });
    const skipped = entry({ completedLessonIds: ["b", "c", "d"] });
    expect(upNext(lessons, "d", skipped)).toEqual({ lesson: { id: "a" }, number: 1 });
    expect(upNext(lessons, "d", entry({ completedLessonIds: ["a", "b", "c", "d"] }))).toBeNull();
  });
});

describe("ordering", () => {
  it("sorts by latest activity, a star counting as activity, ties by slug", () => {
    const list = [
      entry({ slug: "old", lastActivityAt: T0 }),
      entry({
        slug: "starred",
        startedAt: null,
        lastActivityAt: null,
        starredAt: "2024-06-01T00:00:00.000Z",
      }),
      entry({ slug: "b", lastActivityAt: T1 }),
      entry({ slug: "a", lastActivityAt: T1 }),
    ];
    expect(sortEntries(list).map((e) => e.slug)).toEqual(["starred", "a", "b", "old"]);
  });
});

describe("optimistic changes", () => {
  it("starts once and keeps the first start time", () => {
    const first = withStart(undefined, "p", T0);
    expect(first).toMatchObject({ slug: "p", startedAt: T0, lastActivityAt: T0 });
    expect(withStart(first, "p", T1)).toMatchObject({ startedAt: T0, lastActivityAt: T1 });
  });

  it("marks done once and completes at the total", () => {
    const one = withLessonDone(undefined, "p", "a", 2, T0);
    expect(one.completedLessonIds).toEqual(["a"]);
    expect(one.completedAt).toBeNull();
    expect(withLessonDone(one, "p", "a", 2, T1).completedLessonIds).toEqual(["a"]);
    const two = withLessonDone(one, "p", "b", 2, T1);
    expect(two.completedAt).toBe(T1);
    expect(withLessonDone(two, "p", "b", 2, "2024-06-01T00:00:00.000Z").completedAt).toBe(T1);
  });

  it("undo clears completion and ignores a lesson that was not done", () => {
    const done = entry({ completedLessonIds: ["a", "b"], completedAt: T1 });
    const undone = withLessonUndone(done, "b", T1);
    expect(undone?.completedLessonIds).toEqual(["a"]);
    expect(undone?.completedAt).toBeNull();
    expect(withLessonUndone(done, "zzz", T1)).toBe(done);
    expect(withLessonUndone(undefined, "a", T1)).toBeUndefined();
  });

  it("stars before starting, and unstarring an untouched path leaves nothing", () => {
    const starred = withStar(undefined, "p", true, T0);
    expect(starred).toMatchObject({ starredAt: T0, startedAt: null });
    expect(withStar(starred, "p", false, T1)).toBeUndefined();
    expect(withStar(entry(), "p", false, T1)?.startedAt).toBe(T0);
  });
});

describe("words", () => {
  it("says how long ago", () => {
    expect(ago(T0, Date.parse(T0))).toBe("today");
    expect(ago(T0, Date.parse(T0) + 86_400_000)).toBe("yesterday");
    expect(ago(T0, Date.parse(T0) + 3 * 86_400_000)).toBe("3 days ago");
    expect(ago(T0, Date.parse(T0) + 21 * 86_400_000)).toBe("3 weeks ago");
    expect(ago(T0, Date.parse(T0) + 150 * 86_400_000)).toBe("5 months ago");
    expect(ago(null, NOW)).toBeNull();
  });

  it("says how long a path took", () => {
    expect(finishedIn(entry({ startedAt: T0, completedAt: "2024-05-13T10:00:00.000Z" }))).toBe(
      "12 days",
    );
    expect(finishedIn(entry({ startedAt: T0, completedAt: "2024-05-02T10:00:00.000Z" }))).toBe(
      "1 day",
    );
    expect(finishedIn(entry({ startedAt: T0, completedAt: T0 }))).toBe("under a day");
    expect(finishedIn(entry({ completedAt: null }))).toBeNull();
  });

  it("writes the status line for each state", () => {
    expect(pathStatusLine(undefined, 10, NOW)).toBeNull();
    expect(pathStatusLine(entry({ startedAt: null }), 10, NOW)).toBeNull();
    expect(pathStatusLine(entry({ startedAt: "2024-05-10T08:00:00.000Z" }), 10, NOW)).toBe(
      "Started today · 0 of 10 lessons done",
    );
    expect(
      pathStatusLine(
        entry({
          completedLessonIds: ["a", "b", "c", "d"],
          lastActivityAt: "2024-05-07T10:00:00.000Z",
        }),
        10,
        NOW,
      ),
    ).toBe("4 of 10 lessons done · last active 3 days ago");
    expect(
      pathStatusLine(
        entry({ completedLessonIds: ["a"], completedAt: "2024-05-13T10:00:00.000Z" }),
        1,
        NOW,
      ),
    ).toBe("Completed 12 days after starting · 1 of 1 lesson done");
  });

  it("writes the sidebar line", () => {
    expect(sidebarLine(entry({ completedLessonIds: ["a", "b", "c"] }), 12)).toBe(
      "Lesson 4 of 12 · 25%",
    );
    expect(sidebarLine(entry({ startedAt: null, lastActivityAt: null, starredAt: T0 }), 12)).toBe(
      "Starred · not started",
    );
    expect(sidebarLine(entry({ completedAt: T1 }), 12)).toBe("Completed");
  });
});

describe("my paths", () => {
  const [first, second] = SAMPLE_PATHS;
  if (!first || !second) throw new Error("sample paths missing");

  it("lists entries newest first and skips paths that left the catalogue", () => {
    const mine = buildMine(
      [
        entry({ slug: first.slug, completedLessonIds: ["a"], lastActivityAt: T0 }),
        entry({ slug: "gone" }),
        entry({ slug: second.slug, startedAt: null, lastActivityAt: null, starredAt: T1 }),
      ],
      SAMPLE_PATHS,
    );
    expect(mine.map((m) => m.path.slug)).toEqual([second.slug, first.slug]);
    expect(mine[0]).toMatchObject({ starred: true, done: null, completed: false });
    expect(mine[1]).toMatchObject({ starred: false, done: 1, completed: false });
  });

  it("marks completion from the server, not from the lesson count", () => {
    const [m] = buildMine([entry({ slug: first.slug, completedAt: T1 })], SAMPLE_PATHS);
    expect(m?.completed).toBe(true);
  });
});

describe("reducer", () => {
  const ready = progressReducer(INITIAL_PROGRESS, { type: "loaded", entries: [entry()] });

  it("loads, fails and reloads", () => {
    expect(INITIAL_PROGRESS.status).toBe("loading");
    expect(ready.status).toBe("ready");
    expect(progressReducer(ready, { type: "load-failed" }).status).toBe("error");
    expect(progressReducer(ready, { type: "load" }).status).toBe("loading");
  });

  it("applies a change at once and keeps the path pending until the API answers", () => {
    const next = progressReducer(ready, {
      type: "apply",
      slug: "p",
      entry: entry({ completedLessonIds: ["a"] }),
    });
    expect(entryOf(next, "p")?.completedLessonIds).toEqual(["a"]);
    expect(isPendingSlug(next, "p")).toBe(true);
    const settled = progressReducer(next, {
      type: "settled",
      slug: "p",
      entry: entry({ completedLessonIds: ["a"], lastActivityAt: T1 }),
    });
    expect(isPendingSlug(settled, "p")).toBe(false);
    expect(entryOf(settled, "p")?.completedLessonIds).toEqual(["a"]);
  });

  it("rolls back to the previous entry, or removes one that did not exist", () => {
    const added = progressReducer(ready, { type: "apply", slug: "q", entry: entry({ slug: "q" }) });
    const back = progressReducer(added, { type: "rollback", slug: "q", previous: undefined });
    expect(entryOf(back, "q")).toBeUndefined();
    expect(isPendingSlug(back, "q")).toBe(false);
    const changed = progressReducer(ready, { type: "apply", slug: "p", entry: undefined });
    expect(entryOf(changed, "p")).toBeUndefined();
    const restored = progressReducer(changed, {
      type: "rollback",
      slug: "p",
      previous: entryOf(ready, "p"),
    });
    expect(entryOf(restored, "p")).toEqual(entry());
  });

  it("drops an entry that records nothing", () => {
    const blank = progressReducer(ready, {
      type: "settled",
      slug: "p",
      entry: emptyEntry("p"),
    });
    expect(blank.entries).toEqual([]);
  });

  it("checks ids like the API does", () => {
    expect(isValidId("product-design-essentials")).toBe(true);
    for (const bad of ["", "Upper", "-lead", "has_underscore", "a".repeat(65)]) {
      expect(isValidId(bad)).toBe(false);
    }
  });
});

describe("toasts", () => {
  it("has the copy of the designs", () => {
    expect(startedToast()).toMatchObject({
      title: "Path started",
      body: "It’s in Your paths. Lesson 1 is ready when you are.",
    });
    expect(lessonDoneToast(4, 4, 10)).toMatchObject({
      title: "Lesson 4 done",
      body: "4 of 10 lessons done. Nice work.",
      action: "undo",
    });
    expect(lessonDoneToast(null, 1, 1).title).toBe("Lesson done");
  });

  it("explains each failure, with Retry only where it can help", () => {
    expect(failureToast("path_limit", "start").action).toBeNull();
    expect(failureToast("path_limit", "start").body).toMatch(/200/);
    expect(failureToast("rate_limited", "done").action).toBeNull();
    expect(failureToast("unauthorized", "done").action).toBeNull();
    expect(failureToast("network_error", "done")).toMatchObject({
      title: "Your progress didn’t save",
      action: null,
    });
    expect(failureToast("unknown_error", "load").title).toBe("Couldn’t load your paths");
  });
});
