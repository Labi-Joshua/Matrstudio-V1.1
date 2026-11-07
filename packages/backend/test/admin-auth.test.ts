import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAccessKeyCache } from "../src/auth/access";
import { cancelAdminInvite, issueAdminInvite } from "../src/auth/admin-invites";
import { hashSessionToken } from "../src/auth/session-hash";
import { base32Encode } from "../src/auth/totp";
import {
  ADMIN_ORIGIN,
  ADMIN_PASSWORD,
  type AdminApp,
  BREACHED_PASSWORD,
  codeNow,
  createAdminApp,
} from "./admin-helpers";
import { GOOD_PASSWORD } from "./helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetAccessKeyCache();
});

const OWNER = "owner@example.com";
/** Freezes Date just after the start of a 30 s TOTP step, so a test cannot straddle a step boundary. */
const freezeInStep = () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Math.floor(Date.now() / 30000) * 30000 + 5000);
};
const row = <T = Record<string, unknown>>(app: AdminApp, sql: string, ...args: unknown[]) =>
  app.sqlite.prepare(sql).get(...(args as never[])) as T;
const rows = <T = Record<string, unknown>>(app: AdminApp, sql: string, ...args: unknown[]) =>
  app.sqlite.prepare(sql).all(...(args as never[])) as T[];
const me = (app: AdminApp, email: string, cookie: string) =>
  app.call("/api/admin/me", { as: email, cookie });

describe("invite lifecycle", () => {
  it("valid invite: set password, enrol 2-step, backup codes once, active session", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER, "super_admin", "Tolu Adeyemi");
    expect(a.backupCodes).toHaveLength(10);
    expect(a.enrol.json.admin).toMatchObject({
      email: OWNER,
      name: "Tolu Adeyemi",
      role: { id: "super_admin", name: "Super admin" },
      mfaEnrolled: true,
      fresh: true,
    });
    const status = row<{ status: string; totp_enrolled_at: number }>(
      app,
      "SELECT status, totp_enrolled_at FROM admin_users",
    );
    expect(status.status).toBe("active");
    expect((await me(app, OWNER, a.cookie)).status).toBe(200);
    // the invite email went through the queue, on the admin origin only
    const mail = app.emails.find((e) => e.type === "admin-invite");
    expect(
      mail && "link" in mail && mail.link.startsWith(`${ADMIN_ORIGIN}/accept-invite?token=`),
    ).toBe(true);
  });

  it("session cookie: __Host- prefix, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    const c = a.enrol.adminSetCookie as string;
    expect(c.startsWith("__Host-ms_admin_session=")).toBe(true);
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/Secure/i);
    expect(c).toMatch(/SameSite=Lax/i);
    expect(c).toMatch(/Path=\//i);
    expect(c).not.toMatch(/Domain=/i);
  });

  it("stores only hashes: invite token, session token, backup codes, TOTP secret", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    const dump = JSON.stringify([
      rows(app, "SELECT * FROM admin_invites"),
      rows(app, "SELECT * FROM admin_sessions"),
      rows(app, "SELECT * FROM admin_backup_codes"),
      rows(app, "SELECT * FROM admin_users"),
    ]);
    const sessionToken = a.cookie.split("=")[1] as string;
    expect(dump).not.toContain(a.invite.token);
    expect(dump).not.toContain(sessionToken);
    expect(dump).not.toContain(base32Encode(a.secret));
    expect(dump).not.toContain(ADMIN_PASSWORD);
    for (const code of a.backupCodes) expect(dump).not.toContain(code.replace("-", ""));
    expect(
      row<{ token_hash: string }>(app, "SELECT token_hash FROM admin_sessions").token_hash,
    ).toBe(await hashSessionToken(sessionToken));
  });

  it("a used invite cannot be used again", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    const again = await app.call("/api/admin/invite/accept", {
      as: OWNER,
      body: { token: a.invite.token, password: ADMIN_PASSWORD },
    });
    expect(again.status).toBe(400);
    expect(again.json.code).toBe("invite_invalid");
    const check = await app.call(`/api/admin/invite/check?token=${a.invite.token}`, { as: OWNER });
    expect(check.json.code).toBe("invite_invalid");
  });

  it("expired invite: invite_expired (with who invited and when) only for a validly signed token", async () => {
    const app = await createAdminApp();
    const boss = await app.enrolAdmin(OWNER, "super_admin", "Tolu Adeyemi");
    const inv = await issueAdminInvite(app.env, {
      email: "new@example.com",
      roleId: "super_admin",
      createdBy: boss.adminId,
    });
    app.sqlite
      .prepare("UPDATE admin_invites SET expires_at = unixepoch() - 10 WHERE id = ?")
      .run(inv.id);
    const res = await app.call("/api/admin/invite/accept", {
      as: "new@example.com",
      body: { token: inv.token, password: ADMIN_PASSWORD },
    });
    expect(res.status).toBe(400);
    expect(res.json.code).toBe("invite_expired");
    expect(res.json.invitedBy).toBe("Tolu Adeyemi");
    expect(typeof res.json.invitedAt).toBe("number");
    // the same, unsigned: no information
    const forged = inv.token.slice(0, -4) + "AAAA";
    const f = await app.call("/api/admin/invite/accept", {
      as: "new@example.com",
      body: { token: forged, password: ADMIN_PASSWORD },
    });
    expect(f.json.code).toBe("invite_invalid");
    expect(f.json.invitedBy).toBeUndefined();
  });

  it("cancelled invite: invite_cancelled for the token holder, and it cannot be accepted", async () => {
    const app = await createAdminApp();
    const inv = await issueAdminInvite(app.env, {
      email: "new@example.com",
      roleId: "super_admin",
    });
    expect(await cancelAdminInvite(app.env, { inviteId: inv.id })).toBe(true);
    expect(await cancelAdminInvite(app.env, { inviteId: inv.id })).toBe(false);
    const res = await app.call("/api/admin/invite/accept", {
      as: "new@example.com",
      body: { token: inv.token, password: ADMIN_PASSWORD },
    });
    expect(res.json.code).toBe("invite_cancelled");
    expect(row<{ status: string }>(app, "SELECT status FROM admin_users").status).toBe("invited"); // still cannot sign in
    expect(app.audit("admin.invite.cancelled")).toHaveLength(1);
  });

  it("tampered, truncated, foreign and unknown tokens all read invite_invalid", async () => {
    const app = await createAdminApp();
    const inv = await issueAdminInvite(app.env, {
      email: "new@example.com",
      roleId: "super_admin",
    });
    const [id, rand, sig] = inv.token.split(".") as [string, string, string];
    const other = await issueAdminInvite(app.env, {
      email: "other@example.com",
      roleId: "super_admin",
    });
    const cases = [
      "garbage",
      "",
      `${id}.${rand}`,
      `${id}.${rand}.${sig.slice(0, -1)}`,
      `${crypto.randomUUID()}.${rand}.${sig}`,
      `${id}.${"0".repeat(64)}.${sig}`,
      `${other.token.split(".")[0]}.${rand}.${sig}`,
    ];
    for (const token of cases) {
      const res = await app.call(`/api/admin/invite/check?token=${encodeURIComponent(token)}`, {
        as: "new@example.com",
      });
      expect(res.status).toBe(400);
      expect(res.json.code).toBe("invite_invalid");
    }
  });

  it("an invite is bound to its email: another Access identity gets invite_invalid, even when expired", async () => {
    const app = await createAdminApp();
    const inv = await issueAdminInvite(app.env, {
      email: "new@example.com",
      roleId: "super_admin",
    });
    const wrong = await app.call("/api/admin/invite/accept", {
      as: "intruder@example.com",
      body: { token: inv.token, password: ADMIN_PASSWORD },
    });
    expect(wrong.json.code).toBe("invite_invalid");
    app.sqlite.prepare("UPDATE admin_invites SET expires_at = unixepoch() - 10").run();
    const wrong2 = await app.call(`/api/admin/invite/check?token=${inv.token}`, {
      as: "intruder@example.com",
    });
    expect(wrong2.json.code).toBe("invite_invalid");
    expect(row(app, "SELECT password_hash FROM admin_users")).toEqual({ password_hash: null });
  });

  it("invite check shows a masked address, role and expiry for a valid token", async () => {
    const app = await createAdminApp();
    const inv = await issueAdminInvite(app.env, {
      email: "new@example.com",
      roleId: "super_admin",
    });
    const res = await app.call(`/api/admin/invite/check?token=${inv.token}`, {
      as: "new@example.com",
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      status: "ok",
      emailHint: "n***@example.com",
      role: "Super admin",
    });
    expect(Math.abs((res.json.expiresAt as number) - (Date.now() / 1000 + 72 * 3600))).toBeLessThan(
      5,
    );
  });

  it("enforces the password policy: 12+ characters and the breached-password check", async () => {
    const app = await createAdminApp();
    const inv = await issueAdminInvite(app.env, {
      email: "new@example.com",
      roleId: "super_admin",
    });
    const go = (password: string) =>
      app.call("/api/admin/invite/accept", {
        as: "new@example.com",
        body: { token: inv.token, password },
      });
    expect((await go("short")).json.code).toBe("password_too_short");
    expect((await go("a".repeat(129))).json.code).toBe("password_too_long");
    expect((await go(BREACHED_PASSWORD)).json.code).toBe("password_compromised");
    expect((await go(GOOD_PASSWORD)).status).toBe(200);
  });

  it("enrolment: needs the password step first, rejects a wrong code, and a code is not reusable", async () => {
    const app = await createAdminApp();
    const inv = await issueAdminInvite(app.env, {
      email: "new@example.com",
      roleId: "super_admin",
    });
    const early = await app.call("/api/admin/invite/enrol", {
      as: "new@example.com",
      body: { token: inv.token, code: "123456" },
    });
    expect(early.json.code).toBe("enrolment_not_started");
    await app.call("/api/admin/invite/accept", {
      as: "new@example.com",
      body: { token: inv.token, password: ADMIN_PASSWORD },
    });
    const bad = await app.call("/api/admin/invite/enrol", {
      as: "new@example.com",
      body: { token: inv.token, code: "000000" },
    });
    expect(bad.status).toBe(401);
    expect(bad.json.code).toBe("invalid_code");
    expect(row<{ status: string }>(app, "SELECT status FROM admin_users").status).toBe("invited");
    expect(
      row<{ used_at: number | null }>(app, "SELECT used_at FROM admin_invites").used_at,
    ).toBeNull();
  });

  it("the enrolment code cannot be replayed to sign in", async () => {
    freezeInStep();
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    const step1 = await app.call("/api/admin/sign-in", {
      as: OWNER,
      body: { email: OWNER, password: ADMIN_PASSWORD },
    });
    const replay = await app.call("/api/admin/sign-in/mfa", {
      as: OWNER,
      cookie: step1.adminCookie,
      body: { code: codeNow(a.secret) },
    });
    expect(replay.status).toBe(401);
    expect(replay.json.code).toBe("invalid_code");
  });
});

describe("bootstrap of the first super admin", () => {
  it("does nothing without ADMIN_BOOTSTRAP_EMAIL", async () => {
    const { bootstrapSuperAdmin } = await import("../src/auth/admin-invites");
    const app = await createAdminApp();
    expect(await bootstrapSuperAdmin(app.env)).toBe("disabled");
    expect(rows(app, "SELECT * FROM admin_users")).toHaveLength(0);
  });

  it("issues one super_admin invite, is idempotent while it is pending, and a no-op once a super admin exists", async () => {
    const { bootstrapSuperAdmin } = await import("../src/auth/admin-invites");
    const app = await createAdminApp({ ADMIN_BOOTSTRAP_EMAIL: "Founder@Example.com" });
    expect(await bootstrapSuperAdmin(app.env)).toBe("invited");
    expect(await bootstrapSuperAdmin(app.env)).toBe("pending");
    expect(rows(app, "SELECT * FROM admin_invites")).toHaveLength(1);
    expect(app.emails.filter((e) => e.type === "admin-invite")).toHaveLength(1);
    const mail = app.emails.find((e) => e.type === "admin-invite");
    expect(mail && "to" in mail && mail.to).toBe("founder@example.com");
    expect(
      row<{ role_id: string; password_hash: string | null }>(
        app,
        "SELECT role_id, password_hash FROM admin_users",
      ),
    ).toEqual({
      role_id: "super_admin",
      password_hash: null,
    });
    // complete it through the real flow
    const link = (mail as { link: string }).link;
    const token = new URL(link).searchParams.get("token") as string;
    const acc = await app.call("/api/admin/invite/accept", {
      as: "founder@example.com",
      body: { token, password: ADMIN_PASSWORD },
    });
    expect(acc.status).toBe(200);
    // still pending until enrolled
    expect(await bootstrapSuperAdmin(app.env)).toBe("pending");
    const { base32Decode } = await import("../src/auth/totp");
    const secret = base32Decode(
      new URL(acc.json.otpauthUri as string).searchParams.get("secret") as string,
    );
    const enrol = await app.call("/api/admin/invite/enrol", {
      as: "founder@example.com",
      body: { token, code: codeNow(secret) },
    });
    expect(enrol.status).toBe(200);
    expect(await bootstrapSuperAdmin(app.env)).toBe("exists");
    expect(await bootstrapSuperAdmin(app.env)).toBe("exists");
    expect(rows(app, "SELECT * FROM admin_users")).toHaveLength(1);
  });
});

describe("sign-in (password, then 2-step)", () => {
  it("signs in with password then an authenticator code", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    const { step1, step2 } = await app.signIn(a);
    expect(step1.status).toBe(200);
    expect(step1.json).toEqual({ status: "mfa_required" });
    expect(step2?.status).toBe(200);
    expect(step2?.json.admin).toMatchObject({ email: OWNER });
    expect(step2?.json.backupCodesRemaining).toBe(10);
  });

  it("a password-only (pending) session authorises nothing", async () => {
    const app = await createAdminApp();
    await app.enrolAdmin(OWNER);
    const step1 = await app.call("/api/admin/sign-in", {
      as: OWNER,
      body: { email: OWNER, password: ADMIN_PASSWORD },
    });
    expect((await me(app, OWNER, step1.adminCookie as string)).status).toBe(401);
    expect(
      (await app.call("/api/admin/team", { as: OWNER, cookie: step1.adminCookie })).status,
    ).toBe(401);
    // and the 2-step endpoint refuses a request with no pending session
    const none = await app.call("/api/admin/sign-in/mfa", { as: OWNER, body: { code: "123456" } });
    expect(none.status).toBe(401);
  });

  it("wrong password, unknown email, suspended account and wrong Access identity look identical", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    const wrongPw = await app.call("/api/admin/sign-in", {
      as: OWNER,
      body: { email: OWNER, password: "definitely wrong pass 1" },
    });
    const unknown = await app.call("/api/admin/sign-in", {
      as: "ghost@example.com",
      body: { email: "ghost@example.com", password: ADMIN_PASSWORD },
    });
    const mismatch = await app.call("/api/admin/sign-in", {
      as: "intruder@example.com",
      body: { email: OWNER, password: ADMIN_PASSWORD },
    });
    app.sqlite.prepare("UPDATE admin_users SET status = 'suspended'").run();
    const suspended = await app.call("/api/admin/sign-in", {
      as: OWNER,
      body: { email: OWNER, password: ADMIN_PASSWORD },
    });
    for (const r of [wrongPw, unknown, mismatch, suspended]) {
      expect(r.status).toBe(401);
      expect(r.json).toEqual({
        code: "invalid_credentials",
        message: "Check your email and password and try again.",
      });
      expect(r.adminCookie).toBeUndefined();
    }
    expect(a.adminId).toBeTruthy();
    // the identity mismatch is recorded for the owner to see
    expect(app.audit("admin.signin.access_mismatch").length).toBeGreaterThanOrEqual(1);
  });

  it("answers at a consistent time whether or not the account exists", async () => {
    const app = await createAdminApp();
    await app.enrolAdmin(OWNER);
    const time = async (email: string) => {
      const t = performance.now();
      await app.call("/api/admin/sign-in", {
        as: email,
        body: { email, password: "definitely wrong pass 1" },
      });
      return performance.now() - t;
    };
    const known = await time(OWNER);
    const unknown = await time("ghost@example.com");
    expect(known).toBeGreaterThanOrEqual(55);
    expect(unknown).toBeGreaterThanOrEqual(55);
    expect(Math.abs(known - unknown)).toBeLessThan(200);
  });

  it("a different Access identity cannot use an existing admin session either", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    expect((await me(app, OWNER, a.cookie)).status).toBe(200);
    expect((await me(app, "intruder@example.com", a.cookie)).status).toBe(401);
    expect(app.audit("admin.signin.access_mismatch").length).toBeGreaterThanOrEqual(1);
  });

  it("a backup code works once and only once, and is stored hashed", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    const code = a.backupCodes[0] as string;
    const s1 = await app.call("/api/admin/sign-in", {
      as: OWNER,
      body: { email: OWNER, password: ADMIN_PASSWORD },
    });
    const ok = await app.call("/api/admin/sign-in/mfa", {
      as: OWNER,
      cookie: s1.adminCookie,
      body: { code: code.toUpperCase() },
    });
    expect(ok.status).toBe(200);
    expect(ok.json.backupCodesRemaining).toBe(9);
    const s2 = await app.call("/api/admin/sign-in", {
      as: OWNER,
      body: { email: OWNER, password: ADMIN_PASSWORD },
    });
    const again = await app.call("/api/admin/sign-in/mfa", {
      as: OWNER,
      cookie: s2.adminCookie,
      body: { code },
    });
    expect(again.status).toBe(401);
    expect(again.json.code).toBe("invalid_code");
    expect(app.audit("admin.backup_code.used")).toHaveLength(1);
    const hashes = rows<{ code_hash: string }>(app, "SELECT code_hash FROM admin_backup_codes").map(
      (r) => r.code_hash,
    );
    expect(hashes).toHaveLength(10);
    expect(hashes.some((h) => h.includes(code.replace("-", "")))).toBe(false);
  });

  it("an authenticator code cannot be replayed (the used time-step is remembered)", async () => {
    freezeInStep();
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    app.sqlite.prepare("UPDATE admin_users SET totp_last_step = 0").run();
    const code = codeNow(a.secret);
    const s1 = await app.call("/api/admin/sign-in", {
      as: OWNER,
      body: { email: OWNER, password: ADMIN_PASSWORD },
    });
    expect(
      (
        await app.call("/api/admin/sign-in/mfa", {
          as: OWNER,
          cookie: s1.adminCookie,
          body: { code },
        })
      ).status,
    ).toBe(200);
    const s2 = await app.call("/api/admin/sign-in", {
      as: OWNER,
      body: { email: OWNER, password: ADMIN_PASSWORD },
    });
    const replay = await app.call("/api/admin/sign-in/mfa", {
      as: OWNER,
      cookie: s2.adminCookie,
      body: { code },
    });
    expect(replay.status).toBe(401);
    // an older step inside the window is refused too, a newer one is fine
    const older = await app.call("/api/admin/sign-in/mfa", {
      as: OWNER,
      cookie: s2.adminCookie,
      body: { code: codeNow(a.secret, -30) },
    });
    expect(older.status).toBe(401);
    const newer = await app.call("/api/admin/sign-in/mfa", {
      as: OWNER,
      cookie: s2.adminCookie,
      body: { code: codeNow(a.secret, 30) },
    });
    expect(newer.status).toBe(200);
  });

  it("sign-in is paused after 5 attempts per email: too_many_attempts, retryAfterSeconds, one notice email", async () => {
    const app = await createAdminApp();
    await app.enrolAdmin(OWNER);
    const bad = () =>
      app.call("/api/admin/sign-in", {
        as: OWNER,
        body: { email: OWNER, password: "definitely wrong pass 1" },
      });
    for (let i = 0; i < 4; i++) expect((await bad()).status).toBe(401);
    const fifth = await bad();
    expect(fifth.status).toBe(429);
    expect(fifth.json.code).toBe("too_many_attempts");
    expect(fifth.json.retryAfterSeconds).toBeGreaterThan(800);
    expect(fifth.headers.get("retry-after")).toBeTruthy();
    // even the right password is refused while paused
    const right = await app.call("/api/admin/sign-in", {
      as: OWNER,
      body: { email: OWNER, password: ADMIN_PASSWORD },
    });
    expect(right.status).toBe(429);
    await bad();
    const notices = app.emails.filter((e) => e.type === "admin-signin-paused");
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ to: OWNER });
    expect(app.audit("rate_limit.hit").length).toBeGreaterThan(0);
  });

  it("an unknown email is paused too, with no email sent (no enumeration)", async () => {
    const app = await createAdminApp();
    const bad = () =>
      app.call("/api/admin/sign-in", {
        as: "ghost@example.com",
        body: { email: "ghost@example.com", password: "definitely wrong pass 1" },
      });
    for (let i = 0; i < 4; i++) expect((await bad()).status).toBe(401);
    expect((await bad()).status).toBe(429);
    expect(app.emails.filter((e) => e.type === "admin-signin-paused")).toHaveLength(0);
  });

  it("per-IP limit: 20 attempts in 15 minutes, then paused", async () => {
    const app = await createAdminApp();
    const go = (i: number) =>
      app.call("/api/admin/sign-in", {
        as: `u${i}@example.com`,
        headers: { "cf-connecting-ip": "203.0.113.9" },
        body: { email: `u${i}@example.com`, password: "definitely wrong pass 1" },
      });
    for (let i = 0; i < 20; i++) expect((await go(i)).status).toBe(401);
    const res = await go(99);
    expect(res.status).toBe(429);
    expect(res.json.code).toBe("too_many_attempts");
  });

  it("2-step code: progressive delay after the 3rd wrong code, paused after the 5th, owner emailed, session ended", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    const s1 = await app.call("/api/admin/sign-in", {
      as: OWNER,
      body: { email: OWNER, password: ADMIN_PASSWORD },
    });
    const wrong = () =>
      app.call("/api/admin/sign-in/mfa", {
        as: OWNER,
        cookie: s1.adminCookie,
        body: { code: "000000" },
      });
    expect((await wrong()).json.code).toBe("invalid_code");
    expect((await wrong()).json.code).toBe("invalid_code");
    expect((await wrong()).json.code).toBe("invalid_code"); // 3rd: sets a 5 s delay
    const delayed = await wrong();
    expect(delayed.status).toBe(429);
    expect(delayed.json.code).toBe("too_many_attempts");
    expect(delayed.json.retryAfterSeconds).toBeLessThanOrEqual(5);
    // even the right code waits out the delay
    expect(
      (
        await app.call("/api/admin/sign-in/mfa", {
          as: OWNER,
          cookie: s1.adminCookie,
          body: { code: codeNow(a.secret, 30) },
        })
      ).status,
    ).toBe(429);
    app.sqlite.prepare("DELETE FROM rate_limits WHERE key LIKE 'adm:mfa:wait:%'").run();
    expect((await wrong()).json.code).toBe("invalid_code"); // 4th
    app.sqlite.prepare("DELETE FROM rate_limits WHERE key LIKE 'adm:mfa:wait:%'").run();
    const fifth = await wrong();
    expect(fifth.status).toBe(429);
    expect(fifth.json.code).toBe("too_many_attempts");
    expect(fifth.json.retryAfterSeconds).toBeGreaterThan(800);
    expect(app.emails.filter((e) => e.type === "admin-signin-paused")).toHaveLength(1);
    expect(rows(app, "SELECT * FROM admin_sessions")).toHaveLength(1); // only the one from enrolment: the pending one is gone
    app.sqlite.prepare("DELETE FROM rate_limits WHERE key LIKE 'adm:mfa:wait:%'").run();
    const s2 = await app.call("/api/admin/sign-in", {
      as: OWNER,
      body: { email: OWNER, password: ADMIN_PASSWORD },
    });
    const stillPaused = await app.call("/api/admin/sign-in/mfa", {
      as: OWNER,
      cookie: s2.adminCookie,
      body: { code: codeNow(a.secret, 30) },
    });
    expect(stillPaused.status).toBe(429);
  });
});

describe("sessions: lifetimes and isolation", () => {
  it("starts with a 30 minute idle deadline and a 12 hour absolute cap", async () => {
    const app = await createAdminApp();
    await app.enrolAdmin(OWNER);
    const s = row<{ created_at: number; expires_at: number; absolute_expires_at: number }>(
      app,
      "SELECT * FROM admin_sessions",
    );
    expect(s.expires_at - s.created_at).toBe(30 * 60);
    expect(s.absolute_expires_at - s.created_at).toBe(12 * 3600);
  });

  it("ends the session after 30 idle minutes", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    app.sqlite.prepare("UPDATE admin_sessions SET expires_at = unixepoch() - 1").run();
    expect((await me(app, OWNER, a.cookie)).status).toBe(401);
    expect(rows(app, "SELECT * FROM admin_sessions")).toHaveLength(0);
  });

  it("slides the idle deadline on use, never past the 12 hour cap", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    app.sqlite
      .prepare(
        "UPDATE admin_sessions SET last_seen_at = unixepoch() - 120, expires_at = unixepoch() + 100",
      )
      .run();
    expect((await me(app, OWNER, a.cookie)).status).toBe(200);
    const s1 = row<{ expires_at: number }>(app, "SELECT expires_at FROM admin_sessions");
    expect(Math.abs(s1.expires_at - (Date.now() / 1000 + 1800))).toBeLessThan(5);
    app.sqlite
      .prepare(
        "UPDATE admin_sessions SET last_seen_at = unixepoch() - 120, absolute_expires_at = unixepoch() + 600",
      )
      .run();
    expect((await me(app, OWNER, a.cookie)).status).toBe(200);
    const s2 = row<{ expires_at: number; absolute_expires_at: number }>(
      app,
      "SELECT expires_at, absolute_expires_at FROM admin_sessions",
    );
    expect(s2.expires_at).toBe(s2.absolute_expires_at);
  });

  it("ends the session at the 12 hour absolute lifetime even when active", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    app.sqlite.prepare("UPDATE admin_sessions SET absolute_expires_at = unixepoch() - 1").run();
    expect((await me(app, OWNER, a.cookie)).status).toBe(401);
  });

  it("a learner session never authorises admin routes, and an admin session never authorises learner routes", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    const learner = await app.signUpConfirmed("learner@example.com");
    expect(learner.cookie).toBeTruthy();
    // learner cookie on the admin API (right Access identity, right origin)
    expect((await me(app, OWNER, learner.cookie as string)).status).toBe(401);
    // learner token presented under the admin cookie name
    const learnerToken = decodeURIComponent((learner.cookie as string).split("=")[1] ?? "").split(
      ".",
    )[0];
    expect((await me(app, OWNER, `__Host-ms_admin_session=${learnerToken}`)).status).toBe(401);
    // admin cookie on learner routes
    const asLearner = await app.call("/api/me", { as: null, cookie: a.cookie });
    expect(asLearner.status).toBe(401);
    const adminToken = a.cookie.split("=")[1];
    expect(
      (await app.call("/api/me", { as: null, cookie: `__Host-ms_session=${adminToken}` })).status,
    ).toBe(401);
    // and the learner is still fine
    expect((await app.call("/api/me", { as: null, cookie: learner.cookie })).status).toBe(200);
  });
});

describe("revocation", () => {
  it("sign-out deletes the session at once and clears the cookie", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    const out = await app.call("/api/admin/sign-out", { as: OWNER, cookie: a.cookie, body: {} });
    expect(out.status).toBe(200);
    expect(out.adminSetCookie).toMatch(/Max-Age=0/);
    expect(rows(app, "SELECT * FROM admin_sessions")).toHaveLength(0);
    expect((await me(app, OWNER, a.cookie)).status).toBe(401);
    expect(app.audit("admin.signout")).toHaveLength(1);
  });

  it("password change needs step-up, revokes every session, and the new password works", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    const other = await app.signIn(a);
    expect(rows(app, "SELECT * FROM admin_sessions")).toHaveLength(2);
    const newPw = "another long passphrase 77";
    const stale = await app.call("/api/admin/password", {
      as: OWNER,
      cookie: a.cookie,
      body: { currentPassword: ADMIN_PASSWORD, newPassword: newPw },
    });
    expect(stale.status).toBe(200);
    expect(rows(app, "SELECT * FROM admin_sessions")).toHaveLength(0);
    expect((await me(app, OWNER, a.cookie)).status).toBe(401);
    expect((await me(app, OWNER, other.cookie as string)).status).toBe(401);
    expect((await app.signIn(a)).step1.status).toBe(401); // old password
    expect((await app.signIn(a, newPw)).step2?.status).toBe(200);
  });

  it("password change refuses a wrong current password, a weak new one, and a stale session", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    const go = (b: object) =>
      app.call("/api/admin/password", { as: OWNER, cookie: a.cookie, body: b });
    expect(
      (await go({ currentPassword: "nope nope nope 1", newPassword: "another long passphrase 77" }))
        .json.code,
    ).toBe("reauth_failed");
    expect((await go({ currentPassword: ADMIN_PASSWORD, newPassword: "short" })).json.code).toBe(
      "password_too_short",
    );
    expect(
      (await go({ currentPassword: ADMIN_PASSWORD, newPassword: BREACHED_PASSWORD })).json.code,
    ).toBe("password_compromised");
    app.sqlite.prepare("UPDATE admin_sessions SET last_reauth_at = unixepoch() - 400").run();
    expect(
      (await go({ currentPassword: ADMIN_PASSWORD, newPassword: "another long passphrase 77" }))
        .json.code,
    ).toBe("reauth_required");
  });

  it("suspension deletes the sessions at once and blocks sign-in", async () => {
    const { suspendAdmin } = await import("../src/auth/admin-perms");
    const app = await createAdminApp();
    const boss = await app.enrolAdmin(OWNER);
    const b = await app.enrolAdmin("b@example.com");
    expect(await suspendAdmin(app.env, { adminId: b.adminId, actor: boss.adminId })).toBe(true);
    expect(rows(app, "SELECT * FROM admin_sessions WHERE admin_id = ?", b.adminId)).toHaveLength(0);
    expect((await me(app, "b@example.com", b.cookie)).status).toBe(401);
    expect((await app.signIn(b)).step1.status).toBe(401);
    expect((await me(app, OWNER, boss.cookie)).status).toBe(200); // others untouched
    expect(app.audit("admin.suspended")).toHaveLength(1);
  });

  it("a role change deletes the sessions at once (the new role applies on the next sign-in)", async () => {
    const { changeAdminRole, createCustomRole } = await import("../src/auth/admin-perms");
    const app = await createAdminApp();
    const boss = await app.enrolAdmin(OWNER);
    const b = await app.enrolAdmin("b@example.com");
    const role = await createCustomRole(app.env, {
      name: "Editor",
      permissions: { resources: "manage" },
    });
    await changeAdminRole(app.env, { adminId: b.adminId, roleId: role.id, actor: boss.adminId });
    expect((await me(app, "b@example.com", b.cookie)).status).toBe(401);
    const again = await app.signIn(b);
    expect(again.step2?.json.admin).toMatchObject({ role: { name: "Editor" } });
    const audit = app.audit("admin.role.assigned")[0] as { meta: string };
    expect(JSON.parse(audit.meta)).toEqual({ before: "super_admin", after: role.id });
  });

  it("an MFA reset deletes sessions, clears the factor and sends a new invite", async () => {
    const { resetAdminMfa } = await import("../src/auth/admin-invites");
    const app = await createAdminApp();
    const boss = await app.enrolAdmin(OWNER);
    const b = await app.enrolAdmin("b@example.com");
    const before = app.emails.filter((e) => e.type === "admin-invite").length;
    expect(await resetAdminMfa(app.env, { adminId: b.adminId, actor: boss.adminId })).toBe(true);
    expect((await me(app, "b@example.com", b.cookie)).status).toBe(401);
    expect((await app.signIn(b)).step1.status).toBe(401);
    expect(
      row(
        app,
        "SELECT status, totp_secret_enc, password_hash FROM admin_users WHERE id = ?",
        b.adminId,
      ),
    ).toEqual({
      status: "invited",
      totp_secret_enc: null,
      password_hash: null,
    });
    expect(
      rows(app, "SELECT * FROM admin_backup_codes WHERE admin_id = ?", b.adminId),
    ).toHaveLength(0);
    expect(app.emails.filter((e) => e.type === "admin-invite")).toHaveLength(before + 1);
  });
});

describe("step-up re-authentication", () => {
  it("POST /reauth with password and code sets last_reauth_at; a wrong one does not", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    app.sqlite.prepare("UPDATE admin_sessions SET last_reauth_at = unixepoch() - 4000").run();
    app.sqlite.prepare("UPDATE admin_users SET totp_last_step = 0").run();
    const bad = await app.call("/api/admin/reauth", {
      as: OWNER,
      cookie: a.cookie,
      body: { password: "wrong wrong wrong 1", code: codeNow(a.secret) },
    });
    expect(bad.status).toBe(401);
    expect(bad.json.code).toBe("reauth_failed");
    expect((await me(app, OWNER, a.cookie)).json.fresh).toBe(false);
    const ok = await app.call("/api/admin/reauth", {
      as: OWNER,
      cookie: a.cookie,
      body: { password: ADMIN_PASSWORD, code: codeNow(a.secret) },
    });
    expect(ok.status).toBe(200);
    expect(Math.abs((ok.json.lastReauthAt as number) - Date.now() / 1000)).toBeLessThan(5);
    expect((await me(app, OWNER, a.cookie)).json.fresh).toBe(true);
    expect(app.audit("admin.reauth.success")).toHaveLength(1);
    expect(app.audit("admin.reauth.failure")).toHaveLength(1);
  });

  it("reauth failures draw on the same 5-attempt budget and end the session when paused", async () => {
    const app = await createAdminApp();
    const a = await app.enrolAdmin(OWNER);
    const wrong = () =>
      app.call("/api/admin/reauth", {
        as: OWNER,
        cookie: a.cookie,
        body: { password: "wrong wrong wrong 1", code: "000000" },
      });
    let last = await wrong();
    for (let i = 0; i < 4 && last.status !== 429; i++) {
      app.sqlite.prepare("DELETE FROM rate_limits WHERE key LIKE 'adm:mfa:wait:%'").run();
      last = await wrong();
    }
    expect(last.status).toBe(429);
    expect(last.json.code).toBe("too_many_attempts");
    expect(rows(app, "SELECT * FROM admin_sessions")).toHaveLength(0);
    expect(app.emails.filter((e) => e.type === "admin-signin-paused")).toHaveLength(1);
  });
});

describe("audit log", () => {
  it("records admin auth events and never emails, tokens, passwords, codes or secrets", async () => {
    const app = await createAdminApp({ ADMIN_BOOTSTRAP_EMAIL: undefined });
    const a = await app.enrolAdmin(OWNER, "super_admin", "Tolu Adeyemi");
    const s = await app.signIn(a);
    await app.call("/api/admin/sign-in", {
      as: OWNER,
      body: { email: OWNER, password: "definitely wrong pass 1" },
    });
    await app.call("/api/admin/sign-in", {
      as: "ghost@example.com",
      body: { email: "ghost@example.com", password: "definitely wrong pass 1" },
    });
    await app.call("/api/admin/sign-out", { as: OWNER, cookie: s.cookie, body: {} });
    const log = rows<{ action: string }>(app, "SELECT * FROM audit_log");
    const actions = new Set(log.map((r) => r.action));
    for (const want of [
      "admin.invite.created",
      "admin.password.set",
      "admin.mfa.enrolled",
      "admin.invite.accepted",
      "admin.signin.success",
      "admin.signin.failure",
      "admin.mfa.success",
      "admin.signout",
    ]) {
      expect(actions.has(want)).toBe(true);
    }
    const dump = JSON.stringify(log);
    expect(dump).not.toContain("@");
    expect(dump).not.toContain(ADMIN_PASSWORD);
    expect(dump).not.toContain("definitely wrong");
    expect(dump).not.toContain(a.invite.token);
    expect(dump).not.toContain(a.cookie.split("=")[1]);
    expect(dump).not.toContain(base32Encode(a.secret));
    expect(dump).not.toContain("Tolu");
    for (const c of a.backupCodes) expect(dump).not.toContain(c);
  });
});
