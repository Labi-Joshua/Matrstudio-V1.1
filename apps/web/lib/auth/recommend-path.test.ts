import { describe, expect, it } from "vitest";
import { SAMPLE_PATHS } from "../pages/onboarding-content";
import { closestPath, recommendPath } from "./recommend-path";

type P = Parameters<typeof recommendPath>[0][number] & { id: string };
const p = (id: string, topicSlug: P["topicSlug"], level: P["level"]): P => ({
  id,
  topicSlug,
  level,
});

const paths = [
  p("uiux-b", "ui-ux", "beginner"),
  p("uiux-a", "ui-ux", "advanced"),
  p("brand-i", "brand", "intermediate"),
  p("seo-b", "seo", "beginner"),
];

describe("recommendPath", () => {
  it("returns none with no closest when there are no paths", () => {
    expect(recommendPath([], { goal: null, level: "beginner", topics: ["seo"] })).toEqual({
      kind: "none",
      closest: null,
    });
    expect(closestPath([], { goal: null, level: null, topics: [] })).toBeNull();
  });

  it("matches on topic first, even when the level is far away", () => {
    const result = recommendPath(paths, {
      goal: "learn_new_skill",
      level: "beginner",
      topics: ["brand"],
    });
    expect(result).toEqual({ kind: "match", path: paths[2] });
  });

  it("then prefers the nearest level among matching topics", () => {
    expect(
      recommendPath(paths, { goal: "learn_new_skill", level: "advanced", topics: ["ui-ux"] }),
    ).toEqual({ kind: "match", path: paths[1] });
    expect(
      recommendPath(paths, { goal: "learn_new_skill", level: "beginner", topics: ["ui-ux"] }),
    ).toEqual({ kind: "match", path: paths[0] });
  });

  it("uses the goal to break a level tie", () => {
    const tie = [p("low", "seo", "beginner"), p("high", "seo", "advanced")];
    const answers = { level: "intermediate" as const, topics: ["seo" as const] };
    expect(recommendPath(tie, { ...answers, goal: "learn_new_skill" })).toMatchObject({
      path: { id: "low" },
    });
    expect(recommendPath(tie, { ...answers, goal: "grow_in_role" })).toMatchObject({
      path: { id: "high" },
    });
    expect(recommendPath(tie, { ...answers, goal: "build_projects" })).toMatchObject({
      path: { id: "high" },
    });
  });

  it("then prefers the topic the learner listed first, then catalogue order", () => {
    const both = [p("a", "seo", "beginner"), p("b", "brand", "beginner")];
    expect(
      recommendPath(both, { goal: null, level: "beginner", topics: ["brand", "seo"] }),
    ).toMatchObject({ path: { id: "b" } });
    expect(
      recommendPath(both, { goal: null, level: "beginner", topics: ["seo", "brand"] }),
    ).toMatchObject({ path: { id: "a" } });
  });

  it("reports no match when no path covers a chosen topic, with the closest by level", () => {
    const result = recommendPath(paths, {
      goal: "learn_new_skill",
      level: "intermediate",
      topics: ["dev-handoff"],
    });
    expect(result).toEqual({ kind: "none", closest: paths[2] });
    expect(closestPath(paths, { goal: null, level: "intermediate", topics: ["dev-handoff"] })).toBe(
      paths[2],
    );
  });

  it("handles missing answers without throwing", () => {
    expect(recommendPath(paths, { goal: null, level: null, topics: ["seo"] })).toEqual({
      kind: "match",
      path: paths[3],
    });
  });

  it("recommends UI/UX Foundations for the design example (ui-ux, product, design systems; beginner)", () => {
    const result = recommendPath(SAMPLE_PATHS, {
      goal: "learn_new_skill",
      level: "beginner",
      topics: ["ui-ux", "product", "design-systems"],
    });
    expect(result.kind).toBe("match");
    if (result.kind === "match") expect(result.path.slug).toBe("ui-ux-design-foundations");
  });
});
