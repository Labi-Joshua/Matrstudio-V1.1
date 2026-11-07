import { describe, expect, it } from "vitest";
import type { ApiFailure } from "../auth/api";
import {
  EMPTY_DRAFT,
  feedbackForFailure,
  firstErrorField,
  formatShortDate,
  NOTE_MAX,
  sortSubmissions,
  submissionDetail,
  validateDraft,
} from "./submit-state";

const failure = (code: ApiFailure["code"], extra: Partial<ApiFailure> = {}): ApiFailure => ({
  ok: false,
  code,
  message: "server text",
  ...extra,
});

describe("validateDraft", () => {
  const good = { url: "youtube.com/watch?v=1", title: "A title", topic: "ui-ux", note: "" };

  it("accepts a complete draft", () => {
    expect(validateDraft(good)).toEqual({});
  });

  it("reports every missing field, in screen order", () => {
    const errors = validateDraft(EMPTY_DRAFT);
    expect(Object.keys(errors)).toEqual(["url", "title", "topic"]);
    expect(firstErrorField(errors)).toBe("url");
  });

  it("does not need a link when editing", () => {
    expect(validateDraft({ ...good, url: "" }, false)).toEqual({});
  });

  it("limits the note", () => {
    expect(validateDraft({ ...good, note: "x".repeat(NOTE_MAX + 1) }).note).toBeDefined();
    expect(validateDraft({ ...good, note: "x".repeat(NOTE_MAX) }).note).toBeUndefined();
  });
});

describe("feedbackForFailure", () => {
  it("marks the link for invalid_url", () => {
    expect(feedbackForFailure(failure("invalid_url")).fieldErrors.url).toMatch(/couldn’t open/);
  });

  it("flags a link this learner already sent", () => {
    expect(feedbackForFailure(failure("already_submitted")).alreadySubmitted).toBe(true);
  });

  it("maps invalid_request field errors to our own text, never the server's", () => {
    const fb = feedbackForFailure(
      failure("invalid_request", { fieldErrors: { title: "server text", other: "x" } }),
    );
    expect(fb.fieldErrors.title).toBeDefined();
    expect(fb.fieldErrors.title).not.toBe("server text");
    expect(fb.banner).toBeNull();
  });

  it("falls back to the couldn’t-send notice without field errors", () => {
    expect(feedbackForFailure(failure("invalid_request")).banner?.title).toMatch(/couldn’t send/);
    expect(feedbackForFailure(failure("network_error")).banner?.tone).toBe("error");
    expect(feedbackForFailure(failure("unknown_error")).banner).not.toBeNull();
  });

  it("shows the wait on a rate limit", () => {
    const banner = feedbackForFailure(failure("rate_limited", { retryAfterSeconds: 600 })).banner;
    expect(banner?.description).toMatch(/10 minutes/);
  });

  it("asks for the check again on captcha failures and resets the widget", () => {
    const fb = feedbackForFailure(failure("captcha_failed"));
    expect(fb.banner?.tone).toBe("warning");
    expect(fb.resetCaptcha).toBe(true);
  });

  it("explains not_editable and unauthorized", () => {
    expect(feedbackForFailure(failure("not_editable")).banner?.title).toMatch(/can’t be changed/);
    expect(feedbackForFailure(failure("unauthorized")).banner?.title).toMatch(/signed out/);
  });
});

describe("submission rows", () => {
  const now = new Date(2026, 10, 7, 12);

  it("formats dates relative to today", () => {
    expect(formatShortDate(new Date(2026, 10, 7, 1).toISOString(), now)).toBe("today");
    expect(formatShortDate(new Date(2026, 10, 6, 23).toISOString(), now)).toBe("yesterday");
    expect(formatShortDate(new Date(2026, 9, 3).toISOString(), now)).toBe("3 Oct");
    expect(formatShortDate(new Date(2025, 9, 3).toISOString(), now)).toBe("3 Oct 2025");
    expect(formatShortDate("nope", now)).toBe("");
  });

  it("writes the detail line for each status", () => {
    const base = {
      curatorNote: null,
      createdAt: new Date(2026, 10, 7).toISOString(),
      updatedAt: new Date(2026, 9, 3).toISOString(),
    };
    expect(submissionDetail({ ...base, status: "in_review" }, "UI/UX", now)).toBe(
      "UI/UX · Submitted today",
    );
    expect(submissionDetail({ ...base, status: "accepted" }, null, now)).toBe("Approved 3 Oct");
    expect(
      submissionDetail(
        { ...base, status: "needs_changes", curatorNote: "Use the full video" },
        "UI/UX",
        now,
      ),
    ).toBe("UI/UX · Curator note: Use the full video");
    expect(
      submissionDetail({ ...base, status: "declined", curatorNote: "Paid template" }, "Brand", now),
    ).toBe("Brand · Declined: Paid template");
    expect(submissionDetail({ ...base, status: "declined" }, null, now)).toBe("Declined");
  });

  it("sorts newest first without changing the input", () => {
    const rows = [{ createdAt: "2026-01-01T00:00:00Z" }, { createdAt: "2026-03-01T00:00:00Z" }];
    expect(sortSubmissions(rows)[0]).toBe(rows[1]);
    expect(rows[0]?.createdAt).toBe("2026-01-01T00:00:00Z");
  });
});
