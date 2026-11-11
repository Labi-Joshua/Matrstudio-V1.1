import { afterEach, describe, expect, it, vi } from "vitest";
import {
  accountFailureKind,
  cancelEmailChange,
  deleteAccount,
  getAccount,
  parseAccount,
  requestEmailChange,
  setPassword,
  unlinkGoogle,
} from "./account-api";
import { getPrefs, parseIsPublic, parsePrefs, patchPrefs, setProfileIsPublic } from "./prefs-api";

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
function mockFetch(response: Response) {
  const fn = vi.fn(async (..._args: unknown[]) => response);
  vi.stubGlobal("fetch", fn);
  return fn;
}
afterEach(() => vi.unstubAllGlobals());
const initOf = (fn: ReturnType<typeof mockFetch>, i: number) =>
  (fn.mock.calls[i] ?? [])[1] as RequestInit;

const prefsBody = {
  prefs: {
    notifications: { submissions: true, lessons: false, helpReplies: true },
    email: { digest: true, reminders: false, news: false },
    reminders: { days: ["wed", "mon", "nope"], time: "19:00" },
    learning: { weeklyGoal: 3 },
  },
};

describe("parsePrefs", () => {
  it("reads a full object and orders the days", () => {
    expect(parsePrefs(prefsBody)?.reminders.days).toEqual(["mon", "wed"]);
    expect(parsePrefs(prefsBody)?.notifications.lessons).toBe(false);
  });
  it("rejects incomplete payloads", () => {
    expect(parsePrefs(null)).toBeUndefined();
    expect(parsePrefs({ prefs: { ...prefsBody.prefs, email: { digest: true } } })).toBeUndefined();
    expect(
      parsePrefs({ prefs: { ...prefsBody.prefs, learning: { weeklyGoal: "3" } } }),
    ).toBeUndefined();
  });
});

describe("prefs calls", () => {
  it("GETs and PATCHes the preferences", async () => {
    const get = mockFetch(json(prefsBody));
    expect((await getPrefs()).ok).toBe(true);
    expect(get.mock.calls[0]?.[0]).toBe("/api/me/prefs");
    const patch = mockFetch(json(prefsBody));
    await patchPrefs({ email: { news: true } });
    const init = patch.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ email: { news: true } }));
  });
  it("reports 429 with the wait", async () => {
    mockFetch(json({ code: "rate_limited", message: "m", retryAfterSeconds: 30 }, { status: 429 }));
    const result = await patchPrefs({ email: { news: true } });
    expect(result).toMatchObject({ ok: false, code: "rate_limited", retryAfterSeconds: 30 });
  });
});

describe("profile switch", () => {
  it("reads isPublic from the profile contract and sends the patch", async () => {
    expect(parseIsPublic({ profile: { isPublic: true } })).toBe(true);
    expect(parseIsPublic({ profile: {} })).toBeUndefined();
    const fn = mockFetch(json({ profile: { isPublic: false } }));
    const result = await setProfileIsPublic(false);
    expect(result).toEqual({ ok: true, data: false });
    expect(fn.mock.calls[0]?.[0]).toBe("/api/me/profile");
    expect(initOf(fn, 0).body).toBe(JSON.stringify({ isPublic: false }));
  });
});

describe("account calls", () => {
  const account = {
    account: {
      hasPassword: true,
      google: { linked: true },
      passkeyCount: 0,
      pendingEmail: { email: "n@x.co", requestedAt: "a", expiresAt: "b" },
      counts: { saved: 2, submissions: 1 },
    },
  };
  it("parses the summary", () => {
    expect(parseAccount(account)).toMatchObject({
      hasPassword: true,
      google: { linked: true },
      pendingEmail: { email: "n@x.co" },
      counts: { saved: 2, submissions: 1 },
    });
    expect(parseAccount({ account: { hasPassword: false } })?.pendingEmail).toBeNull();
    expect(parseAccount({})).toBeUndefined();
  });
  it("sends the email change and the cancel", async () => {
    const fn = mockFetch(json({ pendingEmail: "n@x.co" }));
    expect(await requestEmailChange({ newEmail: "n@x.co", password: "pw" })).toEqual({
      ok: true,
      data: "n@x.co",
    });
    expect(fn.mock.calls[0]?.[0]).toBe("/api/me/account/email");
    mockFetch(json({ cancelled: true }));
    expect((await cancelEmailChange()).ok).toBe(true);
  });
  it("sends the password only when there is one", async () => {
    const fn = mockFetch(json({ deleted: true }));
    await deleteAccount();
    expect(initOf(fn, 0).body).toBe("{}");
    await deleteAccount("pw");
    expect(initOf(fn, 1).body).toBe(JSON.stringify({ password: "pw" }));
  });
  it("tells reauth_required apart and names the 409 cases", async () => {
    mockFetch(json({ code: "reauth_required", message: "m" }, { status: 401 }));
    expect(await setPassword("x".repeat(12))).toMatchObject({ ok: false, code: "reauth_required" });
    mockFetch(
      json(
        {
          code: "last_sign_in_method",
          message: "Set a password first: Google is your only way to sign in.",
        },
        { status: 409 },
      ),
    );
    const result = await unlinkGoogle();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(accountFailureKind(result)).toBe("last_sign_in_method");
    mockFetch(
      json(
        { code: "password_exists", message: "This account already has a password." },
        { status: 409 },
      ),
    );
    const again = await setPassword("x".repeat(12));
    if (!again.ok) expect(accountFailureKind(again)).toBe("password_exists");
  });
  it("loads the account", async () => {
    mockFetch(json(account));
    expect((await getAccount()).ok).toBe(true);
    mockFetch(json({ nope: 1 }));
    expect(await getAccount()).toMatchObject({ ok: false, code: "invalid_response" });
  });
});
