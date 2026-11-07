import { afterEach, describe, expect, it, vi } from "vitest";
import { sha256Hex } from "../src/auth/util";
import { createApp, GOOD_PASSWORD, stubFetch } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

const tokenOf = (cookie: string) =>
  decodeURIComponent(cookie.split("=")[1] ?? "").split(".")[0] ?? "";
const pathOf = (link: string) => new URL(link).pathname + new URL(link).search;

describe("session cookie and storage", () => {
  it("sets __Host-ms_session with HttpOnly, Secure, SameSite=Lax, Path=/ and no Domain", async () => {
    stubFetch();
    const app = createApp();
    const { verify } = await app.signUpConfirmed("ada@example.com");
    const raw = verify.setCookies.find((c) => c.startsWith("__Host-ms_session="));
    expect(raw).toBeTruthy();
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/Secure/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    expect(raw).toMatch(/Path=\//i);
    expect(raw).not.toMatch(/Domain=/i);
    // No other cookie slipped in without Secure.
    for (const c of verify.setCookies) expect(c).toMatch(/Secure/i);
  });

  it("stores only the SHA-256 of the cookie token, and the cookie still works", async () => {
    stubFetch();
    const app = createApp();
    const { cookie } = await app.signUpConfirmed("ada@example.com");
    const token = tokenOf(cookie as string);
    const row = app.sqlite.prepare("SELECT token FROM session").get() as { token: string };
    expect(row.token).not.toContain(token);
    expect(row.token).toBe(`sha256:${await sha256Hex(token)}`);
    expect((await app.call("/api/me", { cookie })).status).toBe(200);
    // The stored hash is not a credential: presenting it as the cookie token fails.
    const forged = `__Host-ms_session=${row.token}`;
    expect((await app.call("/api/me", { cookie: forged })).status).toBe(401);
  });

  it("starts a new session on every sign-in", async () => {
    stubFetch();
    const app = createApp();
    const { cookie } = await app.signUpConfirmed("ada@example.com");
    const again = await app.signIn("ada@example.com");
    expect(again.status).toBe(200);
    expect(again.cookie).toBeTruthy();
    expect(tokenOf(again.cookie as string)).not.toBe(tokenOf(cookie as string));
    expect(app.sqlite.prepare("SELECT COUNT(*) n FROM session").get()).toEqual({ n: 2 });
  });

  it("caps the sliding idle timeout at the 30-day absolute lifetime", async () => {
    stubFetch();
    const app = createApp();
    const { cookie } = await app.signUpConfirmed("ada@example.com");
    const day = 86400_000;
    const created = new Date(Date.now() - 29.5 * day).toISOString();
    app.sqlite
      .prepare("UPDATE session SET createdAt = ?, updatedAt = ?, expiresAt = ?")
      .run(
        created,
        new Date(Date.now() - 2 * day).toISOString(),
        new Date(Date.now() + day).toISOString(),
      );
    expect((await app.call("/api/me", { cookie })).status).toBe(200);
    const row = app.sqlite.prepare("SELECT createdAt, expiresAt FROM session").get() as {
      createdAt: string;
      expiresAt: string;
    };
    const maxExpiry = new Date(row.createdAt).getTime() + 30 * day;
    expect(new Date(row.expiresAt).getTime()).toBeLessThanOrEqual(maxExpiry + 1000);
    // Slid forward from "tomorrow" (7-day idle) but not beyond the cap.
    expect(new Date(row.expiresAt).getTime()).toBeGreaterThan(Date.now() + 0.4 * day);
  });

  it("rejects an expired session", async () => {
    stubFetch();
    const app = createApp();
    const { cookie } = await app.signUpConfirmed("ada@example.com");
    app.sqlite
      .prepare("UPDATE session SET expiresAt = ?")
      .run(new Date(Date.now() - 1000).toISOString());
    expect((await app.call("/api/me", { cookie })).status).toBe(401);
  });
});

describe("session revocation", () => {
  it("revokes the session on sign-out", async () => {
    stubFetch();
    const app = createApp();
    const { cookie } = await app.signUpConfirmed("ada@example.com");
    const out = await app.call("/api/auth/sign-out", { body: {}, cookie });
    expect(out.status).toBe(200);
    expect((await app.call("/api/me", { cookie })).status).toBe(401);
    expect(app.sqlite.prepare("SELECT COUNT(*) n FROM session").get()).toEqual({ n: 0 });
  });

  it("revokes all sessions after a password reset, and tells the owner", async () => {
    stubFetch();
    const app = createApp();
    const { cookie: first } = await app.signUpConfirmed("ada@example.com");
    const second = (await app.signIn("ada@example.com")).cookie;
    await app.call("/api/auth/request-password-reset", { body: { email: "ada@example.com" } });
    const reset = app.last("reset-password");
    expect(reset).toBeTruthy();
    const token = new URL(reset?.link ?? "").searchParams.get("token");
    const done = await app.call("/api/auth/reset-password", {
      body: { newPassword: "a brand new passphrase 77", token },
    });
    expect(done.status).toBe(200);
    expect((await app.call("/api/me", { cookie: first })).status).toBe(401);
    expect((await app.call("/api/me", { cookie: second })).status).toBe(401);
    expect(app.last("password-updated")?.to).toBe("ada@example.com");
    expect((await app.signIn("ada@example.com", "a brand new passphrase 77")).status).toBe(200);
    expect((await app.signIn("ada@example.com", GOOD_PASSWORD)).status).toBe(401);
  });

  it("revokes other sessions after a password change", async () => {
    stubFetch();
    const app = createApp();
    const { cookie: first } = await app.signUpConfirmed("ada@example.com");
    const second = (await app.signIn("ada@example.com")).cookie;
    const res = await app.call("/api/auth/change-password", {
      body: { currentPassword: GOOD_PASSWORD, newPassword: "another long passphrase 99" },
      cookie: first,
    });
    expect(res.status).toBe(200);
    expect((await app.call("/api/me", { cookie: second })).status).toBe(401);
    expect(app.last("password-updated")).toBeTruthy();
  });

  it("revokes all sessions after an email change and warns the old address", async () => {
    stubFetch();
    const app = createApp();
    const { cookie: first } = await app.signUpConfirmed("ada@example.com");
    const second = (await app.signIn("ada@example.com")).cookie;
    const req = await app.call("/api/auth/change-email", {
      body: { newEmail: "ada.new@example.com" },
      cookie: first,
    });
    expect(req.status).toBe(200);
    const confirm = app.last("confirm-email-change");
    expect(confirm?.to).toBe("ada.new@example.com");
    const done = await app.call(pathOf(confirm?.link ?? ""), { origin: null });
    expect([200, 302]).toContain(done.status);
    expect((await app.call("/api/me", { cookie: first })).status).toBe(401);
    expect((await app.call("/api/me", { cookie: second })).status).toBe(401);
    const notice = app.last("email-changed");
    expect(notice?.to).toBe("ada@example.com");
    expect(notice?.newEmailHint).toBe("a***@example.com");
    expect((await app.signIn("ada.new@example.com")).status).toBe(200);
  });
});

describe("email confirmation links", () => {
  it("is single use and tamper-proof, and the token is not stored in the clear", async () => {
    stubFetch();
    const app = createApp();
    await app.call("/api/auth/sign-up/email", {
      body: { email: "ada@example.com", password: GOOD_PASSWORD, name: "Ada" },
    });
    const link = app.last("confirm-email")?.link ?? "";
    const token = new URL(link).searchParams.get("token") ?? "";
    const bad = await app.call(pathOf(link.replace(token, `${token}x`)), { origin: null });
    expect(bad.headers.get("location") ?? bad.text).toMatch(/INVALID_TOKEN/);
    const rows = app.sqlite.prepare("SELECT identifier FROM verification").all() as {
      identifier: string;
    }[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.identifier).not.toContain(token);
    const ok = await app.call(pathOf(link), { origin: null });
    expect(ok.cookie).toBeTruthy();
    const again = await app.call(pathOf(link), { origin: null });
    expect(again.headers.get("location") ?? again.text).toMatch(/INVALID_TOKEN/);
    expect(again.cookie).toBeUndefined();
  });

  it("rejects an expired confirmation record", async () => {
    stubFetch();
    const app = createApp();
    await app.call("/api/auth/sign-up/email", {
      body: { email: "ada@example.com", password: GOOD_PASSWORD, name: "Ada" },
    });
    app.sqlite
      .prepare("UPDATE verification SET expiresAt = ?")
      .run(new Date(Date.now() - 1000).toISOString());
    const link = app.last("confirm-email")?.link ?? "";
    const res = await app.call(pathOf(link), { origin: null });
    expect(res.headers.get("location") ?? res.text).toMatch(/INVALID_TOKEN/);
    expect(res.cookie).toBeUndefined();
  });

  it("builds links on PUBLIC_WEB_URL with relative callbacks only", async () => {
    stubFetch();
    const app = createApp();
    await app.call("/api/auth/sign-up/email", {
      body: {
        email: "ada@example.com",
        password: GOOD_PASSWORD,
        name: "Ada",
        callbackURL: "https://evil.example/steal",
      },
    });
    const link = new URL(app.last("confirm-email")?.link ?? "");
    expect(link.origin).toBe("https://matrstudio.com");
    expect(link.searchParams.get("callbackURL")).toBe("/email-confirmed");
  });
});

describe("magic link", () => {
  async function request(app: ReturnType<typeof createApp>, email: string) {
    const res = await app.call("/api/auth/sign-in/magic-link", { body: { email } });
    expect(res.status).toBe(200);
    return app.last("magic-link")?.link ?? "";
  }

  it("signs in once, stores only a hash, and rejects reuse", async () => {
    stubFetch();
    const app = createApp();
    await app.signUpConfirmed("ada@example.com");
    const link = await request(app, "ada@example.com");
    const token = new URL(link).searchParams.get("token") ?? "";
    for (const r of app.sqlite.prepare("SELECT identifier FROM verification").all() as {
      identifier: string;
    }[]) {
      expect(r.identifier).not.toContain(token);
    }
    const ok = await app.call(pathOf(link), { origin: null });
    expect(ok.status).toBe(302);
    expect(ok.cookie).toBeTruthy();
    const again = await app.call(pathOf(link), { origin: null });
    expect(again.cookie).toBeUndefined();
    expect(again.headers.get("location")).toMatch(/INVALID_TOKEN/);
  });

  it("rejects tampered and expired links", async () => {
    stubFetch();
    const app = createApp();
    await app.signUpConfirmed("ada@example.com");
    const link = await request(app, "ada@example.com");
    const token = new URL(link).searchParams.get("token") ?? "";
    const swapped = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    const tampered = await app.call(pathOf(link.replace(token, swapped)), { origin: null });
    expect(tampered.cookie).toBeUndefined();
    expect(tampered.headers.get("location")).toMatch(/INVALID_TOKEN/);
    app.sqlite
      .prepare("UPDATE verification SET expiresAt = ?")
      .run(new Date(Date.now() - 1000).toISOString());
    const expired = await app.call(pathOf(link), { origin: null });
    expect(expired.cookie).toBeUndefined();
    expect(expired.headers.get("location")).toMatch(/INVALID_TOKEN/);
  });

  it("expires after 15 minutes", async () => {
    stubFetch();
    const app = createApp();
    await request(app, "ada@example.com");
    const row = app.sqlite.prepare("SELECT createdAt, expiresAt FROM verification").get() as {
      createdAt: string;
      expiresAt: string;
    };
    const ttl = new Date(row.expiresAt).getTime() - new Date(row.createdAt).getTime();
    expect(Math.round(ttl / 1000)).toBe(900);
  });

  it("creates a confirmed account for a new address (open sign-up)", async () => {
    stubFetch();
    const app = createApp();
    const link = await request(app, "new@example.com");
    const ok = await app.call(pathOf(link), { origin: null });
    expect(ok.cookie).toBeTruthy();
    const me = await app.call("/api/me", { cookie: ok.cookie });
    expect(me.json.emailVerified).toBe(true);
  });
});

describe("password reset tokens", () => {
  it("rejects tampered, expired and reused tokens", async () => {
    stubFetch();
    const app = createApp();
    await app.signUpConfirmed("ada@example.com");
    const ask = async () => {
      await app.call("/api/auth/request-password-reset", { body: { email: "ada@example.com" } });
      return new URL(app.last("reset-password")?.link ?? "").searchParams.get("token") ?? "";
    };
    const newPassword = "yet another passphrase 123";
    const token = await ask();
    const row = app.sqlite
      .prepare("SELECT createdAt, expiresAt FROM verification ORDER BY createdAt DESC")
      .get() as { createdAt: string; expiresAt: string };
    expect(
      Math.round((new Date(row.expiresAt).getTime() - new Date(row.createdAt).getTime()) / 1000),
    ).toBe(900);
    const tampered = await app.call("/api/auth/reset-password", {
      body: { newPassword, token: `${token}x` },
    });
    expect(tampered.status).toBe(400);
    app.sqlite
      .prepare("UPDATE verification SET expiresAt = ?")
      .run(new Date(Date.now() - 1000).toISOString());
    expect(
      (await app.call("/api/auth/reset-password", { body: { newPassword, token } })).status,
    ).toBe(400);
    const fresh = await ask();
    expect(
      (await app.call("/api/auth/reset-password", { body: { newPassword, token: fresh } })).status,
    ).toBe(200);
    const reuse = await app.call("/api/auth/reset-password", {
      body: { newPassword: `${newPassword}!`, token: fresh },
    });
    expect(reuse.status).toBe(400);
  });
});
