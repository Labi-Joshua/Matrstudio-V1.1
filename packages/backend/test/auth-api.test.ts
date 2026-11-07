import { afterEach, describe, expect, it, vi } from "vitest";
import { can } from "../src/auth/guard";
import { hashPassword, needsRehash, SCRYPT_DEFAULTS, verifyPassword } from "../src/auth/password";
import { hashSessionToken, withHashedSessionTokens } from "../src/auth/session-hash";
import { renderAuthEmail } from "../src/lib/auth-email-templates";
import { handleAuthEmailBatch } from "../src/queue/auth-email";
import { createApp, GOOD_PASSWORD, stubFetch } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe("CSRF, CORS and headers", () => {
  it("rejects state-changing requests with a missing or foreign Origin", async () => {
    stubFetch();
    const app = createApp();
    const body = { email: "a@example.com" };
    for (const origin of [
      null,
      "https://evil.example",
      "http://matrstudio.com",
      "https://matrstudio.com.evil.example",
    ]) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        const res = await app.call("/api/auth/request-password-reset", { method, body, origin });
        expect(res.status, `${method} ${origin}`).toBe(403);
        expect((res.json.error as { code: string }).code).toBe("forbidden_origin");
      }
    }
    expect(app.emails.length).toBe(0);
    // Allow-listed origins and plain GETs pass the guard.
    expect(
      (
        await app.call("/api/auth/request-password-reset", {
          body,
          origin: "https://www.matrstudio.com",
        })
      ).status,
    ).toBe(200);
    expect((await app.call("/health", { origin: null })).status).toBe(200);
  });

  it("applies to the other /api routes too", async () => {
    stubFetch();
    const app = createApp();
    const res = await app.call("/api/waitlist", {
      body: { email: "a@example.com" },
      origin: "https://evil.example",
    });
    expect(res.status).toBe(403);
  });

  it("answers CORS preflights with credentials only for the allow-list", async () => {
    stubFetch();
    const app = createApp();
    const ok = await app.call("/api/me/sessions/revoke", {
      method: "OPTIONS",
      origin: "https://matrstudio.com",
      headers: { "access-control-request-method": "DELETE" },
    });
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://matrstudio.com");
    expect(ok.headers.get("access-control-allow-credentials")).toBe("true");
    expect(ok.headers.get("access-control-allow-methods")).toMatch(/PATCH/);
    expect(ok.headers.get("access-control-allow-methods")).toMatch(/DELETE/);
    const bad = await app.call("/api/me", {
      method: "OPTIONS",
      origin: "https://evil.example",
      headers: { "access-control-request-method": "GET" },
    });
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
    expect(bad.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("puts the security headers on every API response, including errors", async () => {
    stubFetch();
    const app = createApp();
    for (const res of [
      await app.call("/api/me"),
      await app.call("/api/nope"),
      await app.call("/api/auth/ok"),
      await app.call("/api/auth/request-password-reset", {
        body: { email: "a@example.com" },
        origin: null,
      }),
    ]) {
      expect(res.headers.get("strict-transport-security")).toBe(
        "max-age=63072000; includeSubDomains; preload",
      );
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      expect(res.headers.get("permissions-policy")).toMatch(/camera=\(\)/);
      expect(res.headers.get("content-security-policy")).toMatch(
        /default-src 'none'.*frame-ancestors 'none'/,
      );
    }
  });
});

describe("/api/me", () => {
  it("denies by default and returns the signed-in learner", async () => {
    stubFetch();
    const app = createApp();
    expect((await app.call("/api/me")).status).toBe(401);
    expect((await app.call("/api/me/sessions")).status).toBe(401);
    const { cookie } = await app.signUpConfirmed("ada@example.com");
    const me = await app.call("/api/me", { cookie });
    expect(me.status).toBe(200);
    expect(me.json).toMatchObject({
      email: "ada@example.com",
      name: "Ada Obi",
      emailVerified: true,
      providers: ["password"],
      passkeyCount: 0,
      onboarding: { goal: null, level: null, topics: [], completed: false, completedAt: null },
    });
  });

  it("saves onboarding idempotently and sets completed_at once all answers exist", async () => {
    stubFetch();
    const app = createApp();
    const { cookie } = await app.signUpConfirmed("ada@example.com");
    const partial = await app.call("/api/me/onboarding", {
      body: { goal: "get_first_job" },
      cookie,
    });
    expect(partial.status).toBe(200);
    expect((partial.json.onboarding as { completed: boolean }).completed).toBe(false);
    const full = { goal: "get_first_job", level: "beginner", topics: ["ui-ux", "brand", "ui-ux"] };
    const a = await app.call("/api/me/onboarding", { body: full, cookie });
    const done = a.json.onboarding as { completed: boolean; completedAt: number; topics: string[] };
    expect(done.completed).toBe(true);
    expect(done.topics).toEqual(["ui-ux", "brand"]);
    const b = await app.call("/api/me/onboarding", { body: full, cookie });
    expect(b.json).toEqual(a.json);
    expect(app.sqlite.prepare("SELECT COUNT(*) n FROM onboarding").get()).toEqual({ n: 1 });
    expect((await app.call("/api/me", { cookie })).json.onboarding).toEqual(done);
  });

  it("validates onboarding input and strips nothing silently", async () => {
    stubFetch();
    const app = createApp();
    const { cookie } = await app.signUpConfirmed("ada@example.com");
    for (const body of [
      {},
      { goal: "world_domination" },
      { topics: [] },
      { level: "beginner", admin: true },
    ]) {
      const res = await app.call("/api/me/onboarding", { body, cookie });
      expect(res.status).toBe(400);
      expect(res.json.code).toBe("invalid_request");
    }
  });

  it("lists sessions without token hashes, and revokes the others", async () => {
    stubFetch();
    const app = createApp();
    const { cookie } = await app.signUpConfirmed("ada@example.com");
    await app.signIn("ada@example.com");
    await app.signIn("ada@example.com");
    const list = await app.call("/api/me/sessions", { cookie });
    expect(list.status).toBe(200);
    const sessions = list.json.sessions as Array<Record<string, unknown>>;
    expect(sessions).toHaveLength(3);
    expect(sessions.filter((s) => s.current)).toHaveLength(1);
    expect(list.text).not.toContain("sha256");
    for (const s of sessions) {
      expect(Object.keys(s).sort()).toEqual([
        "createdAt",
        "current",
        "device",
        "id",
        "ip",
        "lastSeenAt",
      ]);
      expect(s.device).toBe("Chrome on macOS");
      expect(String(s.ip)).toMatch(/\.0$/);
    }
    const res = await app.call("/api/me/sessions/revoke-others", {
      method: "POST",
      body: {},
      cookie,
    });
    expect(res.json.revoked).toBe(2);
    expect((await app.call("/api/me", { cookie })).status).toBe(200);
    expect(app.sqlite.prepare("SELECT COUNT(*) n FROM session").get()).toEqual({ n: 1 });
  });

  it("IDOR: user A cannot see or revoke user B's sessions", async () => {
    stubFetch();
    const app = createApp();
    const a = await app.signUpConfirmed("a@example.com");
    const b = await app.signUpConfirmed("b@example.com");
    const bSessions = (await app.call("/api/me/sessions", { cookie: b.cookie })).json
      .sessions as Array<{ id: string }>;
    const bId = bSessions[0]?.id ?? "";
    const aList = (await app.call("/api/me/sessions", { cookie: a.cookie })).json
      .sessions as Array<{ id: string }>;
    expect(aList.map((s) => s.id)).not.toContain(bId);
    const attack = await app.call("/api/me/sessions/revoke", {
      body: { id: bId },
      cookie: a.cookie,
    });
    expect(attack.status).toBe(404);
    expect((await app.call("/api/me", { cookie: b.cookie })).status).toBe(200);
    // revoke-others only touches the caller's own sessions.
    await app.call("/api/me/sessions/revoke-others", {
      method: "POST",
      body: {},
      cookie: a.cookie,
    });
    expect((await app.call("/api/me", { cookie: b.cookie })).status).toBe(200);
    // A user id in the body is ignored.
    const spoof = await app.call("/api/me/sessions/revoke-others", {
      method: "POST",
      body: { userId: "someone-else" },
      cookie: a.cookie,
    });
    expect(spoof.status).toBe(200);
    expect((await app.call("/api/me", { cookie: b.cookie })).status).toBe(200);
  });

  it("deletes the account: needs re-authentication, removes data, revokes sessions, anonymises audit rows", async () => {
    stubFetch();
    const app = createApp();
    const { cookie } = await app.signUpConfirmed("ada@example.com");
    const other = await app.signUpConfirmed("keep@example.com");
    // A stale session needs the password.
    app.sqlite
      .prepare("UPDATE session SET createdAt = ?")
      .run(new Date(Date.now() - 3600_000).toISOString());
    const noPw = await app.call("/api/me", { method: "DELETE", body: {}, cookie });
    expect(noPw.status).toBe(401);
    expect(noPw.json.code).toBe("reauth_required");
    const wrong = await app.call("/api/me", {
      method: "DELETE",
      body: { password: "not the password at all" },
      cookie,
    });
    expect(wrong.status).toBe(401);
    expect((await app.call("/api/me", { cookie })).status).toBe(200);
    await app.call("/api/me/onboarding", { body: { goal: "level_up" }, cookie });
    const done = await app.call("/api/me", {
      method: "DELETE",
      body: { password: GOOD_PASSWORD },
      cookie,
    });
    expect(done.status).toBe(200);
    expect(done.setCookies.join(";")).toMatch(/__Host-ms_session=;/);
    expect((await app.call("/api/me", { cookie })).status).toBe(401);
    expect(
      app.sqlite.prepare("SELECT COUNT(*) n FROM user WHERE email = 'ada@example.com'").get(),
    ).toEqual({ n: 0 });
    expect(
      app.sqlite.prepare("SELECT COUNT(*) n FROM account WHERE providerId = 'credential'").get(),
    ).toEqual({ n: 1 });
    expect(app.sqlite.prepare("SELECT COUNT(*) n FROM onboarding").get()).toEqual({ n: 0 });
    // Audit rows survive, anonymised.
    const rows = app.sqlite
      .prepare("SELECT actor, target, ip, ua, action FROM audit_log")
      .all() as Array<Record<string, unknown>>;
    expect(rows.some((r) => r.action === "account.deleted")).toBe(true);
    const keepId = (await app.call("/api/me", { cookie: other.cookie })).json.id;
    for (const r of rows) {
      if (r.actor !== null) expect(r.actor).toBe(keepId);
    }
    expect((await app.call("/api/me", { cookie: other.cookie })).status).toBe(200);
  });

  it("a fresh session can delete without the password", async () => {
    stubFetch();
    const app = createApp();
    const { cookie } = await app.signUpConfirmed("ada@example.com");
    const res = await app.call("/api/me", { method: "DELETE", cookie });
    expect(res.status).toBe(200);
  });
});

describe("audit log", () => {
  it("is append-only: update and delete fail, anonymisation is the only allowed update", async () => {
    stubFetch();
    const app = createApp();
    await app.signUpConfirmed("ada@example.com");
    await app.signIn("ada@example.com", "definitely the wrong one 1");
    const n = (app.sqlite.prepare("SELECT COUNT(*) n FROM audit_log").get() as { n: number }).n;
    expect(n).toBeGreaterThan(0);
    expect(() => app.sqlite.prepare("DELETE FROM audit_log").run()).toThrow(/append-only/);
    expect(() => app.sqlite.prepare("DELETE FROM audit_log WHERE id = 1").run()).toThrow(
      /append-only/,
    );
    expect(() => app.sqlite.prepare("UPDATE audit_log SET action = 'x'").run()).toThrow(
      /append-only/,
    );
    expect(() => app.sqlite.prepare("UPDATE audit_log SET meta = '{}'").run()).toThrow(
      /append-only/,
    );
    expect(() => app.sqlite.prepare("UPDATE audit_log SET actor = 'forged'").run()).toThrow(
      /append-only/,
    );
    expect(() =>
      app.sqlite
        .prepare(
          "UPDATE audit_log SET actor = NULL, target = NULL, ip = NULL, ua = NULL, created_at = 0",
        )
        .run(),
    ).toThrow(/append-only/);
    app.sqlite
      .prepare("UPDATE audit_log SET actor = NULL, target = NULL, ip = NULL, ua = NULL")
      .run();
    expect(app.sqlite.prepare("SELECT COUNT(*) n FROM audit_log").get()).toEqual({ n });
  });

  it("records events without emails, tokens or full IPs", async () => {
    stubFetch();
    const app = createApp();
    const ip = { "cf-connecting-ip": "203.0.113.77" };
    await app.call("/api/auth/sign-up/email", {
      body: { email: "ada@example.com", password: GOOD_PASSWORD, name: "Ada" },
      headers: ip,
    });
    await app.call("/api/auth/sign-in/email", {
      body: { email: "ada@example.com", password: "definitely the wrong one 1" },
      headers: ip,
    });
    await app.call("/api/auth/sign-in/magic-link", {
      body: { email: "ada@example.com" },
      headers: ip,
    });
    await app.call("/api/auth/request-password-reset", {
      body: { email: "ada@example.com" },
      headers: ip,
    });
    const dump = JSON.stringify(app.sqlite.prepare("SELECT * FROM audit_log").all());
    expect(dump).not.toContain("ada@example.com");
    expect(dump).not.toContain("203.0.113.77");
    expect(dump).toContain("203.0.113.0");
    for (const e of app.emails) {
      const token = "link" in e ? new URL(e.link).searchParams.get("token") : null;
      if (token) expect(dump).not.toContain(token);
    }
    const actions = (
      app.sqlite.prepare("SELECT action FROM audit_log").all() as { action: string }[]
    ).map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "signup",
        "signin.failure",
        "magic_link.sent",
        "password_reset.requested",
      ]),
    );
  });
});

describe("Better Auth surface", () => {
  it("serves the passkey and magic-link routes, and keeps list-sessions off the wire", async () => {
    stubFetch();
    const app = createApp();
    expect((await app.call("/api/auth/passkey/generate-register-options")).status).toBe(401);
    expect((await app.call("/api/auth/passkey/generate-authenticate-options")).status).toBe(200);
    expect((await app.call("/api/auth/ok")).status).toBe(200);
    const { cookie } = await app.signUpConfirmed("ada@example.com");
    const listed = await app.call("/api/auth/list-sessions", { cookie });
    expect(listed.status).toBe(404);
    expect(listed.text).not.toContain("sha256");
  });

  it("does not enable Google sign-in without its secrets", async () => {
    stubFetch();
    const app = createApp();
    const res = await app.call("/api/auth/sign-in/social", {
      body: { provider: "google", callbackURL: "/dashboard" },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const withGoogle = createApp({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" });
    const ok = await withGoogle.call("/api/auth/sign-in/social", {
      body: { provider: "google", callbackURL: "/dashboard" },
    });
    expect(ok.status).toBe(200);
    expect(String(ok.json.url)).toMatch(/^https:\/\/accounts\.google\.com\//);
  });
});

describe("password hashing", () => {
  const fast = { N: 1024, r: 8, p: 1 };

  it("uses scrypt with OWASP parameters by default and a self-describing format", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(stored.startsWith(`scrypt$N=${SCRYPT_DEFAULTS.N},r=8,p=1$`)).toBe(true);
    expect(needsRehash(stored)).toBe(false);
    expect(await verifyPassword(stored, "correct horse battery staple")).toBe(true);
    expect(await verifyPassword(stored, "correct horse battery stapl3")).toBe(false);
  }, 20_000);

  it("salts every hash, and verifies against the parameters stored in the string", async () => {
    const a = await hashPassword("same password", fast);
    const b = await hashPassword("same password", fast);
    expect(a).not.toBe(b);
    expect(needsRehash(a)).toBe(true);
    expect(await verifyPassword(a, "same password")).toBe(true);
    expect(await verifyPassword(b, "same password")).toBe(true);
    expect(await verifyPassword(a, "other password")).toBe(false);
  });

  it("never verifies malformed or downgraded hashes", async () => {
    for (const bad of [
      "",
      "plain",
      "scrypt$N=3,r=8,p=1$YWFhYWFhYWFh$YWFhYWFhYWFhYWFhYWFhYQ",
      "scrypt$N=1024,r=8,p=1$$",
      "md5$abc$def",
    ]) {
      expect(await verifyPassword(bad, "whatever")).toBe(false);
    }
  });

  it("compares the derived key in constant time (timingSafeEqual, no early exit)", async () => {
    const src = (await import("node:fs")).readFileSync(
      `${import.meta.dirname}/../src/auth/password.ts`,
      "utf8",
    );
    expect(src).toContain("timingSafeEqual(key, parsed.key)");
    expect(src).not.toMatch(/key\s*===\s*parsed\.key|\.equals\(/);
  });
});

describe("session hash layer (unit)", () => {
  function fakeInner() {
    const rows: Array<Record<string, unknown>> = [];
    const calls: string[] = [];
    const where = (w: Array<{ field: string; value: unknown }>) => (r: Record<string, unknown>) =>
      w.every((c) =>
        Array.isArray(c.value) ? c.value.includes(r[c.field]) : r[c.field] === c.value,
      );
    const inner = {
      id: "fake",
      async create({ data }: { data: Record<string, unknown> }) {
        calls.push("create");
        rows.push({ ...data });
        return { ...data };
      },
      async findOne({ where: w }: { where: Array<{ field: string; value: unknown }> }) {
        return rows.find(where(w)) ?? null;
      },
      async findMany({ where: w }: { where?: Array<{ field: string; value: unknown }> }) {
        return w ? rows.filter(where(w)) : [...rows];
      },
      async count() {
        return rows.length;
      },
      async update({
        where: w,
        update,
      }: {
        where: Array<{ field: string; value: unknown }>;
        update: Record<string, unknown>;
      }) {
        const r = rows.find(where(w));
        if (!r) return null;
        Object.assign(r, update);
        return { ...r };
      },
      async updateMany() {
        return 0;
      },
      async delete({ where: w }: { where: Array<{ field: string; value: unknown }> }) {
        const i = rows.findIndex(where(w));
        if (i >= 0) rows.splice(i, 1);
      },
      async deleteMany({ where: w }: { where: Array<{ field: string; value: unknown }> }) {
        const keep = rows.filter((r) => !where(w)(r));
        const n = rows.length - keep.length;
        rows.length = 0;
        rows.push(...keep);
        return n;
      },
      async consumeOne() {
        return null;
      },
      async incrementOne() {
        return null;
      },
      async transaction<R>(cb: (t: unknown) => Promise<R>) {
        return cb(inner);
      },
    };
    return { inner, rows, calls };
  }
  const opts = { absoluteMs: 30 * 86400_000 };
  const base = { model: "session" };

  it("stores a hash on create but returns the plain token", async () => {
    const { inner, rows } = fakeInner();
    const a = withHashedSessionTokens(inner as never, opts);
    const created = await a.create({
      ...base,
      data: { id: "s1", token: "plain-token-1", userId: "u1" },
    } as never);
    expect((created as { token: string }).token).toBe("plain-token-1");
    expect(rows[0]?.token).toBe(await hashSessionToken("plain-token-1"));
    expect(String(rows[0]?.token)).not.toContain("plain-token-1");
  });

  it("looks up, updates and deletes by the plain token; lists by user return only hashes", async () => {
    const { inner, rows } = fakeInner();
    const a = withHashedSessionTokens(inner as never, opts);
    await a.create({ ...base, data: { id: "s1", token: "t1", userId: "u1" } } as never);
    await a.create({ ...base, data: { id: "s2", token: "t2", userId: "u1" } } as never);
    const found = await a.findOne<{ id: string; token: string }>({
      ...base,
      where: [{ field: "token", value: "t1" }],
    });
    expect(found).toMatchObject({ id: "s1", token: "t1" });
    expect(await a.findOne({ ...base, where: [{ field: "token", value: "nope" }] })).toBeNull();
    const upd = await a.update<{ token: string; ipAddress: string }>({
      ...base,
      where: [{ field: "token", value: "t1" }],
      update: { ipAddress: "1.2.3.0" },
    });
    expect(upd).toMatchObject({ token: "t1", ipAddress: "1.2.3.0" });
    const listed = await a.findMany<{ token: string }>({
      ...base,
      where: [{ field: "userId", value: "u1" }],
    });
    expect(listed.map((r) => r.token).every((t) => t.startsWith("sha256:"))).toBe(true);
    // Deleting with tokens read back from a listing (Better Auth's revoke-others) works.
    const n = await a.deleteMany({
      ...base,
      where: [{ field: "token", value: [listed[1]?.token], operator: "in" }],
    } as never);
    expect(n).toBe(1);
    await a.delete({ ...base, where: [{ field: "token", value: "t1" }] });
    expect(rows).toHaveLength(0);
  });

  it("never treats a stored hash as a login credential", async () => {
    const { inner } = fakeInner();
    const a = withHashedSessionTokens(inner as never, opts);
    await a.create({ ...base, data: { id: "s1", token: "t1", userId: "u1" } } as never);
    const hash = await hashSessionToken("t1");
    expect(await a.findOne({ ...base, where: [{ field: "token", value: hash }] })).toBeNull();
    expect(
      await a.findMany({
        ...base,
        where: [{ field: "token", value: [hash], operator: "in" }],
      } as never),
    ).toEqual([]);
  });

  it("leaves other models alone", async () => {
    const { inner, rows } = fakeInner();
    const a = withHashedSessionTokens(inner as never, opts);
    await a.create({ model: "verification", data: { token: "keep-me" } } as never);
    expect(rows[0]?.token).toBe("keep-me");
  });
});

describe("auth email queue consumer", () => {
  const msg = (type: "magic-link" | "reset-password" | "confirm-email") => ({
    type,
    to: "ada@example.com",
    link: "https://matrstudio.com/x?token=abc",
  });
  const batchOf = (bodies: unknown[], attempts = 1) => {
    const acks: string[] = [];
    const messages = bodies.map((body, i) => ({
      id: String(i),
      body,
      attempts,
      ack: () => void acks.push("ack"),
      retry: (o?: unknown) => void acks.push(`retry:${JSON.stringify(o)}`),
    }));
    return { batch: { messages } as unknown as MessageBatch<never>, acks };
  };

  it("sends through Resend and acks", async () => {
    const spy = stubFetch((url) =>
      url.includes("api.resend.com") ? Response.json({ id: "1" }) : undefined,
    );
    const app = createApp({ RESEND_API_KEY: "re_test" });
    const { batch, acks } = batchOf([msg("magic-link")]);
    await handleAuthEmailBatch(batch, app.env);
    expect(acks).toEqual(["ack"]);
    const call = spy.mock.calls.find((c) => String(c[0]).includes("api.resend.com"));
    const sent = JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));
    expect(sent).toMatchObject({ to: "ada@example.com", subject: "Your Matr Studio sign-in link" });
    expect(sent.html).toContain("https://matrstudio.com/x?token=abc");
  });

  it("retries on failure, and on the last attempt acks and audits email.dropped", async () => {
    stubFetch((url) =>
      url.includes("api.resend.com") ? new Response("no", { status: 500 }) : undefined,
    );
    const app = createApp({ RESEND_API_KEY: "re_test" });
    const first = batchOf([msg("reset-password")], 1);
    await handleAuthEmailBatch(first.batch, app.env);
    expect(first.acks[0]).toMatch(/^retry:/);
    const last = batchOf([msg("reset-password")], 4);
    await handleAuthEmailBatch(last.batch, app.env);
    expect(last.acks).toEqual(["ack"]);
    const rows = app.sqlite.prepare("SELECT * FROM audit_log WHERE action = 'email.dropped'").all();
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain("ada@example.com");
  });

  it("does not send mail from the request path", async () => {
    const spy = stubFetch();
    const app = createApp({ RESEND_API_KEY: "re_test" });
    await app.call("/api/auth/request-password-reset", { body: { email: "ada@example.com" } });
    await app.call("/api/auth/sign-in/magic-link", { body: { email: "ada@example.com" } });
    expect(spy.mock.calls.some((c) => String(c[0]).includes("resend.com"))).toBe(false);
    expect(app.emails.length).toBeGreaterThan(0);
  });
});

describe("email templates", () => {
  const web = "https://matrstudio.com";
  it("use the Figma copy verbatim", () => {
    const confirm = renderAuthEmail(web, {
      type: "confirm-email",
      to: "ada@example.com",
      link: `${web}/l`,
    });
    expect(confirm.subject).toBe("Confirm your email to finish setting up Matr Studio");
    expect(confirm.html).toContain("Confirm my email");
    expect(confirm.html).toContain("This link expires in 24 hours.");
    const reset = renderAuthEmail(web, { type: "reset-password", to: "a@b.c", link: `${web}/l` });
    expect(reset.subject).toBe("Reset your Matr Studio password");
    expect(reset.html).toContain(
      "Someone, hopefully you, asked to reset your Matr Studio password.",
    );
    expect(reset.html).toContain("Didn’t ask for this? Ignore it. Your password stays the same.");
    const changed = renderAuthEmail(web, {
      type: "password-updated",
      to: "a@b.c",
      when: "now",
      device: "Chrome on macOS",
    });
    expect(changed.subject).toBe("Your Matr Studio password was changed");
    expect(changed.html).toContain(
      "Wasn’t you? Reset your password right away and reply to this email so we can help.",
    );
    const paused = renderAuthEmail(web, {
      type: "too-many-attempts",
      to: "a@b.c",
      when: "now",
      device: "x",
    });
    expect(paused.subject).toBe("Unusual sign-in activity on your Matr Studio account");
    expect(paused.html).toContain("We saw 5 wrong passwords on your account");
  });

  it("escape the recipient and link", () => {
    const out = renderAuthEmail(web, {
      type: "confirm-email",
      to: "<script>@x.co",
      link: `${web}/l?a="b"`,
    });
    expect(out.html).not.toContain("<script>@x.co");
    expect(out.html).toContain("&#60;script&#62;@x.co");
  });
});

describe("can()", () => {
  const learner = { id: "u", email: "a@b.c", name: "A", emailVerified: true };
  it("only knows learners and fails closed", () => {
    expect(can(learner, "learner.self", "manage")).toBe(true);
    expect(can(learner, "admin.roles", "view")).toBe(false);
    expect(can(learner, "admin.settings", "manage")).toBe(false);
    expect(can(null, "learner.self", "view")).toBe(false);
    expect(can(undefined, "learner.self", "none")).toBe(false);
  });
});
