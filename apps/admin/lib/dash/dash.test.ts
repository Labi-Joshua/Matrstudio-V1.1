import { describe, expect, it } from "vitest";
import { linePath, niceScale, xAt } from "./chart-math";
import { addMonths, monthGrid, shiftDay } from "./calendar";
import { computeDelta, formatMinutes, formatStatValue, lastSearched, relativeTime } from "./format";
import { parseDashboard, parseLearners, parsePaths, parseStat } from "./parse";
import {
  parseRangeSearch,
  previousLabel,
  rangeLabel,
  rangeQuery,
  validateCustomRange,
} from "./range";
import type { Stat } from "./types";

const stat = (over: Partial<Stat>): Stat => ({
  key: "k",
  label: "L",
  value: 10,
  previous: 5,
  unit: "count",
  better: "up",
  compare: "relative",
  ...over,
});

describe("range", () => {
  it("builds the query and labels", () => {
    expect(rangeQuery({ key: "30d" })).toBe("range=30d");
    expect(rangeQuery({ key: "custom", from: "2026-10-01", to: "2026-10-12" })).toBe(
      "range=custom&from=2026-10-01&to=2026-10-12",
    );
    expect(rangeLabel({ key: "custom", from: "2026-10-01", to: "2026-10-12" })).toBe(
      "1 Oct – 12 Oct",
    );
    expect(previousLabel({ key: "custom", from: "2026-10-01", to: "2026-10-12" })).toBe(
      "previous 12 days",
    );
    expect(previousLabel({ key: "today" })).toBe("previous day");
  });
  it("parses the address bar and falls back", () => {
    expect(parseRangeSearch("?range=90d")).toEqual({ key: "90d" });
    expect(parseRangeSearch("?range=custom&from=2026-10-12&to=2026-10-01")).toEqual({ key: "7d" });
    expect(parseRangeSearch("?range=nope")).toEqual({ key: "7d" });
  });
  it("validates custom ranges", () => {
    expect(validateCustomRange("2026-10-01", "2026-10-12", "2026-11-11")).toBeNull();
    expect(validateCustomRange("2026-10-12", "2026-10-01", "2026-11-11")).toMatch(/on or after/);
    expect(validateCustomRange("2026-10-01", "2026-12-01", "2026-11-11")).toMatch(/future/);
    expect(validateCustomRange("2024-01-01", "2026-01-01", "2026-11-11")).toMatch(/year/);
    expect(validateCustomRange("", "", "2026-11-11")).toMatch(/Pick/);
  });
});

describe("calendar", () => {
  it("lays out a Monday-first month", () => {
    const rows = monthGrid({ year: 2026, month: 10 }); // Nov 2026 starts on Sunday
    expect(rows[0]?.indexOf("2026-11-01")).toBe(6);
    expect(rows.every((r) => r.length === 7)).toBe(true);
    expect(rows.flat().filter(Boolean)).toHaveLength(30);
  });
  it("moves months and days across boundaries", () => {
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("format", () => {
  it("formats durations", () => {
    expect(formatMinutes(580)).toBe("9h 40m");
    expect(formatMinutes(665)).toBe("11h 05m");
    expect(formatMinutes(540)).toBe("9h");
    expect(formatMinutes(-20)).toBe("20m");
    expect(formatStatValue({ value: 46, unit: "percent" })).toBe("46%");
    expect(formatStatValue({ value: 1284, unit: "count" })).toBe("1,284");
  });
  it("computes deltas with tone", () => {
    expect(computeDelta(stat({ value: 112, previous: 100 }))).toMatchObject({
      text: "+12%",
      tone: "good",
    });
    expect(
      computeDelta(stat({ value: 5, previous: 7, compare: "absolute", better: "down" })),
    ).toMatchObject({
      text: "−2",
      tone: "good",
    });
    expect(
      computeDelta(stat({ value: 12, previous: 9, compare: "absolute", better: "down" })),
    ).toMatchObject({
      text: "+3",
      tone: "bad",
    });
    expect(
      computeDelta(stat({ value: 71, previous: 66, unit: "percent", compare: "absolute" })),
    ).toMatchObject({ text: "+5 pts", tone: "good" });
    expect(
      computeDelta(
        stat({ value: 560, previous: 580, unit: "minutes", compare: "absolute", better: "down" }),
      ),
    ).toMatchObject({ text: "−20m", tone: "good" });
    expect(computeDelta(stat({ previous: null }))).toBeUndefined();
    expect(computeDelta(stat({ value: 3, previous: 0 }))?.text).toBe("New");
    expect(computeDelta(stat({ value: 3, previous: 3 }))).toMatchObject({
      text: "0%",
      tone: "neutral",
    });
  });
  it("words times", () => {
    const now = Date.parse("2026-11-11T12:00:00Z");
    expect(relativeTime("2026-11-11T11:50:00Z", now)).toBe("10m ago");
    expect(relativeTime("2026-11-10T09:00:00Z", now)).toBe("yesterday");
    expect(lastSearched(null)).toBe("—");
    expect(lastSearched("2026-11-11T10:12:00", new Date("2026-11-11T15:00:00"))).toBe(
      "Today, 10:12",
    );
    expect(lastSearched("2026-11-10T10:12:00", new Date("2026-11-11T15:00:00"))).toBe("Yesterday");
  });
});

describe("chart math", () => {
  it("picks round ticks", () => {
    expect(niceScale(3906).ticks).toEqual([0, 1000, 2000, 3000, 4000]);
    expect(niceScale(0).max).toBe(1);
    expect(niceScale(7).max).toBe(8);
  });
  it("breaks lines at gaps", () => {
    expect(linePath([{ x: 0, y: 1 }, null, { x: 2, y: 3 }, { x: 3, y: 4 }])).toBe(
      "M0.0 1.0M2.0 3.0L3.0 4.0",
    );
    expect(xAt(0, 1, 0, 100)).toBe(50);
    expect(xAt(3, 7, 0, 60)).toBe(30);
  });
});

describe("parsers", () => {
  it("accepts a dashboard and applies defaults", () => {
    const d = parseDashboard({
      variant: "curator",
      stats: [{ key: "a", label: "A", value: 1, previous: null }],
      queue: [{ id: "1", kind: "submission", title: "T", meta: "m", href: "/review" }],
    });
    expect(d?.variant).toBe("curator");
    expect(d?.queueTitle).toBe("Your queue");
    expect(d?.noResultSearches).toBeNull();
    expect(d?.queue[0]?.overTarget).toBe(false);
  });
  it("rejects wrong shapes", () => {
    expect(parseDashboard(null)).toBeUndefined();
    expect(parseDashboard({ stats: "no" })).toBeUndefined();
    expect(parseStat({ key: "a", label: "A" })).toBeUndefined();
    expect(parsePaths({ rows: [{ id: "x" }] })).toBeUndefined();
    expect(
      parseLearners({
        stats: [],
        funnel: [],
        weekly: { title: "t", labels: ["a"], current: [1], previous: [] },
      }),
    ).toBeUndefined();
  });
});
