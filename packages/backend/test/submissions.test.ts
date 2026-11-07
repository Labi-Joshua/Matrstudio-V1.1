import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSubmissionUrl } from "../src/auth/submission-url";
import { reviewSubmission } from "../src/auth/submissions";
import { createApp, stubFetch, type TestApp } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

const URL1 = "https://example.com/guide";

async function setup() {
  stubFetch();
  const app = createApp();
  const { cookie } = await app.signUpConfirmed("ada@example.com");
  return { app, cookie: cookie as string };
}

const create = (
  app: TestApp,
  cookie: string,
  body: unknown,
  headers: Record<string, string> = {},
) => app.call("/api/me/submissions", { body, cookie, headers });

type Sub = Record<string, unknown>;

describe("POST /api/me/submissions", () => {
  it("creates an in_review submission with the contract shape", async () => {
    const { app, cookie } = await setup();
    const res = await create(app, cookie, {
      url: ` ${URL1} `,
      title: "  A guide ",
      note: " Great ",
      topic: "ui-ux",
    });
    expect(res.status).toBe(201);
    const s = res.json.submission as Sub;
    expect(s).toMatchObject({
      url: URL1,
      title: "A guide",
      note: "Great",
      topic: "ui-ux",
      status: "in_review",
    });
    expect(typeof s.id).toBe("string");
    expect(Number.isInteger(s.createdAt)).toBe(true);
    expect(s.updatedAt).toBe(s.createdAt);
    const bare = await create(app, cookie, { url: "https://example.org/x", title: "  " });
    expect(bare.status).toBe(201);
    expect(bare.json.submission).toMatchObject({ title: null, note: null, topic: null });
  });

  it("answers 400 invalid_request with fieldErrors for bad shape and length", async () => {
    const { app, cookie } = await setup();
    const cases: Array<[unknown, string | null]> = [
      [{}, "url"],
      [{ url: 5 }, "url"],
      [{ url: "" }, "url"],
      [{ url: `https://example.com/${"a".repeat(2048)}` }, "url"],
      [{ url: URL1, title: "t".repeat(201) }, "title"],
      [{ url: URL1, note: "n".repeat(1001) }, "note"],
      [{ url: URL1, topic: "cooking" }, "topic"],
      [{ url: URL1, extra: 1 }, null],
      ["nope", null],
    ];
    for (const [body, field] of cases) {
      const res = await create(app, cookie, body);
      expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
      expect(res.json.code).toBe("invalid_request");
      if (field) expect(Object.keys(res.json.fieldErrors as object)).toContain(field);
    }
    const ok = await create(app, cookie, {
      url: URL1,
      title: "t".repeat(200),
      note: "n".repeat(1000),
    });
    expect(ok.status).toBe(201);
  });

  it("rejects unsafe URLs with invalid_url", async () => {
    const { app, cookie } = await setup();
    const bad = [
      "http://example.com/a",
      "ftp://example.com/a",
      "javascript:alert(1)",
      "example.com/a",
      "https://user:pw@example.com/a",
      "https://user@example.com/a",
      "https://127.0.0.1/a",
      "https://10.0.0.5/a",
      "https://2130706433/a",
      "https://0x7f.1/a",
      "https://[::1]/a",
      "https://[2001:db8::1]/a",
      "https://localhost/a",
      "https://printer.local/a",
      "https://db.internal/a",
      "https://intranet/a",
      "https://a b.com/",
      "https:///a",
    ];
    for (const url of bad) {
      const res = await create(app, cookie, { url });
      expect(res.status, url).toBe(400);
      expect(res.json.code, url).toBe("invalid_url");
    }
  });

  it("normalises URLs and detects duplicates per user", async () => {
    const { app, cookie } = await setup();
    expect(
      checkSubmissionUrl("HTTPS://Example.COM:443/Guide/?utm_source=x&b=1&FBCLID=z#frag"),
    ).toEqual({ ok: true, normalised: "https://example.com/Guide?b=1" });
    expect(checkSubmissionUrl("https://example.com/")).toEqual({
      ok: true,
      normalised: "https://example.com",
    });
    expect(
      (await create(app, cookie, { url: "https://Example.com/a/?utm_campaign=1" })).status,
    ).toBe(201);
    for (const url of [
      "https://example.com/a",
      "https://EXAMPLE.com/a/",
      "https://example.com:443/a#top",
      "https://example.com/a?gclid=9&utm_medium=m",
    ]) {
      const dup = await create(app, cookie, { url });
      expect(dup.status, url).toBe(409);
      expect(dup.json.code).toBe("already_submitted");
    }
    // A real query difference and a different path are different resources.
    expect((await create(app, cookie, { url: "https://example.com/a?id=2" })).status).toBe(201);
    expect((await create(app, cookie, { url: "https://example.com/A" })).status).toBe(201);
    // Another user may submit the same link.
    const other = await app.signUpConfirmed("bob@example.com");
    expect(
      (await create(app, other.cookie as string, { url: "https://example.com/a" })).status,
    ).toBe(201);
  });

  it("requires a session and the auth secret", async () => {
    const { app } = await setup();
    const res = await app.call("/api/me/submissions", { body: { url: URL1 } });
    expect(res.status).toBe(401);
    expect(res.json.code).toBe("unauthorized");
    expect((await app.call("/api/me/submissions")).status).toBe(401);
    expect(
      (await app.call("/api/me/submissions/x", { method: "PATCH", body: { title: "a" } })).status,
    ).toBe(401);
    for (const secret of [undefined, "short"]) {
      const bare = createApp({ BETTER_AUTH_SECRET: secret as string });
      for (const [m, body] of [
        ["GET", undefined],
        ["POST", { url: URL1 }],
        ["PATCH", { title: "a" }],
      ] as const) {
        const r = await bare.call(m === "PATCH" ? "/api/me/submissions/x" : "/api/me/submissions", {
          method: m,
          body,
        });
        expect(r.status, m).toBe(503);
        expect(r.json.code).toBe("auth_unavailable");
      }
    }
  });

  it("refuses foreign origins", async () => {
    const { app, cookie } = await setup();
    const res = await app.call("/api/me/submissions", {
      body: { url: URL1 },
      cookie,
      origin: "https://evil.example",
    });
    expect(res.status).toBe(403);
  });
});

describe("captcha", () => {
  it("is skipped in development without a secret", async () => {
    const { app, cookie } = await setup();
    expect((await create(app, cookie, { url: URL1 })).status).toBe(201);
  });

  it("is required, checked, and fails closed", async () => {
    const { app, cookie } = await setup();
    app.env.TURNSTILE_SECRET = "turnstile-test-secret";
    const missing = await create(app, cookie, { url: URL1 });
    expect(missing.status).toBe(400);
    expect(missing.json.code).toBe("captcha_required");

    stubFetch((u) =>
      u.includes("challenges.cloudflare.com") ? Response.json({ success: false }) : undefined,
    );
    const failed = await create(app, cookie, { url: URL1 }, { "x-captcha-response": "bad" });
    expect(failed.status).toBe(400);
    expect(failed.json.code).toBe("captcha_failed");

    stubFetch((u) =>
      u.includes("challenges.cloudflare.com") ? new Response("x", { status: 500 }) : undefined,
    );
    const down = await create(app, cookie, { url: URL1 }, { "x-captcha-response": "t" });
    expect(down.status).toBe(503);
    expect(down.json.code).toBe("captcha_unavailable");

    stubFetch();
    const ok = await create(app, cookie, { url: URL1 }, { "x-captcha-response": "good" });
    expect(ok.status).toBe(201);

    // Production without a secret fails closed.
    app.env.TURNSTILE_SECRET = undefined;
    app.env.ENVIRONMENT = "production";
    const prod = await create(app, cookie, { url: "https://example.com/other" });
    expect(prod.status).toBe(503);
    expect(prod.json.code).toBe("captcha_unavailable");
  });
});

describe("rate limits", () => {
  it("allows 10 an hour per user, then 429 with retryAfterSeconds and an audit row", async () => {
    const { app, cookie } = await setup();
    for (let i = 0; i < 10; i++) {
      const res = await create(
        app,
        cookie,
        { url: `https://example.com/${i}` },
        { "cf-connecting-ip": `198.51.${i}.9` },
      );
      expect(res.status, String(i)).toBe(201);
    }
    const res = await create(
      app,
      cookie,
      { url: "https://example.com/11" },
      { "cf-connecting-ip": "198.51.200.9" },
    );
    expect(res.status).toBe(429);
    expect(res.json.code).toBe("rate_limited");
    expect(res.json.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.headers.get("retry-after")).toBeTruthy();
    const row = app.sqlite
      .prepare("SELECT meta FROM audit_log WHERE action = 'rate_limit.hit'")
      .get() as { meta: string };
    expect(JSON.parse(row.meta)).toEqual({ scope: "submission_user" });
  });

  it("allows 10 an hour per network across users", async () => {
    const { app, cookie } = await setup();
    const bob = (await app.signUpConfirmed("bob@example.com")).cookie as string;
    const ip = { "cf-connecting-ip": "203.0.113.7" };
    for (let i = 0; i < 10; i++) {
      const who = i % 2 ? bob : cookie;
      expect((await create(app, who, { url: `https://example.com/${i}` }, ip)).status).toBe(201);
    }
    const res = await create(app, cookie, { url: "https://example.com/x" }, ip);
    expect(res.status).toBe(429);
    const row = app.sqlite
      .prepare("SELECT meta FROM audit_log WHERE action = 'rate_limit.hit'")
      .get() as { meta: string };
    expect(JSON.parse(row.meta)).toEqual({ scope: "submission_ip" });
  });

  it("does not count invalid requests", async () => {
    const { app, cookie } = await setup();
    for (let i = 0; i < 12; i++) await create(app, cookie, { url: "http://example.com" });
    expect((await create(app, cookie, { url: URL1 })).status).toBe(201);
  });
});

describe("GET /api/me/submissions and IDOR", () => {
  it("lists only the caller's rows, newest first, with curatorNote", async () => {
    const { app, cookie } = await setup();
    const bob = (await app.signUpConfirmed("bob@example.com")).cookie as string;
    const a1 = (await create(app, cookie, { url: "https://example.com/1" })).json.submission as Sub;
    const a2 = (await create(app, cookie, { url: "https://example.com/2" })).json.submission as Sub;
    await create(app, bob, { url: "https://example.com/bob" });
    const list = await app.call("/api/me/submissions", { cookie });
    expect(list.status).toBe(200);
    const subs = list.json.submissions as Sub[];
    expect(subs.map((s) => s.id)).toEqual([a2.id, a1.id]);
    expect(subs[0]).toHaveProperty("curatorNote", null);
    expect(subs.some((s) => String(s.url).includes("bob"))).toBe(false);
  });

  it("caps the list at 100", async () => {
    const { app, cookie } = await setup();
    const uid = (app.sqlite.prepare("SELECT id FROM user").get() as { id: string }).id;
    const ins = app.sqlite.prepare(
      "INSERT INTO resource_submissions (id, user_id, url, url_normalised, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1)",
    );
    for (let i = 0; i < 105; i++) ins.run(`s${i}`, uid, `https://e.com/${i}`, `https://e.com/${i}`);
    const list = await app.call("/api/me/submissions", { cookie });
    expect((list.json.submissions as Sub[]).length).toBe(100);
  });

  it("answers a stranger's id exactly like a missing one", async () => {
    const { app, cookie } = await setup();
    const bob = (await app.signUpConfirmed("bob@example.com")).cookie as string;
    const mine = (await create(app, cookie, { url: URL1 })).json.submission as Sub;
    app.sqlite.prepare("UPDATE resource_submissions SET status = 'needs_changes'").run();
    const stranger = await app.call(`/api/me/submissions/${mine.id}`, {
      method: "PATCH",
      body: { title: "hijack" },
      cookie: bob,
    });
    const missing = await app.call("/api/me/submissions/does-not-exist", {
      method: "PATCH",
      body: { title: "hijack" },
      cookie: bob,
    });
    expect(stranger.status).toBe(404);
    expect(stranger.json).toEqual(missing.json);
    expect(stranger.json.code).toBe("not_found");
    const row = app.sqlite.prepare("SELECT title, status FROM resource_submissions").get() as Sub;
    expect(row).toMatchObject({ title: null, status: "needs_changes" });
  });
});

describe("PATCH /api/me/submissions/:id", () => {
  async function needsChanges() {
    const { app, cookie } = await setup();
    const s = (await create(app, cookie, { url: URL1, title: "Old", note: "n", topic: "seo" })).json
      .submission as Sub;
    const uid = (app.sqlite.prepare("SELECT id FROM user").get() as { id: string }).id;
    await reviewSubmission(app.env, {
      id: s.id as string,
      status: "needs_changes",
      curatorNote: "Add a title",
      reviewedBy: "admin-1",
    });
    return { app, cookie, id: s.id as string, uid };
  }
  const patch = (app: TestApp, cookie: string, id: string, body: unknown) =>
    app.call(`/api/me/submissions/${id}`, { method: "PATCH", body, cookie });

  it("edits, returns the row to in_review and bumps updatedAt", async () => {
    const { app, cookie, id } = await needsChanges();
    app.sqlite.prepare("UPDATE resource_submissions SET updated_at = 5").run();
    const res = await patch(app, cookie, id, { title: " New ", topic: "brand" });
    expect(res.status).toBe(200);
    const s = res.json.submission as Sub;
    expect(s).toMatchObject({
      id,
      url: URL1,
      title: "New",
      note: "n",
      topic: "brand",
      status: "in_review",
    });
    expect(s.updatedAt).toBeGreaterThan(5);
    const cleared = await (async () => {
      app.sqlite.prepare("UPDATE resource_submissions SET status = 'needs_changes'").run();
      return patch(app, cookie, id, { note: null });
    })();
    expect((cleared.json.submission as Sub).note).toBeNull();
  });

  it("validates the body", async () => {
    const { app, cookie, id } = await needsChanges();
    for (const body of [{}, { url: "https://x.com" }, { title: "t".repeat(201) }, { topic: "x" }]) {
      const res = await patch(app, cookie, id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.json.code).toBe("invalid_request");
    }
  });

  it("is 409 not_editable unless the status is needs_changes", async () => {
    const { app, cookie } = await setup();
    const s = (await create(app, cookie, { url: URL1 })).json.submission as Sub;
    for (const status of ["in_review", "accepted", "declined"]) {
      app.sqlite.prepare("UPDATE resource_submissions SET status = ?").run(status);
      const res = await patch(app, cookie, s.id as string, { title: "x" });
      expect(res.status, status).toBe(409);
      expect(res.json.code).toBe("not_editable");
    }
    expect(
      (app.sqlite.prepare("SELECT title FROM resource_submissions").get() as Sub).title,
    ).toBeNull();
  });
});

describe("reviewSubmission", () => {
  it("records the decision and audits ids and status only", async () => {
    const { app, cookie } = await setup();
    const s = (await create(app, cookie, { url: URL1, note: "secret note" })).json
      .submission as Sub;
    const out = await reviewSubmission(app.env, {
      id: s.id as string,
      status: "declined",
      curatorNote: "  Not a fit  ",
      reviewedBy: "admin-1",
    });
    expect(out).toMatchObject({ status: "declined", curatorNote: "Not a fit" });
    const row = app.sqlite
      .prepare("SELECT reviewed_by, reviewed_at FROM resource_submissions")
      .get() as Sub;
    expect(row.reviewed_by).toBe("admin-1");
    expect(row.reviewed_at).toBeGreaterThan(0);
    const learner = await app.call("/api/me/submissions", { cookie });
    expect((learner.json.submissions as Sub[])[0]).toMatchObject({
      status: "declined",
      curatorNote: "Not a fit",
    });
    const audit = app.sqlite
      .prepare("SELECT actor, target, meta FROM audit_log WHERE action = 'submission.reviewed'")
      .get() as Sub;
    expect(audit).toMatchObject({ actor: "admin-1", target: s.id });
    expect(JSON.parse(audit.meta as string)).toEqual({ status: "declined" });
  });

  it("returns null for an unknown id and refuses in_review", async () => {
    const { app } = await setup();
    expect(
      await reviewSubmission(app.env, { id: "nope", status: "accepted", reviewedBy: "a" }),
    ).toBeNull();
    await expect(
      reviewSubmission(app.env, { id: "x", status: "in_review" as never, reviewedBy: "a" }),
    ).rejects.toThrow();
  });
});

describe("audit and deletion", () => {
  it("audit rows hold no URLs, notes or titles", async () => {
    const { app, cookie } = await setup();
    const s = (
      await create(app, cookie, { url: URL1, title: "Distinct Title", note: "Distinct Note" })
    ).json.submission as Sub;
    app.sqlite.prepare("UPDATE resource_submissions SET status = 'needs_changes'").run();
    await app.call(`/api/me/submissions/${s.id}`, {
      method: "PATCH",
      body: { title: "Other Title" },
      cookie,
    });
    await reviewSubmission(app.env, {
      id: s.id as string,
      status: "accepted",
      curatorNote: "Distinct Curator",
      reviewedBy: "admin-1",
    });
    const rows = app.sqlite
      .prepare("SELECT action, target, meta FROM audit_log WHERE action LIKE 'submission.%'")
      .all() as Sub[];
    expect(rows.map((r) => r.action)).toEqual([
      "submission.created",
      "submission.edited",
      "submission.reviewed",
    ]);
    const dump = JSON.stringify(rows);
    for (const needle of ["example.com", "https", "Distinct", "Other Title"])
      expect(dump).not.toContain(needle);
  });

  it("deleting the account removes the user's submissions only", async () => {
    const { app, cookie } = await setup();
    const bob = (await app.signUpConfirmed("bob@example.com")).cookie as string;
    await create(app, cookie, { url: "https://example.com/a" });
    await create(app, cookie, { url: "https://example.com/b" });
    await create(app, bob, { url: "https://example.com/a" });
    const res = await app.call("/api/me", { method: "DELETE", cookie });
    expect(res.status).toBe(200);
    const left = app.sqlite.prepare("SELECT user_id FROM resource_submissions").all() as Sub[];
    expect(left.length).toBe(1);
    const bobId = (
      app.sqlite.prepare("SELECT id FROM user WHERE email = 'bob@example.com'").get() as Sub
    ).id;
    expect(left[0]?.user_id).toBe(bobId);
  });
});
