import { describe, expect, it } from "vitest";
import type { ApiFailure } from "../auth/api";
import type { Prefs } from "../auth/prefs-api";
import { DELETE_PHRASE, isDeletePhrase, loseSummary } from "./settings-delete";
import { confirmEmailView } from "./settings-email-link";
import {
  formOutcome,
  hasErrors,
  validateEmailChange,
  validatePasswordChange,
} from "./settings-forms";
import { sectionFromPath } from "./settings-nav";
import { formatTime, stepGoal, timeOptions, toggleDay } from "./settings-reminders";
import {
  applyPrefsPatch,
  canSaveTopics,
  inversePatch,
  saveFailureToast,
  toggleTopic,
} from "./settings-state";

const prefs: Prefs = {
  notifications: { submissions: true, lessons: true, helpReplies: true },
  email: { digest: true, reminders: true, news: false },
  reminders: { days: ["mon", "wed", "fri"], time: "19:00" },
  learning: { weeklyGoal: 3 },
};
const fail = (code: ApiFailure["code"], extra: Partial<ApiFailure> = {}): ApiFailure => ({
  ok: false,
  code,
  message: "x",
  ...extra,
});

describe("sections", () => {
  it("maps paths to sections", () => {
    expect(sectionFromPath("/settings/notifications")).toBe("notifications");
    expect(sectionFromPath("/settings/learning/")).toBe("learning");
    expect(sectionFromPath("/settings/appearance")).toBe("appearance");
    expect(sectionFromPath("/settings")).toBe("account");
  });
});

describe("email change form", () => {
  it("checks the address and refuses the current one", () => {
    expect(
      validateEmailChange({ newEmail: "nope", password: "" }, "a@b.co", false).newEmail,
    ).toBeTruthy();
    expect(
      validateEmailChange({ newEmail: " A@B.co ", password: "" }, "a@b.co", false).newEmail,
    ).toMatch(/already/);
    expect(
      hasErrors(validateEmailChange({ newEmail: "c@d.co", password: "" }, "a@b.co", false)),
    ).toBe(false);
  });
  it("asks for the password only when needed", () => {
    expect(
      validateEmailChange({ newEmail: "c@d.co", password: "" }, "a@b.co", true).password,
    ).toBeTruthy();
  });
});

describe("password form", () => {
  const ok = "correct horse battery staple";
  it("needs a current password only when the account has one", () => {
    expect(
      validatePasswordChange({ current: "", next: ok, confirm: ok }, true).current,
    ).toBeTruthy();
    expect(hasErrors(validatePasswordChange({ current: "", next: ok, confirm: ok }, false))).toBe(
      false,
    );
  });
  it("checks length, difference and confirmation", () => {
    expect(
      validatePasswordChange({ current: "old", next: "short", confirm: "short" }, true).next,
    ).toBeTruthy();
    expect(validatePasswordChange({ current: ok, next: ok, confirm: ok }, true).next).toMatch(
      /different/,
    );
    expect(
      validatePasswordChange({ current: "old", next: ok, confirm: "x" }, true).confirm,
    ).toBeTruthy();
  });
});

describe("failure outcomes", () => {
  it("asks to re-authenticate, or says the password was wrong when one was sent", () => {
    expect(formOutcome(fail("reauth_required", { status: 401 }), "delete", false)).toEqual({
      kind: "reauth",
    });
    expect(formOutcome(fail("reauth_required", { status: 401 }), "delete", true)).toMatchObject({
      kind: "field",
      field: "password",
    });
  });
  it("maps password codes to fields and rate limits to a banner", () => {
    expect(formOutcome(fail("INVALID_PASSWORD"), "password", true)).toMatchObject({
      field: "current",
    });
    expect(formOutcome(fail("PASSWORD_COMPROMISED"), "password", true)).toMatchObject({
      field: "next",
    });
    const limited = formOutcome(fail("rate_limited", { retryAfterSeconds: 120 }), "email", false);
    expect(limited).toMatchObject({ kind: "banner", retryAfterSeconds: 120 });
    expect(formOutcome(fail("network_error"), "email", false)).toMatchObject({ kind: "banner" });
  });
});

describe("delete", () => {
  it("accepts exactly DELETE", () => {
    expect(isDeletePhrase(DELETE_PHRASE)).toBe(true);
    expect(isDeletePhrase(" DELETE ")).toBe(true);
    expect(isDeletePhrase("delete")).toBe(false);
    expect(isDeletePhrase("DELETE ME")).toBe(false);
  });
  it("names what is lost", () => {
    expect(loseSummary({ saved: 12, submissions: 4 })).toBe(
      "Your profile and public link, your progress, 12 saved resources and 4 submissions.",
    );
    expect(loseSummary({ saved: 1, submissions: 0 })).toBe(
      "Your profile and public link, your progress and 1 saved resource.",
    );
    expect(loseSummary({ saved: 0, submissions: 0 })).toBe(
      "Your profile and public link and your progress.",
    );
    expect(loseSummary(null)).toContain("submissions");
  });
});

describe("reminders", () => {
  it("toggles days in week order", () => {
    expect(toggleDay(["mon", "wed"], "tue")).toEqual(["mon", "tue", "wed"]);
    expect(toggleDay(["mon", "wed"], "mon")).toEqual(["wed"]);
  });
  it("formats times and keeps an off-hour value selectable", () => {
    expect(formatTime("19:00")).toBe("7:00 PM");
    expect(formatTime("00:30")).toBe("12:30 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("bad")).toBe("bad");
    expect(timeOptions("19:00")).toHaveLength(24);
    expect(timeOptions("19:15")[0]).toEqual({ value: "19:15", label: "7:15 PM" });
  });
  it("keeps the goal in bounds", () => {
    expect(stepGoal(1, -1, 1, 14)).toBe(1);
    expect(stepGoal(14, 1, 1, 14)).toBe(14);
    expect(stepGoal(3, 1, 1, 14)).toBe(4);
  });
});

describe("preferences state", () => {
  it("applies a patch and builds the rollback", () => {
    const patch = { email: { news: true }, reminders: { days: ["sun" as const] } };
    const next = applyPrefsPatch(prefs, patch);
    expect(next.email).toEqual({ digest: true, reminders: true, news: true });
    expect(next.reminders).toEqual({ days: ["sun"], time: "19:00" });
    expect(applyPrefsPatch(next, inversePatch(prefs, patch))).toEqual(prefs);
  });
  it("keeps at least one topic", () => {
    expect(canSaveTopics([])).toBe(false);
    expect(toggleTopic(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleTopic(["a", "b"], "a")).toEqual(["b"]);
  });
  it("words save failures", () => {
    expect(saveFailureToast(fail("rate_limited", { retryAfterSeconds: 90 })).body).toContain(
      "2 minutes",
    );
    expect(saveFailureToast(fail("network_error")).body).toContain("connection");
    expect(saveFailureToast(fail("unauthorized")).title).toMatch(/signed out/);
  });
});

describe("confirm email link", () => {
  it("reads the error parameter", () => {
    expect(confirmEmailView(null)).toBe("changed");
    expect(confirmEmailView("link_expired")).toBe("expired");
    expect(confirmEmailView("already_confirmed")).toBe("used");
    expect(confirmEmailView("link_invalid")).toBe("invalid");
    expect(confirmEmailView("whatever")).toBe("invalid");
  });
});
