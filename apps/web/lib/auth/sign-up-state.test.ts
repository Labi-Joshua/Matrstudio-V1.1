import { describe, expect, it } from "vitest";
import type { ApiFailure } from "./api";
import {
  confirmationViewFromParam,
  EMAIL_REGISTERED_MESSAGE,
  isGoogleRegisteredParam,
  outcomeFromFailure,
  RESEND_COOLDOWN_SECONDS,
  resendOutcome,
  signInLinkErrorFromParam,
} from "./sign-up-state";
import { MESSAGES } from "./validation";

const fail = (code: ApiFailure["code"], extra: Partial<ApiFailure> = {}): ApiFailure => ({
  ok: false,
  code,
  message: "",
  ...extra,
});

describe("outcomeFromFailure", () => {
  it("marks the email field and shows the already-registered toast", () => {
    expect(outcomeFromFailure(fail("email_already_registered"))).toMatchObject({
      notice: { kind: "already_registered" },
      emailError: EMAIL_REGISTERED_MESSAGE,
    });
  });

  it("puts password problems on the password field", () => {
    expect(outcomeFromFailure(fail("PASSWORD_COMPROMISED")).passwordError).toBe(
      MESSAGES.passwordCompromised,
    );
    expect(outcomeFromFailure(fail("PASSWORD_TOO_SHORT")).notice).toBeNull();
  });

  it("asks for the captcha and keeps it up", () => {
    expect(outcomeFromFailure(fail("captcha_required")).needsCaptcha).toBe(true);
    expect(outcomeFromFailure(fail("captcha_unavailable"))).toMatchObject({
      needsCaptcha: false,
      notice: { kind: "captcha", code: "captcha_unavailable" },
    });
  });

  it("keeps the wait on a rate limit, and falls back to a server notice", () => {
    expect(outcomeFromFailure(fail("rate_limited", { retryAfterSeconds: 120 })).notice).toEqual({
      kind: "rate_limited",
      retryAfterSeconds: 120,
    });
    expect(outcomeFromFailure(fail("network_error")).notice).toEqual({ kind: "network" });
    expect(outcomeFromFailure(fail("unknown_error")).notice).toEqual({ kind: "server" });
    expect(outcomeFromFailure(fail("invite_invalid")).notice).toEqual({ kind: "invite_invalid" });
  });
});

describe("resendOutcome", () => {
  it("tells success, waits, caps and captcha apart", () => {
    expect(resendOutcome({ ok: true, data: null })).toEqual({ kind: "sent" });
    expect(resendOutcome(fail("rate_limited", { retryAfterSeconds: 45 }))).toEqual({
      kind: "wait",
      seconds: 45,
    });
    expect(resendOutcome(fail("rate_limited"))).toEqual({
      kind: "wait",
      seconds: RESEND_COOLDOWN_SECONDS,
    });
    expect(resendOutcome(fail("resend_limit_reached"))).toEqual({ kind: "limit_reached" });
    expect(resendOutcome(fail("captcha_required"))).toMatchObject({ kind: "needs_captcha" });
    expect(resendOutcome(fail("network_error"))).toEqual({ kind: "network" });
    expect(resendOutcome(fail("unknown_error"))).toEqual({ kind: "failed" });
  });
});

describe("landing params", () => {
  it("maps the confirmation redirect", () => {
    expect(confirmationViewFromParam(null)).toBe("confirmed");
    expect(confirmationViewFromParam("link_expired")).toBe("expired");
    expect(confirmationViewFromParam("already_confirmed")).toBe("already_confirmed");
    expect(confirmationViewFromParam("link_invalid")).toBe("invalid");
    expect(confirmationViewFromParam("anything-else")).toBe("invalid");
  });

  it("accepts only the known magic link and Google errors", () => {
    expect(signInLinkErrorFromParam("link_expired")).toBe("link_expired");
    expect(signInLinkErrorFromParam("INVALID_TOKEN")).toBe("INVALID_TOKEN");
    expect(signInLinkErrorFromParam("<script>")).toBeNull();
    expect(isGoogleRegisteredParam("account_not_linked")).toBe(true);
    expect(isGoogleRegisteredParam("other")).toBe(false);
  });
});
