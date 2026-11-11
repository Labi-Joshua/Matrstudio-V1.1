import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, GOOD_PASSWORD, stubFetch, type TestApp } from "./helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function setup(email = "ada@example.com") {
  stubFetch();
  const app = createApp();
  const { cookie } = await app.signUpConfirmed(email);
  return { app, cookie: cookie as string };
}

/** Makes every session look older than the 5-minute freshness window. */
const age = (app: TestApp, minutes = 10) =>
  app.sqlite
    .prepare("UPDATE session SET createdAt = ?")
    .run(new Date(Date.now() - minutes * 60_000).toISOString());

const pathOf = (link: string) => new URL(link).pathname + new URL(link).search;
const userId = (app: TestApp, email: string) =>
  (app.sqlite.prepare("SELECT id FROM user WHERE email = ?").get(email) as { id: string }).id;

describe("/api/me/prefs", () => {
  it("answers 401 without a session", async () => {
    const { app } = await setup();
    expect((await app.call("/api/me/prefs")).status).toBe(401);
    expect(
      (await app.call("/api/me/prefs", { method: "PATCH", body: { email: { news: true } } }))
        .status,
    ).toBe(401);
  });

  it("returns the defaults, then only what was changed", async () => {
    const { app, cookie } = await setup();
    const first = await app.call("/api/me/prefs", { cookie });
    expect(first.status).toBe(200);
    expect(first.json.prefs).toMatchObject({
      notifications: { submissions: true, lessons: true, helpReplies: true },
      email: { digest: true, reminders: true, news: false },
      reminders: { days: ["mon", "wed", "fri"], time: "19:00" },
      learning: { weeklyGoal: 3 },
    });
    const patched = await app.call("/api/me/prefs", {
      method: "PATCH",
      cookie,
      body: {
        email: { news: true },
        reminders: { days: ["sun", "mon", "mon"] },
        learning: { weeklyGoal: 5 },
      },
    });
    expect(patched.status).toBe(200);
    expect(patched.json.prefs).toMatchObject({
      notifications: { submissions: true, lessons: true, helpReplies: true },
      email: { digest: true, reminders: true, news: true },
      reminders: { days: ["mon", "sun"], time: "19:00" },
      learning: { weeklyGoal: 5 },
    });
    const again = await app.call("/api/me/prefs", {
      method: "PATCH",
      cookie,
      body: { email: { news: true } },
    });
    expect(again.json).toEqual(patched.json);
    expect((await app.call("/api/me/prefs", { cookie })).json).toEqual(patched.json);
  });

  it("refuses bad input", async () => {
    const { app, cookie } = await setup();
    for (const body of [
      {},
      { email: {} },
      { nope: true },
      { email: { news: "yes" } },
      { email: { extra: true } },
      { reminders: { time: "25:00" } },
      { reminders: { time: "7pm" } },
      { reminders: { days: ["funday"] } },
      { learning: { weeklyGoal: 0 } },
      { learning: { weeklyGoal: 15 } },
      { learning: { weeklyGoal: 2.5 } },
    ]) {
      const res = await app.call("/api/me/prefs", { method: "PATCH", cookie, body });
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.json.code).toBe("invalid_request");
    }
    expect(app.sqlite.prepare("SELECT COUNT(*) AS n FROM user_preferences").get()).toEqual({
      n: 0,
    });
  });

  it("keeps each learner's settings apart", async () => {
    const { app, cookie } = await setup();
    const other = (await app.signUpConfirmed("bo@example.com")).cookie as string;
    await app.call("/api/me/prefs", {
      method: "PATCH",
      cookie,
      body: { email: { digest: false } },
    });
    const theirs = await app.call("/api/me/prefs", { cookie: other });
    expect((theirs.json.prefs as { email: { digest: boolean } }).email.digest).toBe(true);
    await app.call("/api/me/prefs", {
      method: "PATCH",
      cookie: other,
      body: { learning: { weeklyGoal: 9 } },
    });
    const mine = await app.call("/api/me/prefs", { cookie });
    expect((mine.json.prefs as { learning: { weeklyGoal: number } }).learning.weeklyGoal).toBe(3);
    expect((mine.json.prefs as { email: { digest: boolean } }).email.digest).toBe(false);
  });

  it("rate limits writes per learner", async () => {
    const { app, cookie } = await setup();
    app.sqlite
      .prepare("INSERT INTO rate_limits (key, count, window_start) VALUES (?, 120, unixepoch())")
      .run(`prefs:user:${userId(app, "ada@example.com")}`);
    const res = await app.call("/api/me/prefs", {
      method: "PATCH",
      cookie,
      body: { email: { news: true } },
    });
    expect(res.status).toBe(429);
    expect(res.json.code).toBe("rate_limited");
    expect(res.headers.get("retry-after")).toBeTruthy();
  });
});

describe("GET /api/me/account", () => {
  it("needs a session and describes the account", async () => {
    const { app, cookie } = await setup();
    expect((await app.call("/api/me/account")).status).toBe(401);
    await app.call("/api/me/saved/design-tokens", { method: "PUT", cookie });
    const res = await app.call("/api/me/account", { cookie });
    expect(res.status).toBe(200);
    expect(res.json.account).toEqual({
      hasPassword: true,
      google: { linked: false },
      passkeyCount: 0,
      pendingEmail: null,
      counts: { saved: 1, submissions: 0 },
    });
  });
});

describe("email change", () => {
  const change = (app: TestApp, cookie: string, body: object) =>
    app.call("/api/me/account/email", { cookie, body });

  it("needs a session, valid input and a different address", async () => {
    const { app, cookie } = await setup();
    expect(
      (await app.call("/api/me/account/email", { body: { newEmail: "x@example.com" } })).status,
    ).toBe(401);
    expect((await change(app, cookie, { newEmail: "not-an-email" })).status).toBe(400);
    expect((await change(app, cookie, { newEmail: "a@b.c", extra: 1 })).status).toBe(400);
    const same = await change(app, cookie, { newEmail: "ADA@example.com" });
    expect(same.status).toBe(400);
    expect(same.json.code).toBe("same_email");
    expect(app.emails.filter((e) => e.type === "confirm-email-change")).toHaveLength(0);
  });

  it("asks for re-authentication when the session is not fresh", async () => {
    const { app, cookie } = await setup();
    age(app);
    const stale = await change(app, cookie, { newEmail: "new@example.com" });
    expect(stale.status).toBe(401);
    expect(stale.json.code).toBe("reauth_required");
    const wrong = await change(app, cookie, {
      newEmail: "new@example.com",
      password: "not the password at all",
    });
    expect(wrong.status).toBe(401);
    expect(app.emails.filter((e) => e.type === "confirm-email-change")).toHaveLength(0);
    const ok = await change(app, cookie, { newEmail: "new@example.com", password: GOOD_PASSWORD });
    expect(ok.status).toBe(200);
    expect(app.last("confirm-email-change")?.to).toBe("new@example.com");
  });

  it("sends the link to the new address only, and changes it once the link is opened", async () => {
    const { app, cookie } = await setup();
    const res = await change(app, cookie, { newEmail: "Ada.New@Example.com" });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ pendingEmail: "ada.new@example.com" });
    const sent = app.last("confirm-email-change");
    expect(sent?.to).toBe("ada.new@example.com");
    expect(sent?.link.startsWith("https://matrstudio.com/api/auth/verify-email")).toBe(true);
    expect(sent?.link).toContain(encodeURIComponent("/settings/confirm-email"));
    // Nothing changes before the link is used.
    const pending = await app.call("/api/me/account", { cookie });
    expect(pending.json.account).toMatchObject({ pendingEmail: { email: "ada.new@example.com" } });
    expect((await app.call("/api/me", { cookie })).json.email).toBe("ada@example.com");

    const link = pathOf(sent?.link ?? "");
    const done = await app.call(link, { origin: null });
    expect([200, 302]).toContain(done.status);
    expect(done.headers.get("location") ?? "").not.toContain("error=");
    expect((await app.call("/api/me", { cookie })).status).toBe(401); // sessions revoked
    expect(app.last("email-changed")?.to).toBe("ada@example.com"); // old address warned
    expect((await app.signIn("ada.new@example.com")).status).toBe(200);
    expect(app.sqlite.prepare("SELECT COUNT(*) AS n FROM pending_email_changes").get()).toEqual({
      n: 0,
    });
    // Single use.
    const again = await app.call(link, { origin: null });
    expect(again.headers.get("location")).toMatch(/error=already_confirmed/);
  });

  it("expires after 24 hours", async () => {
    const { app, cookie } = await setup();
    await change(app, cookie, { newEmail: "late@example.com" });
    const link = pathOf(app.last("confirm-email-change")?.link ?? "");
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 25 * 3600_000 });
    const res = await app.call(link, { origin: null });
    expect(res.headers.get("location")).toMatch(/error=link_expired/);
    vi.useRealTimers();
    expect(app.sqlite.prepare("SELECT email FROM user").get()).toEqual({
      email: "ada@example.com",
    });
  });

  it("cancelling kills the link, and a newer request replaces the older address", async () => {
    const { app, cookie } = await setup();
    await change(app, cookie, { newEmail: "one@example.com" });
    const first = pathOf(app.last("confirm-email-change")?.link ?? "");
    const cancel = await app.call("/api/me/account/email", { method: "DELETE", cookie });
    expect(cancel.json).toEqual({ cancelled: true });
    expect((await app.call("/api/me/account", { cookie })).json.account).toMatchObject({
      pendingEmail: null,
    });
    expect((await app.call(first, { origin: null })).headers.get("location")).toMatch(
      /error=link_invalid/,
    );

    await change(app, cookie, { newEmail: "two@example.com" });
    const second = pathOf(app.last("confirm-email-change")?.link ?? "");
    await change(app, cookie, { newEmail: "three@example.com" });
    expect((await app.call(second, { origin: null })).headers.get("location")).toMatch(
      /error=link_invalid/,
    );
    const third = pathOf(app.last("confirm-email-change")?.link ?? "");
    expect([200, 302]).toContain((await app.call(third, { origin: null })).status);
    expect((await app.signIn("three@example.com")).status).toBe(200);
  });

  it("resends the link to the same address, and 404s when nothing is pending", async () => {
    const { app, cookie } = await setup();
    expect((await app.call("/api/me/account/email/resend", { cookie, body: {} })).status).toBe(404);
    await change(app, cookie, { newEmail: "new@example.com" });
    const before = app.emails.filter((e) => e.type === "confirm-email-change").length;
    const res = await app.call("/api/me/account/email/resend", { cookie, body: {} });
    expect(res.status).toBe(200);
    expect(app.emails.filter((e) => e.type === "confirm-email-change")).toHaveLength(before + 1);
    expect(app.last("confirm-email-change")?.to).toBe("new@example.com");
  });

  it("answers the same for an address that is taken, and sends nothing", async () => {
    const { app, cookie } = await setup();
    await app.signUpConfirmed("bo@example.com");
    const res = await change(app, cookie, { newEmail: "bo@example.com" });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ pendingEmail: "bo@example.com" });
    expect(app.emails.filter((e) => e.type === "confirm-email-change")).toHaveLength(0);
    expect((await app.call("/api/me", { cookie })).json.email).toBe("ada@example.com");
  });

  it("is rate limited per learner", async () => {
    const { app, cookie } = await setup();
    for (const n of [1, 2, 3]) {
      expect((await change(app, cookie, { newEmail: `n${n}@example.com` })).status).toBe(200);
    }
    const res = await change(app, cookie, { newEmail: "n4@example.com" });
    expect(res.status).toBe(429);
    expect(res.json.code).toBe("rate_limited");
  });

  it("cannot be done through the raw Better Auth endpoint", async () => {
    const { app, cookie } = await setup();
    const res = await app.call("/api/auth/change-email", {
      cookie,
      body: { newEmail: "x@example.com" },
    });
    expect(res.status).toBe(404);
  });
});

describe("set a password and unlink Google", () => {
  /** A learner who signed up with Google: a google account row and no credential row. */
  async function googleOnly() {
    const { app, cookie } = await setup();
    const id = userId(app, "ada@example.com");
    app.sqlite.prepare("DELETE FROM account WHERE userId = ?").run(id);
    app.sqlite
      .prepare(
        "INSERT INTO account (id, accountId, providerId, userId, createdAt, updatedAt) VALUES ('g1', 'g-123', 'google', ?, datetime('now'), datetime('now'))",
      )
      .run(id);
    return { app, cookie, id };
  }

  it("sets a password once, on a fresh session, and lets Google be unlinked after", async () => {
    const { app, cookie, id } = await googleOnly();
    expect((await app.call("/api/me/account", { cookie })).json.account).toMatchObject({
      hasPassword: false,
      google: { linked: true },
    });
    const lonely = await app.call("/api/me/account/google", { method: "DELETE", cookie });
    expect(lonely.status).toBe(409);
    expect(lonely.json.code).toBe("last_sign_in_method");

    expect(
      (await app.call("/api/me/account/password", { cookie, body: { newPassword: "short" } }))
        .status,
    ).toBe(400);
    age(app);
    const stale = await app.call("/api/me/account/password", {
      cookie,
      body: { newPassword: GOOD_PASSWORD },
    });
    expect(stale.status).toBe(401);
    expect(stale.json.code).toBe("reauth_required");
    app.sqlite.prepare("UPDATE session SET createdAt = ?").run(new Date().toISOString());

    const set = await app.call("/api/me/account/password", {
      cookie,
      body: { newPassword: GOOD_PASSWORD },
    });
    expect(set.status).toBe(200);
    expect(set.json).toEqual({ hasPassword: true });
    expect(app.last("password-updated")?.to).toBe("ada@example.com");
    expect((await app.signIn("ada@example.com")).status).toBe(200);
    const twice = await app.call("/api/me/account/password", {
      cookie,
      body: { newPassword: GOOD_PASSWORD },
    });
    expect(twice.status).toBe(409);
    expect(twice.json.code).toBe("password_exists");

    age(app);
    const unlinked = await app.call("/api/me/account/google", { method: "DELETE", cookie });
    expect(unlinked.status).toBe(200);
    expect(
      app.sqlite
        .prepare("SELECT COUNT(*) AS n FROM account WHERE userId = ? AND providerId = 'google'")
        .get(id),
    ).toEqual({ n: 0 });
  });

  it("refuses a password that has been in a breach", async () => {
    const { app, cookie } = await googleOnly();
    const sha1 = createHash("sha1").update(GOOD_PASSWORD).digest("hex").toUpperCase();
    stubFetch((url) =>
      url.includes("pwnedpasswords.com")
        ? new Response(`${sha1.slice(5)}:9
`)
        : undefined,
    );
    const res = await app.call("/api/me/account/password", {
      cookie,
      body: { newPassword: GOOD_PASSWORD },
    });
    expect(res.status).toBe(400);
    expect(res.json.code).toBe("PASSWORD_COMPROMISED");
    expect((await app.call("/api/me/account", { cookie })).json.account).toMatchObject({
      hasPassword: false,
    });
  });

  it("needs a session", async () => {
    const { app } = await setup();
    expect(
      (await app.call("/api/me/account/password", { body: { newPassword: GOOD_PASSWORD } })).status,
    ).toBe(401);
    expect((await app.call("/api/me/account/google", { method: "DELETE" })).status).toBe(401);
  });
});

describe("GET /api/me/account/export", () => {
  it("returns the learner's own data without secrets", async () => {
    const { app, cookie } = await setup();
    const other = (await app.signUpConfirmed("bo@example.com")).cookie as string;
    await app.call("/api/me/saved/design-tokens", { method: "PUT", cookie });
    await app.call("/api/me/saved/other-thing", { method: "PUT", cookie: other });
    const res = await app.call("/api/me/account/export", { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.json.account).toMatchObject({ email: "ada@example.com" });
    expect(res.json.saved).toEqual([expect.objectContaining({ resource_id: "design-tokens" })]);
    expect(res.text).not.toMatch(/scrypt\$|"password"|"token"/i);
    expect((await app.call("/api/me/account/export")).status).toBe(401);
  });
});

describe("DELETE /api/me/account", () => {
  const del = (app: TestApp, cookie: string | undefined, body?: object) =>
    app.call("/api/me/account", { method: "DELETE", cookie, body: body ?? {} });

  it("needs a session", async () => {
    const { app } = await setup();
    expect((await del(app, undefined)).status).toBe(401);
  });

  it("needs re-authentication when the session is not fresh", async () => {
    const { app, cookie } = await setup();
    age(app);
    const none = await del(app, cookie);
    expect(none.status).toBe(401);
    expect(none.json.code).toBe("reauth_required");
    const wrong = await del(app, cookie, { password: "definitely not it, no" });
    expect(wrong.status).toBe(401);
    expect(app.sqlite.prepare("SELECT COUNT(*) AS n FROM user").get()).toEqual({ n: 1 });
    expect((await app.call("/api/me", { cookie })).status).toBe(200);
  });

  it("counts wrong passwords and stops after five", async () => {
    const { app, cookie } = await setup();
    age(app);
    for (let i = 0; i < 5; i++)
      expect((await del(app, cookie, { password: "wrong wrong wrong" })).status).toBe(401);
    const blocked = await del(app, cookie, { password: GOOD_PASSWORD });
    expect(blocked.status).toBe(429);
    expect(app.sqlite.prepare("SELECT COUNT(*) AS n FROM user").get()).toEqual({ n: 1 });
  });

  it("deletes the learner and what they own, and nobody else's data", async () => {
    const { app, cookie } = await setup();
    const other = (await app.signUpConfirmed("bo@example.com")).cookie as string;
    const id = userId(app, "ada@example.com");
    await app.call("/api/me/saved/design-tokens", { method: "PUT", cookie });
    await app.call("/api/me/saved/other-thing", { method: "PUT", cookie: other });
    await app.call("/api/me/prefs", { method: "PATCH", cookie, body: { email: { news: true } } });
    await app.call("/api/me/account/email", { cookie, body: { newEmail: "later@example.com" } });
    await app.call("/api/me/onboarding", { cookie, body: { goal: "learn_new_skill" } });
    age(app);
    const res = await del(app, cookie, { password: GOOD_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ deleted: true });
    expect(res.setCookies.join(";")).toContain("Max-Age=0");
    expect((await app.call("/api/me", { cookie })).status).toBe(401);
    for (const table of ["user", "session", "account", "onboarding", "verification"]) {
      const col = table === "user" ? "id" : table === "verification" ? "value" : "userId";
      expect(
        app.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`).get(id),
      ).toEqual({ n: 0 });
    }
    for (const table of ["saved_resources", "user_preferences", "pending_email_changes"]) {
      expect(
        app.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).get(id),
      ).toEqual({ n: 0 });
    }
    // The other learner is untouched.
    expect((await app.call("/api/me/saved", { cookie: other })).status).toBe(200);
    expect(app.sqlite.prepare("SELECT COUNT(*) AS n FROM saved_resources").get()).toEqual({ n: 1 });
    // The audit trail keeps the event but not who it was.
    const audit = app.sqlite
      .prepare("SELECT actor, target, ip, ua FROM audit_log WHERE action = 'account.deleted'")
      .all();
    expect(audit).toEqual([{ actor: null, target: null, ip: null, ua: null }]);
    expect(JSON.stringify(app.sqlite.prepare("SELECT * FROM audit_log").all())).not.toContain(
      "ada@example.com",
    );
    expect((await app.signIn("ada@example.com")).status).not.toBe(200);
  });

  it("works with a fresh session and no password (Google-only accounts)", async () => {
    const { app, cookie } = await setup();
    const res = await del(app, cookie);
    expect(res.status).toBe(200);
    expect(app.sqlite.prepare("SELECT COUNT(*) AS n FROM user").get()).toEqual({ n: 0 });
  });

  it("refuses unknown body fields", async () => {
    const { app, cookie } = await setup();
    expect((await del(app, cookie, { password: "x", sure: true })).status).toBe(400);
  });
});
