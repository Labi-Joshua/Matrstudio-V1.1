import { describe, expect, it } from "vitest";
import type { ApiFailure, Me } from "./api";
import { authErrorCopy, formatWait } from "./messages";
import { postAuthPath } from "./paths";
import { initialResetState, resetReducer } from "./reset-password-state";
import {
  DEFAULT_LOCK_SECONDS,
  initialSignInState,
  noticeFromFailure,
  signInReducer,
} from "./sign-in-state";
import { formatCountdown } from "./use-countdown";
import { meStateFromResult } from "./use-me";

const fail = (code: ApiFailure["code"], extra: Partial<ApiFailure> = {}): ApiFailure => ({
  ok: false,
  code,
  message: "",
  ...extra,
});

const failed = (failure: ApiFailure, state = initialSignInState) =>
  signInReducer(state, { type: "failed", failure, email: "ada@example.com" });

describe("signInReducer", () => {
  it("clears the notice while submitting and ends signed in", () => {
    const wrong = failed(fail("INVALID_EMAIL_OR_PASSWORD"));
    expect(wrong.notice).toEqual({ kind: "wrong_credentials" });
    const submitting = signInReducer(wrong, { type: "submit" });
    expect(submitting).toMatchObject({ phase: "submitting", notice: null });
    expect(signInReducer(submitting, { type: "succeeded" }).phase).toBe("redirecting");
  });

  it("locks with the server wait, or 15 minutes when none is given", () => {
    expect(
      noticeFromFailure(fail("too_many_attempts", { retryAfterSeconds: 90 }), "a@b.co"),
    ).toEqual({ kind: "locked", retryAfterSeconds: 90 });
    expect(noticeFromFailure(fail("rate_limited"), "a@b.co")).toEqual({
      kind: "locked",
      retryAfterSeconds: DEFAULT_LOCK_SECONDS,
    });
  });

  it("unlocks only a lock", () => {
    const locked = failed(fail("too_many_attempts", { retryAfterSeconds: 5 }));
    expect(signInReducer(locked, { type: "unlock" }).notice).toBeNull();
    const wrong = failed(fail("INVALID_EMAIL_OR_PASSWORD"));
    expect(signInReducer(wrong, { type: "unlock" })).toBe(wrong);
  });

  it("keeps the captcha once the API asks for it", () => {
    const asked = failed(fail("captcha_required"));
    expect(asked.needsCaptcha).toBe(true);
    expect(failed(fail("INVALID_EMAIL_OR_PASSWORD"), asked).needsCaptcha).toBe(true);
  });

  it("tracks resending the confirmation email", () => {
    let state = failed(fail("email_not_verified"));
    expect(state.notice).toEqual({ kind: "unverified", email: "ada@example.com", resend: "idle" });
    state = signInReducer(state, { type: "resend_start" });
    expect(state.notice).toMatchObject({ resend: "sending" });
    state = signInReducer(state, { type: "resend_done", result: { ok: true, data: null } });
    expect(state.notice).toMatchObject({ resend: "sent" });
    state = signInReducer(state, { type: "resend_start" });
    state = signInReducer(state, { type: "resend_done", result: fail("resend_limit_reached") });
    expect(state.notice).toMatchObject({ resend: "limit" });
  });

  it("maps a network failure to a retryable notice", () => {
    expect(noticeFromFailure(fail("network_error"), "a@b.co")).toEqual({ kind: "network" });
  });
});

describe("resetReducer", () => {
  const checked = (status: "ok" | "expired" | "invalid") =>
    resetReducer(initialResetState, { type: "checked", status }).view;

  it("moves from checking to the form, or to expired and invalid", () => {
    expect(checked("ok")).toBe("form");
    expect(checked("expired")).toBe("expired");
    expect(checked("invalid")).toBe("invalid");
    expect(resetReducer(initialResetState, { type: "no_token" }).view).toBe("invalid");
  });

  it("offers a retry on network errors but shows the form for other check failures", () => {
    const offline = resetReducer(initialResetState, {
      type: "check_failed",
      failure: fail("network_error"),
    });
    expect(offline.view).toBe("offline");
    expect(resetReducer(offline, { type: "retry_check" }).view).toBe("checking");
    expect(
      resetReducer(initialResetState, { type: "check_failed", failure: fail("not_found") }).view,
    ).toBe("form");
  });

  it("handles submit outcomes", () => {
    const form = resetReducer(initialResetState, { type: "checked", status: "ok" });
    const submitting = resetReducer(form, { type: "submit" });
    expect(submitting.submitting).toBe(true);
    expect(resetReducer(submitting, { type: "submitted" })).toMatchObject({
      view: "updated",
      submitting: false,
    });
    const submitFailed = (code: ApiFailure["code"], passwordError: string | null = null) =>
      resetReducer(submitting, { type: "submit_failed", failure: fail(code), passwordError });
    expect(submitFailed("link_expired").view).toBe("expired");
    expect(submitFailed("INVALID_TOKEN").view).toBe("invalid");
    expect(submitFailed("PASSWORD_COMPROMISED", "breached")).toMatchObject({
      view: "form",
      passwordError: "breached",
      failure: null,
    });
    expect(submitFailed("rate_limited").failure?.code).toBe("rate_limited");
  });
});

describe("helpers", () => {
  const me = (completed: boolean): Me => ({
    id: "1",
    email: "a@b.co",
    name: null,
    emailVerified: true,
    onboarding: { goal: null, level: null, topics: [], completed, completedAt: null },
    providers: [],
    passkeyCount: 0,
  });

  it("routes by onboarding", () => {
    expect(postAuthPath(me(false))).toBe("/onboarding");
    expect(postAuthPath(me(true))).toBe("/dashboard");
    expect(postAuthPath(null)).toBe("/dashboard");
  });

  it("maps me results to states", () => {
    expect(meStateFromResult({ ok: true, data: me(true) }).status).toBe("authenticated");
    expect(meStateFromResult(fail("unauthorized")).status).toBe("unauthenticated");
    expect(meStateFromResult(fail("network_error")).status).toBe("error");
  });

  it("formats waits and countdowns", () => {
    expect(formatCountdown(892)).toBe("14:52");
    expect(formatCountdown(5)).toBe("0:05");
    expect(formatCountdown(-3)).toBe("0:00");
    expect(formatWait(900)).toBe("15 minutes");
    expect(formatWait(61)).toBe("2 minutes");
    expect(formatWait(30)).toBe("30 seconds");
  });

  it("never echoes raw server messages and mentions the wait", () => {
    const limited = authErrorCopy(
      fail("too_many_attempts", { retryAfterSeconds: 900, message: "internal detail" }),
    );
    expect(limited.description).toContain("15 minutes");
    const unknown = authErrorCopy(fail("unknown_error", { message: "internal detail" }));
    expect(JSON.stringify(unknown)).not.toContain("internal");
  });
});
