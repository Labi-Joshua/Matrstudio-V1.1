import { describe, expect, it } from "vitest";
import { checklistSummary, initialForm, toBody, validate } from "./approve-form";
import type { SubmissionDetail } from "./types";

const base: SubmissionDetail = {
  id: "s1",
  title: " Spacing ",
  url: "https://figma.com/blog",
  source: "Figma blog",
  type: "article",
  minutes: 9,
  topic: null,
  level: "beginner",
  creator: null,
  note: "It helps.",
  ageDays: 4,
  submittedAt: null,
  status: "in_review",
  submitter: { id: "u", name: "Kemi Bello", since: null, submitted: 1, approved: 0, declined: 0 },
  autoChecks: [
    { key: "a", label: "Link works", status: "pass" },
    { key: "b", label: "Language", status: "warn" },
  ],
  duplicateOf: null,
  assignedTo: null,
};

describe("approve form", () => {
  it("prefills from the submission", () => {
    const f = initialForm(base);
    expect(f.creator).toBe("Figma blog");
    expect(f.intro).toBe("It helps.");
    expect(f.credit).toBe(true);
  });
  it("requires topic, and trims in the body", () => {
    const f = initialForm(base);
    expect(validate(f).topic).toBeDefined();
    const ok = { ...f, topic: "ui-ux" };
    expect(validate(ok)).toEqual({});
    expect(toBody(ok).record.title).toBe("Spacing");
    expect(toBody(ok).credit).toBe(true);
  });
  it("limits intro length", () => {
    expect(
      validate({ ...initialForm(base), topic: "x", intro: "a".repeat(401) }).intro,
    ).toBeDefined();
  });
  it("summarises the checklist", () => {
    expect(checklistSummary(base)).toBe("1 of 2");
  });
});
