import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptInvite,
  checkResetToken,
  getMe,
  getSession,
  normaliseFailure,
  parseMe,
  requestPasswordReset,
  signInWithEmail,
  signUpWithEmail,
} from "./api";

function mockFetch(response: Response | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });

afterEach(() => vi.unstubAllGlobals());

describe("normaliseFailure", () => {
  it("keeps known server codes and messages", () => {
    expect(normaliseFailure(401, { code: "INVALID_EMAIL_OR_PASSWORD", message: "Nope" })).toEqual({
      ok: false,
      code: "INVALID_EMAIL_OR_PASSWORD",
      message: "Nope",
      status: 401,
    });
  });

  it("reads retryAfterSeconds from the body, rounded up", () => {
    const failure = normaliseFailure(429, { code: "too_many_attempts", retryAfterSeconds: 874.2 });
    expect(failure.code).toBe("too_many_attempts");
    expect(failure.retryAfterSeconds).toBe(875);
  });

  it("falls back to the Retry-After header", () => {
    expect(normaliseFailure(429, { code: "rate_limited" }, "30").retryAfterSeconds).toBe(30);
  });

  it("ignores a bad retry value", () => {
    expect(
      normaliseFailure(429, { retryAfterSeconds: -5 }, "soon").retryAfterSeconds,
    ).toBeUndefined();
  });

  it("maps unknown codes and empty bodies by status", () => {
    expect(normaliseFailure(401, undefined).code).toBe("unauthorized");
    expect(normaliseFailure(404, null).code).toBe("not_found");
    expect(normaliseFailure(429, { code: "weird" }).code).toBe("rate_limited");
    expect(normaliseFailure(500, "oops").code).toBe("unknown_error");
  });

  it("always supplies a message", () => {
    expect(normaliseFailure(500, {}).message.length).toBeGreaterThan(0);
  });
});

describe("requests", () => {
  it("never throws on a network error", async () => {
    mockFetch(new TypeError("failed to fetch"));
    const result = await signInWithEmail({ email: "a@b.co", password: "x" });
    expect(result).toMatchObject({ ok: false, code: "network_error" });
  });

  it("sends same-origin JSON with credentials and the captcha header", async () => {
    const fn = mockFetch(json({ token: "secret", user: { id: "1" } }));
    const result = await signInWithEmail({
      email: "a@b.co",
      password: "pw",
      rememberMe: true,
      captchaToken: "tok",
    });
    expect(result).toEqual({ ok: true, data: null }); // the token is dropped on purpose
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/auth/sign-in/email");
    expect(init.credentials).toBe("include");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-captcha-response"]).toBe("tok");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "a@b.co",
      password: "pw",
      rememberMe: true,
    });
  });

  it("normalises an API error body", async () => {
    mockFetch(json({ code: "captcha_required", message: "Captcha" }, { status: 400 }));
    expect(await signInWithEmail({ email: "a@b.co", password: "x" })).toMatchObject({
      ok: false,
      code: "captcha_required",
      status: 400,
    });
  });

  it("handles a non-JSON error page", async () => {
    mockFetch(new Response("<html>bad gateway</html>", { status: 502 }));
    expect(await requestPasswordReset({ email: "a@b.co" })).toMatchObject({
      ok: false,
      code: "unknown_error",
      status: 502,
    });
  });

  it("reports an unreadable success body as invalid_response", async () => {
    mockFetch(json({ nope: true }));
    expect(await checkResetToken("abc")).toMatchObject({ ok: false, code: "invalid_response" });
  });

  it("encodes the reset token in the check URL", async () => {
    const fn = mockFetch(json({ status: "expired" }));
    const result = await checkResetToken("a b&c");
    expect(result).toEqual({ ok: true, data: "expired" });
    expect((fn.mock.calls[0] as unknown as [string])[0]).toBe(
      "/api/auth/reset-password/check?token=a%20b%26c",
    );
  });

  it("treats a null session as signed out", async () => {
    mockFetch(json(null));
    expect(await getSession()).toEqual({ ok: true, data: false });
  });

  it("maps /api/me 401 to unauthorized", async () => {
    mockFetch(json({ code: "unauthorized", message: "no" }, { status: 401 }));
    expect(await getMe()).toMatchObject({ ok: false, code: "unauthorized" });
  });
});

describe("parseMe", () => {
  it("parses a full payload", () => {
    const me = parseMe({
      id: "u1",
      email: "ada@example.com",
      name: "Ada",
      emailVerified: true,
      onboarding: {
        goal: "design",
        level: "beginner",
        topics: ["ui-ux"],
        completed: true,
        completedAt: "2026-01-01",
      },
      providers: ["credential"],
      passkeyCount: 1,
    });
    expect(me?.onboarding.completed).toBe(true);
    expect(me?.onboarding.topics).toEqual(["ui-ux"]);
  });

  it("defaults missing optional parts and rejects junk", () => {
    expect(parseMe({ id: "u1", email: "a@b.co" })?.onboarding.completed).toBe(false);
    expect(parseMe({ email: "a@b.co" })).toBeUndefined();
    expect(parseMe(null)).toBeUndefined();
  });
});

describe("signUpWithEmail", () => {
  it("posts name, email and password, and sends the captcha token as a header", async () => {
    const fetchMock = mockFetch(json({ token: null, user: { id: "u1" } }));
    const result = await signUpWithEmail({
      name: "Ada",
      email: "ada@example.com",
      password: "correct horse battery",
      captchaToken: "cap-token",
    });
    expect(result).toEqual({ ok: true, data: null });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/auth/sign-up/email");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Ada",
      email: "ada@example.com",
      password: "correct horse battery",
    });
    expect((init.headers as Record<string, string>)["x-captcha-response"]).toBe("cap-token");
  });

  it("maps the failure codes the screen switches on", async () => {
    const input = { name: "A", email: "a@b.co", password: "x" };
    mockFetch(json({ code: "email_already_registered", message: "x" }, { status: 422 }));
    expect(await signUpWithEmail(input)).toMatchObject({
      ok: false,
      code: "email_already_registered",
      status: 422,
    });
    mockFetch(json({ code: "PASSWORD_COMPROMISED" }, { status: 400 }));
    expect(await signUpWithEmail(input)).toMatchObject({ code: "PASSWORD_COMPROMISED" });
    mockFetch(json({ code: "rate_limited", retryAfterSeconds: 90 }, { status: 429 }));
    expect(await signUpWithEmail(input)).toMatchObject({
      code: "rate_limited",
      retryAfterSeconds: 90,
    });
  });

  it("reports a network failure instead of throwing", async () => {
    mockFetch(new Error("offline"));
    expect(await signUpWithEmail({ name: "A", email: "a@b.co", password: "x" })).toMatchObject({
      ok: false,
      code: "network_error",
    });
  });
});

describe("acceptInvite", () => {
  it("posts the token, name and password only (the invite carries the email)", async () => {
    const fetchMock = mockFetch(json({ token: "t", user: { id: "u1" } }));
    const result = await acceptInvite({
      token: "inv",
      name: "Ada",
      password: "correct horse battery",
    });
    expect(result).toEqual({ ok: true, data: null });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/auth/invite/accept");
    expect(JSON.parse(init.body as string)).toEqual({
      token: "inv",
      name: "Ada",
      password: "correct horse battery",
    });
  });

  it("maps invite_invalid and email_already_registered", async () => {
    mockFetch(json({ code: "invite_invalid" }, { status: 400 }));
    expect(await acceptInvite({ token: "x", name: "A", password: "p" })).toMatchObject({
      code: "invite_invalid",
    });
    mockFetch(json({ code: "email_already_registered" }, { status: 422 }));
    expect(await acceptInvite({ token: "x", name: "A", password: "p" })).toMatchObject({
      code: "email_already_registered",
    });
  });
});
