import { describe, expect, it } from "vitest";
import { catalogue as launchCatalogue } from "./data";
import { lessonsOf, pathHours, sourcesByResourceCount, topicStats } from "./derive";
import type { Catalogue, Resource } from "./types";

// Fixture only: invented data for the tests, never shown anywhere.
const resource = (
  id: string,
  sourceSlug: string,
  lengthMinutes: number,
  status: Resource["status"] = "live",
): Resource => ({
  id,
  title: id,
  url: `https://example.com/${id}`,
  sourceSlug,
  format: "article",
  lengthMinutes,
  topicSlug: "ui-ux",
  status,
});

const fixture: Catalogue = {
  topics: [
    { slug: "ui-ux", name: "UI/UX" },
    { slug: "brand", name: "Brand" },
  ],
  sources: [
    { slug: "a", name: "A", domain: "a.example" },
    { slug: "b", name: "B", domain: "b.example" },
    { slug: "c", name: "C", domain: "c.example" },
  ],
  resources: [
    resource("r1", "a", 30),
    resource("r2", "b", 45),
    resource("r3", "b", 15),
    resource("r4", "c", 60, "broken"),
    resource("r5", "a", 20),
  ],
  paths: [
    {
      slug: "p1",
      title: "P1",
      description: "",
      topicSlug: "ui-ux",
      level: "beginner",
      status: "published",
    },
    {
      slug: "p2",
      title: "P2",
      description: "",
      topicSlug: "ui-ux",
      level: "advanced",
      status: "published",
    },
    {
      slug: "p3",
      title: "P3",
      description: "",
      topicSlug: "ui-ux",
      level: "intermediate",
      status: "draft",
    },
    {
      slug: "p4",
      title: "P4",
      description: "",
      topicSlug: "brand",
      level: "beginner",
      status: "archived",
    },
  ],
  pathLessons: [
    { pathSlug: "p1", resourceId: "r2", position: 1 },
    { pathSlug: "p1", resourceId: "r1", position: 0 },
    { pathSlug: "p2", resourceId: "r3", position: 0 },
    { pathSlug: "p3", resourceId: "r5", position: 0 },
    { pathSlug: "p4", resourceId: "r4", position: 0 },
  ],
};

describe("lessonsOf", () => {
  it("returns a path's lessons in position order", () => {
    expect(lessonsOf(fixture, "p1").map((l) => l.resourceId)).toEqual(["r1", "r2"]);
  });
});

describe("pathHours", () => {
  it("sums lesson lengths into hours, to one decimal", () => {
    expect(pathHours(fixture, "p1")).toBe(1.3); // 30 + 45 min = 75 min
    expect(pathHours(fixture, "p2")).toBe(0.3); // 15 min
  });

  it("is zero for a path with no lessons", () => {
    expect(pathHours(fixture, "missing")).toBe(0);
  });
});

describe("topicStats", () => {
  it("counts only published paths, with their lessons, hours and levels in order", () => {
    expect(topicStats(fixture, "ui-ux")).toEqual({
      paths: 2,
      lessons: 3,
      hours: 1.5, // 75 + 15 min = 90 min
      levels: ["beginner", "advanced"],
    });
  });

  it("is all zeros for a topic whose paths are drafts or archived", () => {
    expect(topicStats(fixture, "brand")).toEqual({ paths: 0, lessons: 0, hours: 0, levels: [] });
  });
});

describe("sourcesByResourceCount", () => {
  it("orders by live resources, most first, ignoring broken ones", () => {
    // a has 2 live, b has 2 live, c has 1 resource but it is broken: a and b tie, c is last.
    expect(sourcesByResourceCount(fixture).map((s) => s.slug)).toEqual(["a", "b", "c"]);
  });

  it("puts the source with more resources first", () => {
    const more = { ...fixture, resources: [...fixture.resources, resource("r6", "b", 10)] };
    expect(sourcesByResourceCount(more).map((s) => s.slug)).toEqual(["b", "a", "c"]);
  });
});

describe("the launch catalogue", () => {
  it("has the seven topics from the brief, in order", () => {
    expect(launchCatalogue.topics.map((t) => t.slug)).toEqual([
      "ui-ux",
      "brand",
      "product",
      "seo",
      "social-media",
      "design-systems",
      "dev-handoff",
    ]);
  });

  it("starts with no paths, so no numbers are shown before the real catalogue exists", () => {
    expect(topicStats(launchCatalogue, "ui-ux")).toEqual({
      paths: 0,
      lessons: 0,
      hours: 0,
      levels: [],
    });
  });
});
