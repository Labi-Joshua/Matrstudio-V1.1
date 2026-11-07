import { describe, expect, it } from "vitest";
import { catalogue as realCatalogue } from "../catalogue/data";
import type { Catalogue } from "../catalogue/types";
import { SAMPLE_RESOURCES } from "../pages/browse-library";
import { SAMPLE_PATHS } from "../pages/browse-paths";
import { ROUTES } from "../routes";
import {
  buildSearchView,
  emptyFiltersCopy,
  filterPaths,
  getCatalogueData,
  hasFilters,
  matchesQuery,
  NO_FILTERS,
  normaliseQuery,
  pathCount,
  pathHref,
  pickedBanner,
  visibleSections,
} from "./paths-catalogue";
import {
  aboutHours,
  buildPathDetail,
  lessonMeta,
  selectPath,
  sourceCountLabel,
  summariseSources,
} from "./paths-detail";

const topicName = (slug: string) => realCatalogue.topics.find((t) => t.slug === slug)?.name ?? slug;

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
      id: "r2",
      title: "Gone",
      url: "https://example.com/b",
      sourceSlug: "medium",
      format: "article",
      lengthMinutes: 5,
      topicSlug: "ui-ux",
      status: "broken",
    },
    {
      id: "r3",
      title: "Wireframes",
      url: "https://example.com/c",
      sourceSlug: "medium",
      format: "article",
      lengthMinutes: 9,
      topicSlug: "ui-ux",
      status: "live",
    },
  ],
  paths: [
    {
      slug: "real-path",
      title: "Real Path",
      description: "From the catalogue.",
      topicSlug: "ui-ux",
      level: "beginner",
      status: "published",
    },
    {
      slug: "draft-path",
      title: "Draft",
      description: "Not published.",
      topicSlug: "brand",
      level: "beginner",
      status: "draft",
    },
  ],
  pathLessons: [
    { pathSlug: "real-path", resourceId: "r3", position: 1 },
    { pathSlug: "real-path", resourceId: "r2", position: 2 },
    { pathSlug: "real-path", resourceId: "r1", position: 0 },
  ],
};

describe("catalogue data", () => {
  it("falls back to the design samples only while the catalogue has no published path", () => {
    expect(getCatalogueData(realCatalogue, true)).toEqual({ paths: SAMPLE_PATHS, sample: true });
    expect(getCatalogueData(realCatalogue, false)).toEqual({ paths: [], sample: false });
    const real = getCatalogueData(published, true);
    expect(real.sample).toBe(false);
    expect(real.paths.map((p) => p.slug)).toEqual(["real-path"]);
  });

  it("counts paths with the right plural", () => {
    expect(pathCount(1)).toBe("1 path");
    expect(pathCount(8)).toBe("8 paths");
    expect(pathCount(0)).toBe("0 paths");
  });
});

describe("topic and level filters", () => {
  it("returns everything with no filters and nothing from an empty list", () => {
    expect(filterPaths(SAMPLE_PATHS, NO_FILTERS)).toHaveLength(SAMPLE_PATHS.length);
    expect(filterPaths([], { topic: "ui-ux", level: "all" })).toEqual([]);
    expect(hasFilters(NO_FILTERS)).toBe(false);
  });

  it("filters by topic, by level and by both", () => {
    expect(filterPaths(SAMPLE_PATHS, { topic: "ui-ux", level: "all" })).toHaveLength(2);
    expect(filterPaths(SAMPLE_PATHS, { topic: "all", level: "intermediate" })).toHaveLength(2);
    expect(filterPaths(SAMPLE_PATHS, { topic: "ui-ux", level: "advanced" })).toHaveLength(1);
    expect(hasFilters({ topic: "ui-ux", level: "all" })).toBe(true);
  });

  it("finds nothing for the combination the Figma 'no match' frame shows", () => {
    expect(filterPaths(SAMPLE_PATHS, { topic: "dev-handoff", level: "advanced" })).toEqual([]);
  });

  it("words the empty state for both filters, one filter and the actions it offers", () => {
    const both = emptyFiltersCopy({ topic: "dev-handoff", level: "advanced" }, "Dev handoff");
    expect(both.body).toBe(
      "There’s no advanced Dev handoff path yet. Try another level, or clear the filters.",
    );
    expect(both.actions.map((a) => a.label)).toEqual(["Clear filters", "Show all levels"]);
    const level = emptyFiltersCopy({ topic: "all", level: "advanced" }, null);
    expect(level.actions.map((a) => a.id)).toEqual(["all-levels"]);
    const topic = emptyFiltersCopy({ topic: "seo", level: "all" }, "SEO");
    expect(topic.actions.map((a) => a.id)).toEqual(["all-topics"]);
  });
});

describe("search", () => {
  it("normalises the query: whitespace, length, empty", () => {
    expect(normaliseQuery("  design   systems ")).toBe("design systems");
    expect(normaliseQuery("   ")).toBeNull();
    expect(normaliseQuery(null)).toBeNull();
    expect(normaliseQuery("x".repeat(300))).toHaveLength(100);
  });

  it("matches every word, ignoring case and accents", () => {
    expect(matchesQuery("Design Systems 101", "design systems")).toBe(true);
    expect(matchesQuery("Design Systems 101", "systems design")).toBe(true);
    expect(matchesQuery("Design Systems 101", "design blender")).toBe(false);
    expect(matchesQuery("Café design", "cafe")).toBe(true);
  });

  it("finds paths and resources, with a summary and counts", () => {
    const view = buildSearchView("design systems", SAMPLE_PATHS, SAMPLE_RESOURCES, topicName);
    expect(view.paths.map((p) => p.title)).toContain("Design Systems 101");
    expect(view.total).toBe(view.paths.length + view.resources.length);
    expect(view.summary).toBe(
      `${pathCount(view.paths.length)} and ${view.resources.length} ${view.resources.length === 1 ? "resource" : "resources"}`,
    );
  });

  it("matches a path through its topic name and level", () => {
    const byTopic = buildSearchView("seo", SAMPLE_PATHS, [], topicName);
    expect(byTopic.paths.map((p) => p.slug)).toContain("seo-for-designers");
    const byLevel = buildSearchView("advanced", SAMPLE_PATHS, [], topicName);
    expect(byLevel.paths.map((p) => p.slug)).toContain("advanced-prototyping");
  });

  it("returns an empty view for a query nothing matches and for empty inputs", () => {
    const none = buildSearchView("blender 3d", SAMPLE_PATHS, SAMPLE_RESOURCES, topicName);
    expect(none.total).toBe(0);
    expect(none.summary).toBe("0 paths and 0 resources");
    expect(buildSearchView("anything", [], [], topicName).total).toBe(0);
  });

  it("shows the sections a result type asks for, and none that are empty", () => {
    const both = { paths: SAMPLE_PATHS.slice(0, 2), resources: SAMPLE_RESOURCES.slice(0, 3) };
    expect(visibleSections(both, "all")).toEqual({ paths: true, resources: true });
    expect(visibleSections(both, "paths")).toEqual({ paths: true, resources: false });
    expect(visibleSections(both, "resources")).toEqual({ paths: false, resources: true });
    expect(visibleSections({ paths: [], resources: both.resources }, "all")).toEqual({
      paths: false,
      resources: true,
    });
  });
});

describe("start-here banner and links", () => {
  const answers = (over: Partial<{ goal: string; level: string; topics: string[] }> = {}) => ({
    goal: "learn_new_skill",
    level: "beginner",
    topics: ["ui-ux"],
    ...over,
  });

  it("recommends the matching path and echoes the answers, as the Figma frame does", () => {
    const banner = pickedBanner(SAMPLE_PATHS, answers());
    expect(banner?.title).toBe("Start here: UI/UX Design Foundations");
    expect(banner?.summary).toBe(
      "Picked from your onboarding answers: learn a new skill, beginner, UI/UX. 12 lessons, about 8 hrs.",
    );
  });

  it("leaves the banner out without topics, with unknown topics, or without paths", () => {
    expect(pickedBanner(SAMPLE_PATHS, answers({ topics: [] }))).toBeNull();
    expect(pickedBanner(SAMPLE_PATHS, answers({ topics: ["nope"] }))).toBeNull();
    expect(pickedBanner([], answers())).toBeNull();
  });

  it("links a topic's first path to the topic and its other paths with ?path=", () => {
    const [first, ...rest] = SAMPLE_PATHS.filter((p) => p.topicSlug === "ui-ux");
    const advanced = rest[0];
    if (!first || !advanced) throw new Error("sample paths changed");
    expect(pathHref(first, SAMPLE_PATHS)).toBe(ROUTES.app.pathTopic("ui-ux"));
    expect(pathHref(advanced, SAMPLE_PATHS)).toBe(
      `${ROUTES.app.pathTopic("ui-ux")}?path=advanced-prototyping`,
    );
    const solo = SAMPLE_PATHS.find((p) => p.topicSlug === "seo");
    expect(solo && pathHref(solo, SAMPLE_PATHS)).toBe(ROUTES.app.pathTopic("seo"));
  });

  it("never links to the public marketing pages", () => {
    for (const path of SAMPLE_PATHS) {
      expect(pathHref(path, SAMPLE_PATHS).startsWith("/learn/")).toBe(true);
    }
  });
});

describe("path detail", () => {
  it("selects the topic's first path, a named sibling, or nothing", () => {
    expect(selectPath(SAMPLE_PATHS, "ui-ux", null)?.slug).toBe("ui-ux-design-foundations");
    expect(selectPath(SAMPLE_PATHS, "ui-ux", "advanced-prototyping")?.title).toBe(
      "Advanced Prototyping",
    );
    expect(selectPath(SAMPLE_PATHS, "ui-ux", "seo-for-designers")).toBeNull();
    expect(selectPath([], "ui-ux", null)).toBeNull();
  });

  it("builds the Figma Product Design Essentials page from the sample", () => {
    const view = buildPathDetail(realCatalogue, "product", null, true);
    expect(view?.sample).toBe(true);
    expect(view?.lessons).toHaveLength(10);
    expect(view?.lessonsComplete).toBe(true);
    expect(view?.outcomes).toHaveLength(4);
    expect(view?.audience).toHaveLength(3);
    expect(view?.startUrl).toBeNull();
    expect(view?.sources.map((s) => sourceCountLabel(s))).toEqual([
      "6 videos",
      "2 articles",
      "2 articles",
    ]);
    expect(view && lessonMeta(view.lessons[0] as never)).toBe("Video · 12 min · YouTube");
    expect(view && lessonMeta(view.lessons[1] as never)).toBe("Article · 10 min read · Medium");
  });

  it("shows only what the frames show for other sample paths", () => {
    const foundations = buildPathDetail(realCatalogue, "ui-ux", null, true);
    expect(foundations?.lessons).toHaveLength(3);
    expect(foundations?.lessonsComplete).toBe(false);
    expect(foundations?.sources).toEqual([]);
    expect(foundations?.siblings.map((p) => p.slug)).toEqual(["advanced-prototyping"]);
    const seo = buildPathDetail(realCatalogue, "seo", null, true);
    expect(seo?.lessons).toEqual([]);
    expect(seo?.outcomes).toEqual([]);
  });

  it("returns null (the 'not available' state) for a topic or ?path= with no path", () => {
    expect(buildPathDetail(realCatalogue, "seo", null, false)).toBeNull();
    expect(buildPathDetail(realCatalogue, "ui-ux", "nope", true)).toBeNull();
  });

  it("uses real catalogue data: ordered live lessons, source URL, Start path link", () => {
    const view = buildPathDetail(published, "ui-ux", null, true);
    expect(view?.sample).toBe(false);
    expect(view?.lessons.map((l) => l.title)).toEqual(["Mapping flows", "Wireframes"]);
    expect(view?.startUrl).toBe("https://example.com/a");
    expect(view?.lessons[1]?.sourceName).toBe("Medium");
    expect(view?.outcomes).toEqual([]);
    expect(buildPathDetail(published, "brand", null, true)).toBeNull();
  });

  it("formats hours and groups sources", () => {
    expect(aboutHours(7)).toBe("about 7 hrs");
    expect(aboutHours(0)).toBeNull();
    const grouped = summariseSources([
      { title: "a", kind: "video", minutes: 1, sourceName: "YouTube", url: null },
      { title: "b", kind: "video", minutes: 1, sourceName: "YouTube", url: null },
      { title: "c", kind: "article", minutes: 1, sourceName: null, url: null },
    ]);
    expect(grouped).toEqual([{ name: "YouTube", kind: "video", count: 2 }]);
    expect(sourceCountLabel({ name: "x", kind: "video", count: 1 })).toBe("1 video");
  });
});
