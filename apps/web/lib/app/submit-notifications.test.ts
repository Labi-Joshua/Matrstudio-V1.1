import { describe, expect, it } from "vitest";
import type { Submission } from "../auth/submissions-api";
import { submissionNotification, submissionNotifications } from "./submit-notifications";

const make = (over: Partial<Submission>): Submission => ({
  id: "s1",
  url: "https://example.com/a",
  title: "Grid systems",
  note: null,
  topic: null,
  status: "accepted",
  curatorNote: null,
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-03T10:00:00Z",
  ...over,
});

describe("submissionNotification", () => {
  it("approved", () => {
    expect(submissionNotification(make({}))).toMatchObject({
      title: "Your resource was approved",
      body: "“Grid systems” is now in the library. You’re credited on it.",
      tone: "success",
      href: "/learn/submit",
      at: "2026-10-03T10:00:00Z",
    });
  });
  it("needs a change carries the curator note", () => {
    const item = submissionNotification(
      make({ status: "needs_changes", curatorNote: "please link the full video" }),
    );
    expect(item?.title).toBe("Your submission needs a change");
    expect(item?.body).toBe("“Grid systems”: please link the full video");
    expect(item?.tone).toBe("warning");
  });
  it("declined, with and without a note", () => {
    expect(
      submissionNotification(make({ status: "declined", curatorNote: "is a paid template." }))
        ?.body,
    ).toBe("“Grid systems” is a paid template.");
    expect(submissionNotification(make({ status: "declined" }))?.tone).toBe("neutral");
  });
  it("falls back to the host and skips in review", () => {
    expect(submissionNotification(make({ title: null }))?.body).toContain("example.com");
    expect(submissionNotification(make({ status: "in_review" }))).toBeNull();
  });
  it("lists decisions newest first with distinct ids per status", () => {
    const list = submissionNotifications([
      make({ id: "a", updatedAt: "2026-10-01T00:00:00Z" }),
      make({ id: "b", status: "declined", updatedAt: "2026-10-05T00:00:00Z" }),
      make({ id: "c", status: "in_review" }),
    ]);
    expect(list.map((n) => n.id)).toEqual(["submission-b-declined", "submission-a-accepted"]);
  });
});
