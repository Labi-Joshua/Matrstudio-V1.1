import { describe, expect, it } from "vitest";
import {
  accessFor,
  insertVariable,
  move,
  nudgeError,
  renderTemplate,
  tabFromSearch,
  taxonomyNameError,
  toggleDay,
  unknownVariables,
  withCurrent,
} from "./logic";
import {
  parseHomeCuration,
  parseNudgeRules,
  parseQueueTargets,
  parseTaxonomy,
  parseTemplates,
} from "./parse";

describe("accessFor", () => {
  it("shows every tab to settings:manage, editable", () => {
    const a = accessFor({ settings: "manage", resources: "manage" });
    expect(a.tabs).toHaveLength(5);
    expect(a.editable).toHaveLength(5);
  });
  it("gives a curator only Home curation", () => {
    expect(accessFor({ settings: "none", resources: "manage" })).toEqual({
      tabs: ["home"],
      editable: ["home"],
    });
  });
  it("is read-only for settings:view without resources", () => {
    const a = accessFor({ settings: "view", resources: "view" });
    expect(a.tabs).toHaveLength(5);
    expect(a.editable).toEqual([]);
  });
  it("shows nothing without any access", () => {
    expect(accessFor({ settings: "none", resources: "view" }).tabs).toEqual([]);
  });
});

describe("tabFromSearch", () => {
  it("honours an allowed tab and falls back to the first", () => {
    expect(tabFromSearch("?tab=nudges", ["home", "nudges"])).toBe("nudges");
    expect(tabFromSearch("?tab=nudges", ["home"])).toBe("home");
    expect(tabFromSearch("", [])).toBeUndefined();
  });
});

describe("list helpers", () => {
  it("moves items and ignores bad indexes", () => {
    expect(move([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(move([1, 2, 3], 0, 5)).toEqual([1, 2, 3]);
  });
  it("toggles weekdays in week order", () => {
    expect(toggleDay(["mon", "wed"], "tue")).toEqual(["mon", "tue", "wed"]);
    expect(toggleDay(["mon"], "mon")).toEqual([]);
  });
  it("keeps an unusual stored option selectable", () => {
    expect(withCurrent([2, 3], 4)).toEqual([2, 3, 4]);
    expect(withCurrent([2, 3], 3)).toEqual([2, 3]);
  });
});

describe("taxonomyNameError", () => {
  const items = [{ id: "1", kind: "tag" as const, name: "UX", resources: 1, paths: 0 }];
  it("rejects empty, long and duplicate names", () => {
    expect(taxonomyNameError(" ", "tag", items)).toBeTruthy();
    expect(taxonomyNameError("x".repeat(61), "tag", items)).toBeTruthy();
    expect(taxonomyNameError("ux", "tag", items)).toMatch(/already exists/);
    expect(taxonomyNameError("ux", "tag", items, "1")).toBeNull();
    expect(taxonomyNameError("ux", "topic", items)).toBeNull();
  });
});

describe("templates", () => {
  it("fills known variables and leaves unknown ones", () => {
    expect(renderTemplate("{first_name}, {nope}", { first_name: "Ada" })).toBe("Ada, {nope}");
  });
  it("lists variables the template does not offer", () => {
    expect(unknownVariables("{a} {b} {b}", ["a"])).toEqual(["b"]);
  });
  it("inserts at the selection", () => {
    expect(insertVariable("Hi !", 3, 3, "name")).toEqual({ text: "Hi {name}!", caret: 9 });
  });
});

describe("nudgeError", () => {
  it("needs the second after the first", () => {
    expect(nudgeError(3, 7)).toBeNull();
    expect(nudgeError(7, 7)).toBeTruthy();
  });
});

describe("parsers", () => {
  it("parses taxonomy lists, bare or wrapped, and rejects bad rows", () => {
    const row = { id: "a", kind: "topic", name: "Brand", resources: 2, paths: 1 };
    expect(parseTaxonomy({ items: [row] })).toEqual([row]);
    expect(parseTaxonomy([row])).toEqual([row]);
    expect(parseTaxonomy({ items: [{ id: "a" }] })).toBeUndefined();
    expect(parseTaxonomy("x")).toBeUndefined();
  });
  it("parses home curation with default rules", () => {
    const out = parseHomeCuration({
      featuredPaths: [{ id: "p", title: "Path", level: "Beginner", learners: 5 }],
      libraryPicks: [],
    });
    expect(out?.featuredPaths[0]?.learners).toBe(5);
    expect(out?.popular.window).toBe("30d");
    expect(parseHomeCuration({ featuredPaths: 3 })).toBeUndefined();
  });
  it("parses templates and strips braces from variable names", () => {
    const out = parseTemplates({
      items: [{ key: "k", name: "K", subject: "s", body: "b", variables: ["{x}", "y"] }],
    });
    expect(out?.[0]?.variables).toEqual(["x", "y"]);
  });
  it("parses nudge rules and queue targets", () => {
    expect(
      parseNudgeRules({ enabled: true, firstAfterDays: 3, secondAfterDays: 7, maxPerWeek: 1 }),
    ).toBeTruthy();
    expect(parseNudgeRules({ enabled: "yes" })).toBeUndefined();
    const t = parseQueueTargets({
      submissionDays: 5,
      linkReportDays: 2,
      firstReplyDays: 2,
      autoResolveDays: 7,
      workingDays: ["fri", "mon", "x"],
    });
    expect(t?.workingDays).toEqual(["mon", "fri"]);
  });
});
