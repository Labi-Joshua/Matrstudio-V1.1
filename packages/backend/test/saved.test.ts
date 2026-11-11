import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, stubFetch, type TestApp } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

async function setup() {
  stubFetch();
  const app = createApp();
  const { cookie } = await app.signUpConfirmed("ada@example.com");
  return { app, cookie: cookie as string };
}

const put = (app: TestApp, cookie: string, id: string) =>
  app.call(`/api/me/saved/${id}`, { method: "PUT", cookie });
const del = (app: TestApp, cookie: string, id: string) =>
  app.call(`/api/me/saved/${id}`, { method: "DELETE", cookie });
const list = (app: TestApp, cookie: string) => app.call("/api/me/saved", { cookie });
const ids = (json: Record<string, unknown>) =>
  (json.saved as Array<{ resourceId: string }>).map((s) => s.resourceId);

describe("PUT and DELETE /api/me/saved/:resourceId", () => {
  it("saves idempotently and keeps the first savedAt", async () => {
    const { app, cookie } = await setup();
    const a = await put(app, cookie, "design-tokens");
    expect(a.status).toBe(200);
    expect(a.json.saved).toMatchObject({ resourceId: "design-tokens" });
    expect(Number.isInteger((a.json.saved as { savedAt: number }).savedAt)).toBe(true);
    app.sqlite.prepare("UPDATE saved_resources SET created_at = created_at - 100").run();
    const b = await put(app, cookie, "design-tokens");
    expect(b.status).toBe(200);
    expect((b.json.saved as { savedAt: number }).savedAt).toBe(
      (a.json.saved as { savedAt: number }).savedAt - 100,
    );
    expect(ids((await list(app, cookie)).json)).toEqual(["design-tokens"]);
    const audit = app.sqlite
      .prepare("SELECT action FROM audit_log WHERE action LIKE 'saved.%'")
      .all();
    expect(audit.length).toBe(1);
  });

  it("removes idempotently", async () => {
    const { app, cookie } = await setup();
    await put(app, cookie, "a");
    const first = await del(app, cookie, "a");
    expect(first.status).toBe(200);
    expect(first.json).toEqual({ removed: true });
    const again = await del(app, cookie, "a");
    expect(again.status).toBe(200);
    expect(again.json).toEqual({ removed: true });
    expect((await del(app, cookie, "never-saved")).json).toEqual({ removed: true });
    expect(ids((await list(app, cookie)).json)).toEqual([]);
    const actions = app.sqlite
      .prepare("SELECT action, target, meta FROM audit_log WHERE action LIKE 'saved.%'")
      .all() as Array<{ action: string; target: string }>;
    expect(actions.map((r) => r.action)).toEqual(["saved.added", "saved.removed"]);
    expect(JSON.stringify(actions)).not.toContain("ada@example.com");
  });

  it("validates the resource id", async () => {
    const { app, cookie } = await setup();
    for (const bad of ["Upper", "-lead", "has_underscore", "a".repeat(65), "dot.dot"]) {
      for (const fn of [put, del]) {
        const r = await fn(app, cookie, bad);
        expect(r.status, bad).toBe(400);
        expect(r.json.code).toBe("invalid_request");
      }
    }
    expect((await put(app, cookie, "a".repeat(64))).status).toBe(200);
    expect((await put(app, cookie, "9-lives")).status).toBe(200);
  });
});

describe("GET /api/me/saved", () => {
  it("lists newest first", async () => {
    const { app, cookie } = await setup();
    for (const id of ["a", "b", "c"]) await put(app, cookie, id);
    const set = app.sqlite.prepare(
      "UPDATE saved_resources SET created_at = ? WHERE resource_id = ?",
    );
    set.run(1000, "a");
    set.run(2000, "b");
    set.run(3000, "c");
    const res = await list(app, cookie);
    expect(res.status).toBe(200);
    expect(res.json.saved).toEqual([
      { resourceId: "c", savedAt: 3000 },
      { resourceId: "b", savedAt: 2000 },
      { resourceId: "a", savedAt: 1000 },
    ]);
  });

  it("breaks same-second ties by most recent save", async () => {
    const { app, cookie } = await setup();
    for (const id of ["a", "b", "c"]) await put(app, cookie, id);
    app.sqlite.prepare("UPDATE saved_resources SET created_at = 5").run();
    expect(ids((await list(app, cookie)).json)).toEqual(["c", "b", "a"]);
  });
});

describe("limits", () => {
  it("caps a learner at 500 saved resources with saved_limit", async () => {
    const { app, cookie } = await setup();
    const uid = (app.sqlite.prepare("SELECT id FROM user").get() as { id: string }).id;
    const ins = app.sqlite.prepare("INSERT INTO saved_resources VALUES (?, ?, ?)");
    for (let i = 0; i < 500; i++) ins.run(uid, `r-${i}`, 1000 + i);
    const res = await put(app, cookie, "one-more");
    expect(res.status).toBe(409);
    expect(res.json.code).toBe("saved_limit");
    // Already saved ids still succeed, and removing frees a slot.
    expect((await put(app, cookie, "r-3")).status).toBe(200);
    await del(app, cookie, "r-3");
    expect((await put(app, cookie, "one-more")).status).toBe(200);
  });

  it("allows 120 changes an hour per user, then 429", async () => {
    const { app, cookie } = await setup();
    for (let i = 0; i < 120; i++)
      expect((await put(app, cookie, `r-${i % 5}`)).status, String(i)).toBe(200);
    const res = await del(app, cookie, "r-1");
    expect(res.status).toBe(429);
    expect(res.json.code).toBe("rate_limited");
    expect(res.json.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect((await list(app, cookie)).status).toBe(200);
    const row = app.sqlite
      .prepare("SELECT meta FROM audit_log WHERE action = 'rate_limit.hit'")
      .get() as { meta: string };
    expect(JSON.parse(row.meta)).toEqual({ scope: "saved_user" });
    // Another user is unaffected.
    const bob = (await app.signUpConfirmed("bob@example.com")).cookie as string;
    expect((await put(app, bob, "r-1")).status).toBe(200);
  });
});

describe("access", () => {
  const routes = [
    ["GET", "/api/me/saved"],
    ["PUT", "/api/me/saved/a"],
    ["DELETE", "/api/me/saved/a"],
  ] as const;

  it("answers 401 signed out and 503 without a good auth secret", async () => {
    const { app } = await setup();
    for (const [m, p] of routes) {
      const r = await app.call(p, { method: m });
      expect(r.status, m).toBe(401);
      expect(r.json.code).toBe("unauthorized");
    }
    for (const secret of [undefined, "short"]) {
      const bare = createApp({ BETTER_AUTH_SECRET: secret as string });
      for (const [m, p] of routes) {
        const r = await bare.call(p, { method: m });
        expect(r.status, m).toBe(503);
        expect(r.json.code).toBe("auth_unavailable");
      }
    }
  });

  it("refuses foreign origins", async () => {
    const { app, cookie } = await setup();
    const res = await app.call("/api/me/saved/a", {
      method: "PUT",
      cookie,
      origin: "https://evil.example",
    });
    expect(res.status).toBe(403);
    expect(ids((await list(app, cookie)).json)).toEqual([]);
  });

  it("isolates users: never lists or deletes another user's rows", async () => {
    const { app, cookie } = await setup();
    const bob = (await app.signUpConfirmed("bob@example.com")).cookie as string;
    await put(app, cookie, "ada-only");
    await put(app, bob, "bob-only");
    expect(ids((await list(app, cookie)).json)).toEqual(["ada-only"]);
    expect(ids((await list(app, bob)).json)).toEqual(["bob-only"]);
    await del(app, bob, "ada-only");
    expect(ids((await list(app, cookie)).json)).toEqual(["ada-only"]);
    await put(app, bob, "ada-only");
    expect(ids((await list(app, bob)).json).sort()).toEqual(["ada-only", "bob-only"]);
  });

  it("deleting the account removes the user's saved rows only", async () => {
    const { app, cookie } = await setup();
    const bob = (await app.signUpConfirmed("bob@example.com")).cookie as string;
    await put(app, cookie, "a");
    await put(app, bob, "a");
    expect((await app.call("/api/me", { method: "DELETE", cookie })).status).toBe(200);
    expect(app.sqlite.prepare("SELECT user_id FROM saved_resources").all().length).toBe(1);
  });
});
