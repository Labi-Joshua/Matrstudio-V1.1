import { describe, expect, it } from "vitest";
import { catalogue as realCatalogue } from "../catalogue/data";
import type { Catalogue } from "../catalogue/types";
import { buildLessonView, lessonHref, lessonOf, lessonParams } from "./paths-lessons";

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
      url: "",
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
    { pathSlug: "flows", resourceId: "r3", position: 1 },
    { pathSlug: "flows", resourceId: "r1", position: 0 },
  ],
};

describe("lesson links", () => {
  it("builds the lesson route", () => {
    expect(lessonHref("product", "product-design-essentials", "framing-the-problem")).toBe(
      "/learn/paths/product/product-design-essentials/lessons/framing-the-problem",
    );
    expect(lessonOf(5, 10)).toBe("Lesson 5 of 10");
  });
});

describe("sample lessons", () => {
  it("finds a lesson of the Product Design Essentials sample, with ids that fit the API", () => {
    const view = buildLessonView(
      realCatalogue,
      "product",
      "product-design-essentials",
      "framing-the-problem",
      true,
    );
    expect(view).toMatchObject({ number: 2, total: 10, unavailable: false });
    expect(view?.detail.sample).toBe(true);
    expect(view?.item).toMatchObject({
      kind: "article",
      url: "",
      sourceName: "Medium",
      lengthLabel: "10 min read",
      sample: true,
    });
    const ids = view?.detail.lessons.map((l) => l.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/);
  });

  it("returns null for an unknown lesson, path or topic", () => {
    expect(
      buildLessonView(realCatalogue, "product", "product-design-essentials", "nope", true),
    ).toBeNull();
    expect(buildLessonView(realCatalogue, "product", "nope", "x", true)).toBeNull();
    expect(buildLessonView(realCatalogue, "seo", "nope", "x", false)).toBeNull();
  });

  it("lists a page for every sample lesson and none without paths", () => {
    const params = lessonParams(realCatalogue, true);
    expect(params).toContainEqual({
      topic: "product",
      path: "product-design-essentials",
      lesson: "shipping-and-measuring",
    });
    expect(lessonParams(realCatalogue, false)).toEqual([]);
  });
});

describe("real lessons", () => {
  it("uses resource ids in path order and flags a lesson with no usable link", () => {
    const first = buildLessonView(published, "ui-ux", "flows", "r1", true);
    expect(first).toMatchObject({ number: 1, total: 2, unavailable: false });
    expect(first?.item.url).toBe("https://example.com/a");
    const second = buildLessonView(published, "ui-ux", "flows", "r3", true);
    expect(second).toMatchObject({ number: 2, unavailable: true });
    expect(lessonParams(published, true).map((p) => p.lesson)).toEqual(["r1", "r3"]);
  });
});
