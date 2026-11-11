import { describe, expect, it } from "vitest";
import type { PathProgress } from "../auth/progress-api";
import type { Submission } from "../auth/submissions-api";
import { catalogue as realCatalogue } from "../catalogue/data";
import type { Catalogue } from "../catalogue/types";
import { pickHomeVariant } from "./dashboard";
import { buildHomeProgress, daysSince, ownedSlugs, recentSubmissions } from "./home-data";

const published: Catalogue = {
  ...realCatalogue,
  resources: [
    {
      id: "r1",
      title: "Mapping flows",
      url: "https://example.com/a",
      sourceSlug: "youtube",
      format: "video",
      lengthMinutes: 12,
      topicSlug: "ui-ux",
      status: "live",
    },
    {
      id: "r3",
      title: "Wireframes",
      url: "https://example.com/b",
      sourceSlug: "medium",
      format: "article",
      lengthMinutes: 5,
      topicSlug: "ui-ux",
      status: "live",
    },
  ],
  paths: [
    {
      slug: "flows",
      title: "Flows",
      description: "d",
      topicSlug: "ui-ux",
      level: "beginner",
      status: "published",
    },
  ],
  pathLessons: [
    { pathSlug: "flows", resourceId: "r1", position: 0 },
    { pathSlug: "flows", resourceId: "r3", position: 1 },
  ],
};

const NOW = Date.parse("2026-11-11T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const entry = (over: Partial<PathProgress>): PathProgress => ({
  slug: "flows",
  startedAt: daysAgo(10),
  lastActivityAt: daysAgo(1),
  completedAt: null,
  starredAt: null,
  completedLessonIds: [],
  ...over,
});
const build = (entries: PathProgress[]) =>
  buildHomeProgress({ entries, catalogue: published, recommended: [], now: NOW, useSample: false });

describe("daysSince", () => {
  it("counts whole days and never goes negative", () => {
    expect(daysSince(daysAgo(0), NOW)).toBe(0);
    expect(daysSince(daysAgo(3), NOW)).toBe(3);
    expect(daysSince(new Date(NOW + 5000).toISOString(), NOW)).toBe(0);
    expect(daysSince(null, NOW)).toBe(0);
    expect(daysSince("nope", NOW)).toBe(0);
  });
});

describe("buildHomeProgress", () => {
  it("is empty for a learner with nothing started (new account)", () => {
    const progress = build([
      entry({ startedAt: null, lastActivityAt: null, starredAt: daysAgo(2) }),
    ]);
    expect(progress.started).toEqual([]);
    expect(pickHomeVariant(progress)).toBe("new-account");
  });

  it("gives a started path its resume target, percent inputs and lesson links", () => {
    const progress = build([entry({ completedLessonIds: ["r1"] })]);
    const [path] = progress.started;
    expect(path?.lessonsDone).toBe(1);
    expect(path?.lessons).toBe(2);
    expect(path?.next).toMatchObject({
      number: 2,
      title: "Wireframes",
      format: "Article",
      minutes: 5,
      href: "/learn/paths/ui-ux/flows/lessons/r3",
    });
    expect(path?.lastDone).toEqual({ number: 1, title: "Mapping flows" });
    expect(path?.lastActiveDays).toBe(1);
    expect(pickHomeVariant(progress)).toBe("in-progress");
  });

  it("switches to welcome back after seven days without activity, not before", () => {
    const six = build([entry({ lastActivityAt: daysAgo(6) })]);
    const seven = build([entry({ lastActivityAt: daysAgo(7) })]);
    expect(pickHomeVariant(six)).toBe("in-progress");
    expect(pickHomeVariant(seven)).toBe("welcome-back");
    expect(seven.started[0]?.lastActiveDays).toBe(7);
  });

  it("shows the finished layout for a fresh completion and drops the path from in-progress", () => {
    const progress = build([
      entry({
        completedLessonIds: ["r1", "r3"],
        completedAt: daysAgo(0),
        lastActivityAt: daysAgo(0),
      }),
    ]);
    expect(progress.started).toEqual([]);
    expect(progress.finished?.path.title).toBe("Flows");
    expect(progress.finished?.daysAgo).toBe(0);
    expect(progress.finished?.path.next).toBeNull();
    expect(pickHomeVariant(progress)).toBe("finished");
  });

  it("picks the most recent completion, and an old one no longer takes over Home", () => {
    const old = build([entry({ completedAt: daysAgo(20), completedLessonIds: ["r1", "r3"] })]);
    expect(old.finished?.daysAgo).toBe(20);
    expect(pickHomeVariant(old)).toBe("new-account");
  });

  it("skips a path that left the catalogue without a word", () => {
    const progress = build([entry({ slug: "gone" })]);
    expect(progress.started).toEqual([]);
    expect(progress.finished).toBeNull();
  });

  it("has no resume target when every listed lesson is done but the path is not complete", () => {
    const [path] = build([entry({ completedLessonIds: ["r1", "r3"] })]).started;
    expect(path?.next).toBeNull();
  });
});

describe("home lists", () => {
  it("collects the slugs a learner already has", () => {
    const owned = ownedSlugs([
      entry({ slug: "a" }),
      entry({ slug: "b", startedAt: null, starredAt: daysAgo(1) }),
      entry({ slug: "c", completedAt: daysAgo(2) }),
    ]);
    expect([...owned].sort()).toEqual(["a", "c"]);
  });

  it("keeps the newest four submissions", () => {
    const row = (id: string, at: number): Submission => ({
      id,
      url: "https://example.com",
      title: null,
      note: null,
      topic: null,
      status: "in_review",
      curatorNote: null,
      createdAt: daysAgo(at),
      updatedAt: daysAgo(at),
    });
    const rows = recentSubmissions([
      row("old", 9),
      row("a", 1),
      row("b", 2),
      row("c", 3),
      row("d", 4),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });
});
