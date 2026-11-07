import { describe, expect, it } from "vitest";
import { catalogue as realCatalogue } from "../catalogue/data";
import type { Catalogue } from "../catalogue/types";
import { LEVEL_TEXT } from "../pages/browse-library";
import {
  buildLibraryModel,
  eyebrow,
  pathsUsing,
  relatedItems,
  safeResourceUrl,
} from "./library-data";
import {
  activeFilterCount,
  applyFilters,
  countByType,
  emptyFiltersText,
  NO_FILTERS,
  PAGE_SIZE,
  pageItems,
  paginate,
  parseQuery,
  searchItems,
  searchPaths,
  toSearchString,
} from "./library-filters";

const sample = buildLibraryModel(realCatalogue, true);
const valid = {
  topics: sample.topics.map((t) => t.slug),
  sources: sample.sources.map((s) => s.slug),
};
const params = (qs: string) => new URLSearchParams(qs);

describe("library model", () => {
  it("uses the design sample, flagged, while the catalogue is empty", () => {
    expect(sample.sample).toBe(true);
    expect(sample.items).toHaveLength(12);
    expect(sample.items.every((i) => i.sample && i.url === "")).toBe(true);
    expect(sample.items[0]?.topicSlug).toBe("ui-ux");
  });

  it("is empty, not sample, when the sample flag is off", () => {
    const off = buildLibraryModel(realCatalogue, false);
    expect(off.items).toEqual([]);
    expect(off.paths).toEqual([]);
    expect(off.sample).toBe(false);
    expect(off.totalLabel).toBe("0");
  });

  it("uses live resources over the sample", () => {
    const live: Catalogue = {
      ...realCatalogue,
      resources: [
        {
          id: "r1",
          title: "Real",
          url: "https://example.com/a",
          sourceSlug: "figma",
          format: "docs",
          lengthMinutes: 5,
          topicSlug: "brand",
          status: "live",
        },
        {
          id: "r2",
          title: "Hidden",
          url: "https://example.com/b",
          sourceSlug: "figma",
          format: "video",
          lengthMinutes: 5,
          topicSlug: "brand",
          status: "hidden",
        },
      ],
    };
    const model = buildLibraryModel(live, true);
    expect(model.sample).toBe(false);
    expect(model.items.map((i) => i.id)).toEqual(["r1"]);
    expect(model.items[0]?.kind).toBe("article");
    expect(model.items[0]?.topicSlug).toBe("brand");
  });

  it("lists the paths a resource is a lesson of, published only", () => {
    const cat: Catalogue = {
      ...realCatalogue,
      paths: [
        {
          slug: "a",
          title: "A",
          description: "",
          topicSlug: "brand",
          level: "beginner",
          status: "published",
        },
        {
          slug: "b",
          title: "B",
          description: "",
          topicSlug: "brand",
          level: "beginner",
          status: "draft",
        },
      ],
      pathLessons: [
        { pathSlug: "a", resourceId: "r", position: 1 },
        { pathSlug: "a", resourceId: "x", position: 0 },
        { pathSlug: "b", resourceId: "r", position: 0 },
      ],
    };
    expect(pathsUsing(cat, "r")).toEqual([
      { slug: "a", topicSlug: "brand", title: "A", lesson: 2, lessons: 2 },
    ]);
    expect(pathsUsing(cat, "none")).toEqual([]);
  });

  it("suggests same-topic items first and never the item itself", () => {
    const first = sample.items[0];
    if (!first) throw new Error("no sample");
    const related = relatedItems(first, sample.items, 2);
    expect(related).toHaveLength(2);
    expect(related.some((r) => r.id === first.id)).toBe(false);
    expect(related.every((r) => r.topicName === first.topicName)).toBe(true);
    expect(relatedItems(first, [first])).toEqual([]);
  });

  it("builds the eyebrow", () => {
    const first = sample.items[0];
    expect(first && eyebrow(first, (l) => LEVEL_TEXT[l])).toBe("VIDEO · UI/UX · BEGINNER");
  });

  it("only treats https URLs as openable", () => {
    expect(safeResourceUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(safeResourceUrl("")).toBeNull();
    expect(safeResourceUrl("http://example.com")).toBeNull();
    expect(safeResourceUrl("javascript:alert(1)")).toBeNull();
    expect(safeResourceUrl("not a url")).toBeNull();
  });
});

describe("filters", () => {
  it("parses the URL and drops unknown values", () => {
    const parsed = parseQuery(
      params("q=%20flows%20&topic=ui-ux&type=video&source=youtube&page=3"),
      valid,
    );
    expect(parsed).toEqual({
      q: "flows",
      filters: { topic: "ui-ux", type: "video", source: "youtube", page: 3 },
    });
    const bad = parseQuery(params("topic=nope&type=zip&source=x&page=-4"), valid);
    expect(bad.filters).toEqual(NO_FILTERS);
    expect(parseQuery(params("page=abc"), valid).filters.page).toBe(1);
  });

  it("caps a very long search", () => {
    expect(parseQuery(params(`q=${"a".repeat(500)}`), valid).q).toHaveLength(100);
  });

  it("round-trips through the query string and leaves defaults out", () => {
    expect(toSearchString({ q: "", filters: NO_FILTERS })).toBe("");
    const view = {
      q: "design systems",
      filters: { topic: "seo", type: "tool" as const, source: "moz", page: 2 },
    };
    expect(parseQuery(params(toSearchString(view)), valid)).toEqual(view);
  });

  it("filters by type, topic and source together", () => {
    expect(applyFilters(sample.items, { topic: "all", type: "video", source: "all" })).toHaveLength(
      5,
    );
    expect(
      applyFilters(sample.items, { topic: "ui-ux", type: "tool", source: "all" }).map(
        (i) => i.title,
      ),
    ).toEqual(["Colour contrast checker"]);
    expect(applyFilters(sample.items, { topic: "seo", type: "tool", source: "all" })).toEqual([]);
    expect(applyFilters(sample.items, { topic: "all", type: "all", source: "figma" })).toHaveLength(
      2,
    );
    expect(activeFilterCount({ ...NO_FILTERS, topic: "seo", type: "tool" })).toBe(2);
  });

  it("counts types within the chosen topic and source", () => {
    expect(countByType(sample.items, { topic: "all", source: "all" })).toEqual({
      all: 12,
      video: 5,
      article: 4,
      tool: 3,
    });
    expect(countByType(sample.items, { topic: "seo", source: "all" }).all).toBe(1);
  });

  it("searches every word across title, source, topic and type", () => {
    expect(searchItems(sample.items, "contrast")).toHaveLength(1);
    expect(searchItems(sample.items, "FIGMA video").map((i) => i.title)).toEqual([
      "Auto layout, explained",
    ]);
    expect(searchItems(sample.items, "  ")).toHaveLength(12);
    expect(searchItems(sample.items, "blender 3d")).toEqual([]);
  });

  it("searches paths by title and topic name", () => {
    const names = (slug: string) => sample.topics.find((t) => t.slug === slug)?.name ?? "";
    expect(searchPaths(sample.paths, "design systems", names).map((p) => p.title)).toContain(
      "Design Systems 101",
    );
    expect(searchPaths(sample.paths, "zzz", names)).toEqual([]);
  });

  it("explains an empty filter result", () => {
    expect(emptyFiltersText({ topic: "seo", type: "tool", source: "all" }, "SEO")).toBe(
      "There’s no SEO tools in the library yet. Try another type, or clear the filters.",
    );
    expect(emptyFiltersText({ topic: "seo", type: "all", source: "all" }, "SEO")).toContain(
      "no SEO resources",
    );
  });
});

describe("paging", () => {
  it("handles empty, partial and out-of-range pages", () => {
    expect(paginate(0, 1)).toEqual({ page: 1, pages: 1, from: 0, to: 0, total: 0 });
    expect(paginate(12, 1)).toMatchObject({ pages: 1, from: 1, to: 12 });
    expect(paginate(48, 4)).toMatchObject({ pages: 4, from: 37, to: 48 });
    expect(paginate(30, 99)).toMatchObject({ page: 3, from: 25, to: 30 });
    expect(PAGE_SIZE).toBe(12);
  });

  it("shows neighbours and gaps", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(2, 4)).toEqual([1, 2, 3, 4]);
    expect(pageItems(5, 12)).toEqual([1, "gap", 4, 5, 6, "gap", 12]);
  });
});
