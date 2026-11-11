import { describe, expect, it } from "vitest";
import { queryString } from "./api";
import { durationLabel, isHttpUrl, parseMinutes, relativeDay, savedAgo } from "./format";
import { parsePathDoc, parsePathList, parseResourceList } from "./parse";
import { lessonsNeedingIntro, moveLesson, stepLesson, stepModule } from "./reorder";
import type { Lesson, Module } from "./types";

const lesson = (id: string, intro = "x"): Lesson => ({
  id,
  resourceId: `r-${id}`,
  title: id,
  source: "",
  type: "video",
  durationMin: 5,
  intro,
});
const mods = (): Module[] => [
  { id: "m1", title: "One", lessons: [lesson("a"), lesson("b")] },
  { id: "m2", title: "Two", lessons: [lesson("c")] },
  { id: "m3", title: "Three", lessons: [] },
];
const ids = (m: Module[]) => m.map((x) => x.lessons.map((l) => l.id).join(""));

describe("reorder", () => {
  it("moves within a module", () => {
    expect(ids(stepLesson(mods(), "a", 1))).toEqual(["ba", "c", ""]);
    expect(ids(stepLesson(mods(), "b", -1))).toEqual(["ba", "c", ""]);
  });
  it("crosses into the neighbouring module at the edges", () => {
    expect(ids(stepLesson(mods(), "b", 1))).toEqual(["a", "bc", ""]);
    expect(ids(stepLesson(mods(), "c", -1))).toEqual(["abc", "", ""]);
    expect(ids(stepLesson(mods(), "c", 1))).toEqual(["ab", "", "c"]);
  });
  it("does nothing past the ends", () => {
    expect(ids(stepLesson(mods(), "a", -1))).toEqual(["ab", "c", ""]);
  });
  it("moves to an index in any module", () => {
    expect(ids(moveLesson(mods(), "a", 2, 0))).toEqual(["b", "c", "a"]);
    expect(ids(moveLesson(mods(), "c", 0, 1))).toEqual(["acb", "", ""]);
  });
  it("keeps lessons untouched for unknown ids", () => {
    const m = mods();
    expect(moveLesson(m, "zzz", 0, 0)).toBe(m);
  });
  it("moves modules", () => {
    expect(stepModule(mods(), "m1", 1).map((m) => m.id)).toEqual(["m2", "m1", "m3"]);
    expect(stepModule(mods(), "m1", -1).map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
  });
  it("counts lessons without an intro", () => {
    const m = mods();
    (m[0] as Module).lessons[0] = lesson("a", "  ");
    expect(lessonsNeedingIntro(m)).toBe(1);
  });
});

describe("format", () => {
  it("labels durations", () => {
    expect(durationLabel(18)).toBe("18 min");
    expect(durationLabel(9, "article")).toBe("9 min read");
    expect(durationLabel(125)).toBe("2 h 5 min");
    expect(durationLabel(null)).toBe("");
  });
  it("reads minutes and urls", () => {
    expect(parseMinutes("16 min")).toBe(16);
    expect(parseMinutes("")).toBeNull();
    expect(isHttpUrl("https://youtube.com/watch?v=1")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("youtube.com")).toBe(false);
  });
  it("says how long ago", () => {
    const now = new Date(2026, 10, 11, 12);
    expect(relativeDay(new Date(2026, 10, 11, 3).toISOString(), now)).toBe("Today");
    expect(relativeDay(new Date(2026, 10, 8).toISOString(), now)).toBe("3 days ago");
    expect(relativeDay(null, now)).toBe("—");
    const t = Date.UTC(2026, 10, 11, 12);
    expect(savedAgo(new Date(t - 120_000).toISOString(), t)).toBe("2 min ago");
    expect(savedAgo(null, t)).toBe("not saved yet");
  });
  it("builds query strings without empty or all values", () => {
    expect(queryString({ tab: "all", q: "", type: undefined, topic: "UI and UX" })).toBe(
      "?tab=all&topic=UI+and+UX",
    );
    expect(queryString({})).toBe("");
  });
});

describe("parsers", () => {
  it("accepts a resource list and defaults missing fields", () => {
    const list = parseResourceList({
      items: [{ id: "1", title: "T", status: "live", type: "video" }],
      nextCursor: null,
      counts: { total: 3 },
    });
    expect(list?.items[0]?.level).toBe("beginner");
    expect(list?.counts.total).toBe(3);
  });
  it("rejects wrong shapes", () => {
    expect(parseResourceList({ items: [{ id: 1 }] })).toBeUndefined();
    expect(parseResourceList(null)).toBeUndefined();
    expect(parsePathList({ items: "no" })).toBeUndefined();
    expect(parsePathDoc({ id: "p" })).toBeUndefined();
  });
  it("parses a path with modules", () => {
    const doc = parsePathDoc({
      id: "p",
      title: "P",
      modules: [{ id: "m", title: "M", lessons: [{ id: "l", title: "L" }] }],
    });
    expect(doc?.modules[0]?.lessons[0]?.intro).toBe("");
    expect(doc?.status).toBe("draft");
  });
});
