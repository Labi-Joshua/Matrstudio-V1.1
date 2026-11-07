import { describe, expect, it } from "vitest";
import type { Me } from "../auth/api";
import { catalogue as realCatalogue } from "../catalogue/data";
import type { Catalogue } from "../catalogue/types";
import { SAMPLE_RESOURCES } from "../pages/browse-library";
import { SAMPLE_PATHS } from "../pages/onboarding-content";
import { ROUTES } from "../routes";
import { answersFromMe, buildDashboard, libraryPicks, pickForYou } from "./dashboard";
import { currentLabel, isNavActive, LEARN_NAV, normalisePath, SUPPORT_NAV } from "./nav";
import { displayName, firstName, initials, joinWithAnd, levelBadge, welcomeTitle } from "./profile";

const onboarding = (over: Partial<Me["onboarding"]> = {}): Me["onboarding"] => ({
  goal: null,
  level: null,
  topics: [],
  completed: true,
  completedAt: null,
  ...over,
});

describe("nav model", () => {
  it("normalises trailing slashes", () => {
    expect(normalisePath("/dashboard/")).toBe("/dashboard");
    expect(normalisePath("/")).toBe("/");
  });

  it("marks Home active on the dashboard, with or without the trailing slash", () => {
    const home = LEARN_NAV[0];
    expect(home?.href).toBe(ROUTES.dashboard);
    expect(home && isNavActive(home, "/dashboard")).toBe(true);
    expect(home && isNavActive(home, "/dashboard/")).toBe(true);
    expect(home && isNavActive(home, "/paths")).toBe(false);
  });

  it("never marks a disabled item active", () => {
    const settings = SUPPORT_NAV.find((i) => i.id === "settings");
    expect(settings?.href).toBeNull();
    expect(settings && isNavActive(settings, "/settings")).toBe(false);
  });

  it("gives every item a label and only same-site links", () => {
    for (const item of [...LEARN_NAV, ...SUPPORT_NAV]) {
      expect(item.label.length).toBeGreaterThan(0);
      if (item.href !== null) expect(item.href.startsWith("/")).toBe(true);
    }
  });

  it("labels the breadcrumb, falling back to Home", () => {
    expect(currentLabel("/dashboard")).toBe("Home");
    expect(currentLabel("/somewhere-else")).toBe("Home");
  });
});

describe("profile helpers", () => {
  it("builds the welcome title from the first name", () => {
    expect(welcomeTitle("Ada Lovelace")).toBe("Welcome to Matr Studio, Ada");
    expect(welcomeTitle("  ")).toBe("Welcome to Matr Studio");
    expect(welcomeTitle(null)).toBe("Welcome to Matr Studio");
    expect(firstName("Ada")).toBe("Ada");
  });

  it("makes initials from the name, else the email", () => {
    expect(initials({ name: "Ada Lovelace", email: "x@y.z" })).toBe("AL");
    expect(initials({ name: "ada", email: "x@y.z" })).toBe("A");
    expect(initials({ name: null, email: "grace@y.z" })).toBe("G");
    expect(initials({ name: null, email: "" })).toBe("?");
  });

  it("shows the name in menus, else the email", () => {
    expect(displayName({ name: "Ada", email: "a@b.c" })).toBe("Ada");
    expect(displayName({ name: " ", email: "a@b.c" })).toBe("a@b.c");
  });

  it("joins lists with and", () => {
    expect(joinWithAnd([])).toBe("");
    expect(joinWithAnd(["UI/UX"])).toBe("UI/UX");
    expect(joinWithAnd(["UI/UX", "Brand"])).toBe("UI/UX and Brand");
    expect(joinWithAnd(["UI/UX", "Brand", "SEO"])).toBe("UI/UX, Brand and SEO");
  });

  it("only badges known levels", () => {
    expect(levelBadge("beginner")).toBe("Beginner");
    expect(levelBadge("wizard")).toBeNull();
    expect(levelBadge(null)).toBeNull();
  });
});

describe("dashboard recommendations", () => {
  it("drops onboarding values this version does not know", () => {
    expect(
      answersFromMe(onboarding({ goal: "nope", level: "beginner", topics: ["seo", "x"] })),
    ).toEqual({ goal: null, level: "beginner", topics: ["seo"] });
  });

  it("picks paths on the learner's topics first, without repeats", () => {
    const picked = pickForYou(SAMPLE_PATHS, { goal: null, level: "beginner", topics: ["brand"] });
    expect(picked).toHaveLength(3);
    expect(picked[0]?.topicSlug).toBe("brand");
    expect(new Set(picked.map((p) => p.slug)).size).toBe(3);
  });

  it("returns fewer than the limit when there are fewer paths, and nothing for none", () => {
    const two = SAMPLE_PATHS.slice(0, 2);
    expect(pickForYou(two, { goal: null, level: null, topics: [] })).toHaveLength(2);
    expect(pickForYou([], { goal: null, level: null, topics: ["seo"] })).toEqual([]);
  });

  it("puts library cards on the learner's topics first", () => {
    const picks = libraryPicks(SAMPLE_RESOURCES, ["Brand"]);
    expect(picks).toHaveLength(4);
    expect(picks[0]?.topicName).toBe("Brand");
  });

  it("uses flagged sample content for an empty catalogue, and nothing when samples are off", () => {
    const view = buildDashboard(realCatalogue, onboarding({ topics: ["ui-ux", "brand"] }), true);
    expect(view.samplePaths).toBe(true);
    expect(view.sampleLibrary).toBe(true);
    expect(view.personalised).toBe(true);
    expect(view.topicsSentence).toBe("UI/UX and Brand");
    expect(view.paths[0]?.topicSlug).toBe("ui-ux");
    expect(view.paths[0]?.description).toBeTruthy();

    const off = buildDashboard(realCatalogue, onboarding(), false);
    expect(off.paths).toEqual([]);
    expect(off.library).toEqual([]);
    expect(off.samplePaths).toBe(false);
    expect(off.sampleLibrary).toBe(false);
    expect(off.personalised).toBe(false);
  });

  it("uses real catalogue paths and resources, unflagged, when there are some", () => {
    const real: Catalogue = {
      ...realCatalogue,
      resources: [
        {
          id: "r1",
          title: "Real resource",
          url: "https://example.com/a",
          sourceSlug: "youtube",
          format: "video",
          lengthMinutes: 10,
          topicSlug: "seo",
          status: "live",
        },
      ],
      paths: [
        {
          slug: "seo-basics",
          title: "SEO Basics",
          description: "Real description.",
          topicSlug: "seo",
          level: "beginner",
          status: "published",
        },
      ],
      pathLessons: [{ pathSlug: "seo-basics", resourceId: "r1", position: 0 }],
    };
    const view = buildDashboard(real, onboarding({ topics: ["seo"] }));
    expect(view.samplePaths).toBe(false);
    expect(view.sampleLibrary).toBe(false);
    expect(view.paths).toHaveLength(1);
    expect(view.paths[0]).toMatchObject({
      title: "SEO Basics",
      description: "Real description.",
      lessons: 1,
    });
    expect(view.library.map((r) => r.id)).toEqual(["r1"]);
  });
});
