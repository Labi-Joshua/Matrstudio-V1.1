import { describe, expect, it } from "vitest";
import { catalogue } from "../catalogue/data";
import { COMMAND_PAGES } from "./command-items";
import {
  highlightSegments,
  MAX_COMMAND_QUERY,
  normaliseCommandQuery,
  queryTerms,
  rankItems,
  scoreItem,
} from "./command-match";
import { addRecent, MAX_RECENT, moveActive, parseRecent } from "./command-recent";
import {
  buildCommandIndex,
  emptyGroups,
  flattenGroups,
  GROUP_LIMITS,
  searchGroups,
  seeAllHref,
  seeAllRow,
} from "./command-search";

describe("query handling", () => {
  it("trims, collapses whitespace and caps the length", () => {
    expect(normaliseCommandQuery("  design   systems \n")).toBe("design systems");
    expect(normaliseCommandQuery("a".repeat(500))).toHaveLength(MAX_COMMAND_QUERY);
    expect(queryTerms("  Design  SYSTEMS ")).toEqual(["design", "systems"]);
    expect(queryTerms("   ")).toEqual([]);
  });
});

describe("scoring", () => {
  const terms = (q: string) => queryTerms(q);
  it("ranks title prefix over word prefix over substring over secondary", () => {
    const prefix = scoreItem({ title: "Colour theory" }, terms("col")) ?? 0;
    const word = scoreItem({ title: "Theory of colour" }, terms("col")) ?? 0;
    const sub = scoreItem({ title: "Protocol basics" }, terms("col")) ?? 0;
    const topic = scoreItem({ title: "Basics", secondary: ["Colour"] }, terms("col")) ?? 0;
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(sub);
    expect(sub).toBeGreaterThan(topic);
    expect(topic).toBeGreaterThan(0);
  });
  it("needs every word to match and is case-insensitive", () => {
    expect(scoreItem({ title: "Auto layout, explained" }, terms("LAYOUT auto"))).not.toBeNull();
    expect(scoreItem({ title: "Auto layout" }, terms("auto zebra"))).toBeNull();
    expect(scoreItem({ title: "Anything" }, [])).toBeNull();
  });
  it("treats regex characters as plain text", () => {
    expect(scoreItem({ title: "UI/UX basics" }, terms("(.*"))).toBeNull();
    expect(scoreItem({ title: "C++ (intro)" }, terms("c++"))).not.toBeNull();
  });
  it("keeps the original order on ties and honours the limit", () => {
    const items = [{ title: "Beta one" }, { title: "Beta two" }, { title: "Beta three" }];
    expect(rankItems(items, terms("beta"), 2).map((i) => i.title)).toEqual([
      "Beta one",
      "Beta two",
    ]);
    expect(rankItems(items, terms("beta"), 0)).toEqual([]);
  });
});

describe("highlightSegments", () => {
  it("marks every matched word as plain text segments", () => {
    expect(highlightSegments("Design systems in Figma", ["sys", "fig"])).toEqual([
      { text: "Design ", match: false },
      { text: "sys", match: true },
      { text: "tems in ", match: false },
      { text: "Fig", match: true },
      { text: "ma", match: false },
    ]);
  });
  it("never interprets markup", () => {
    const out = highlightSegments("<b>x</b>", ["b"]);
    expect(out.map((s) => s.text).join("")).toBe("<b>x</b>");
    expect(highlightSegments("", ["a"])).toEqual([]);
  });
});

describe("palette content", () => {
  const index = buildCommandIndex(catalogue);
  it("shows jump pages first, then recent searches with a clear row", () => {
    const none = emptyGroups([]);
    expect(none.map((g) => g.id)).toEqual(["jump"]);
    expect(none[0]?.rows.map((r) => r.title)).toEqual([
      "Home",
      "Paths",
      "Library",
      "Saved",
      "Help centre",
      "Profile",
      "Settings",
      "Your requests",
      "Submit a resource",
    ]);
    const some = emptyGroups(["figma", "seo"]);
    expect(some[1]?.rows.map((r) => r.title)).toEqual(["figma", "seo", "Clear recent searches"]);
  });
  it("groups typed results and flags sample content", () => {
    const groups = searchGroups(index, "design");
    expect(groups.map((g) => g.id)).toContain("paths");
    expect(groups.map((g) => g.id)).toContain("resources");
    for (const g of groups) {
      expect(g.rows.length).toBeLessThanOrEqual(
        GROUP_LIMITS[g.id as keyof typeof GROUP_LIMITS] ?? 99,
      );
    }
    expect(
      flattenGroups(groups)
        .filter((r) => r.group !== "pages")
        .every((r) => r.sample),
    ).toBe(true);
    expect(new Set(flattenGroups(groups).map((r) => r.id)).size).toBe(flattenGroups(groups).length);
  });
  it("finds pages and the theme actions, and nothing for nonsense", () => {
    const pages = searchGroups(index, "dark").find((g) => g.id === "pages");
    expect(pages?.rows[0]?.action).toEqual({ kind: "theme", value: "dark" });
    expect(searchGroups(index, "submit")[0]?.rows[0]?.action).toEqual({ kind: "submit" });
    expect(searchGroups(index, "zzzzqq")).toEqual([]);
    expect(searchGroups(index, "   ")).toEqual([]);
  });
  it("builds the see-all row for the results page", () => {
    expect(seeAllHref("  design systems ")).toBe("/learn/library?q=design%20systems");
    expect(seeAllRow("a&b").action).toEqual({ kind: "navigate", href: "/learn/library?q=a%26b" });
  });
  it("has unique page ids", () => {
    expect(new Set(COMMAND_PAGES.map((p) => p.id)).size).toBe(COMMAND_PAGES.length);
  });
});

describe("recent searches", () => {
  it("puts the newest first, dedupes and caps", () => {
    expect(addRecent(["a", "b"], "B")).toEqual(["B", "a"]);
    let list: string[] = [];
    for (const q of ["1", "2", "3", "4", "5", "6"]) list = addRecent(list, q);
    expect(list).toEqual(["6", "5", "4", "3", "2"]);
    expect(list).toHaveLength(MAX_RECENT);
    expect(addRecent(["a"], "   ")).toEqual(["a"]);
  });
  it("reads stored data defensively", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("not json")).toEqual([]);
    expect(parseRecent('{"a":1}')).toEqual([]);
    expect(parseRecent('["a", 3, "", "a", " b "]')).toEqual(["a", "b"]);
  });
});

describe("moveActive", () => {
  it("wraps, and Home/End jump", () => {
    expect(moveActive(null, 3, "ArrowDown")).toBe(0);
    expect(moveActive(null, 3, "ArrowUp")).toBe(2);
    expect(moveActive(2, 3, "ArrowDown")).toBe(0);
    expect(moveActive(0, 3, "ArrowUp")).toBe(2);
    expect(moveActive(1, 3, "Home")).toBe(0);
    expect(moveActive(1, 3, "End")).toBe(2);
    expect(moveActive(0, 0, "ArrowDown")).toBeNull();
  });
});
