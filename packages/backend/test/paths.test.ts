import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, stubFetch, type TestApp } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

async function setup() {
  stubFetch();
  const app = createApp();
  const { cookie } = await app.signUpConfirmed("ada@example.com");
  return { app, cookie: cookie as string };
}

type P = {
  slug: string;
  startedAt: string | null;
  lastActivityAt: string | null;
  completedAt: string | null;
  starredAt: string | null;
  completedLessonIds: string[];
};
const path = (json: Record<string, unknown>) => json.path as P;
const slugs = (json: Record<string, unknown>) => (json.paths as P[]).map((p) => p.slug);

const start = (app: TestApp, cookie: string, slug: string) =>
  app.call(`/api/me/paths/${slug}/start`, { method: "POST", cookie });
const done = (app: TestApp, cookie: string, slug: string, lesson: string, total: unknown = 3) =>
  app.call(`/api/me/paths/${slug}/lessons/${lesson}`, { method: "PUT", cookie, body: { total } });
const undo = (app: TestApp, cookie: string, slug: string, lesson: string) =>
  app.call(`/api/me/paths/${slug}/lessons/${lesson}`, { method: "DELETE", cookie });
const star = (app: TestApp, cookie: string, slug: string) =>
  app.call(`/api/me/paths/${slug}/star`, { method: "PUT", cookie });
const unstar = (app: TestApp, cookie: string, slug: string) =>
  app.call(`/api/me/paths/${slug}/star`, { method: "DELETE", cookie });
const list = (app: TestApp, cookie: string) => app.call("/api/me/paths", { cookie });
const count = (app: TestApp, sql: string) => (app.sqlite.prepare(sql).get() as { n: number }).n;

describe("start", () => {
  it("is idempotent and keeps the original startedAt", async () => {
    const { app, cookie } = await setup();
    const a = await start(app, cookie, "design-basics");
    expect(a.status).toBe(200);
    const first = path(a.json);
    expect(first.slug).toBe("design-basics");
    expect(new Date(first.startedAt as string).toISOString()).toBe(first.startedAt);
    expect(first.completedLessonIds).toEqual([]);
    expect(first.completedAt).toBeNull();
    expect(first.starredAt).toBeNull();
    app.sqlite.prepare("UPDATE path_enrolments SET started_at = '2020-01-01T00:00:00.000Z'").run();
    const b = path((await start(app, cookie, "design-basics")).json);
    expect(b.startedAt).toBe("2020-01-01T00:00:00.000Z");
    expect(slugs((await list(app, cookie)).json)).toEqual(["design-basics"]);
    expect(count(app, "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'path.started'")).toBe(1);
  });
});

describe("lessons", () => {
  it("marks done idempotently, ordered by when each was done", async () => {
    const { app, cookie } = await setup();
    await done(app, cookie, "p", "l-b");
    await done(app, cookie, "p", "l-a");
    const set = app.sqlite.prepare(
      "UPDATE path_lessons_done SET completed_at = ? WHERE lesson_id = ?",
    );
    set.run("2024-01-01T00:00:00.000Z", "l-b");
    set.run("2024-02-01T00:00:00.000Z", "l-a");
    const again = path((await done(app, cookie, "p", "l-b")).json);
    expect(again.completedLessonIds).toEqual(["l-b", "l-a"]);
    expect(count(app, "SELECT COUNT(*) AS n FROM path_lessons_done")).toBe(2);
    expect(
      count(app, "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'path.lesson_done'"),
    ).toBe(2);
  });

  it("starts the path when the first lesson is done", async () => {
    const { app, cookie } = await setup();
    const p = path((await done(app, cookie, "p", "l1")).json);
    expect(p.startedAt).toBeTruthy();
    expect(p.lastActivityAt).toBeTruthy();
    expect(p.completedAt).toBeNull();
  });

  it("completes once done lessons reach the total and keeps the time", async () => {
    const { app, cookie } = await setup();
    const mid = path((await done(app, cookie, "p", "a", 2)).json);
    expect(mid.completedAt).toBeNull();
    const fin = path((await done(app, cookie, "p", "b", 2)).json);
    expect(fin.completedAt).toBeTruthy();
    app.sqlite
      .prepare("UPDATE path_enrolments SET completed_at = '2021-01-01T00:00:00.000Z'")
      .run();
    const repeat = path((await done(app, cookie, "p", "b", 2)).json);
    expect(repeat.completedAt).toBe("2021-01-01T00:00:00.000Z");
    expect(count(app, "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'path.completed'")).toBe(
      1,
    );
  });

  it("completes a one-lesson path straight away", async () => {
    const { app, cookie } = await setup();
    expect(path((await done(app, cookie, "p", "only", 1)).json).completedAt).toBeTruthy();
  });

  it("undo removes the lesson and clears completion, idempotently", async () => {
    const { app, cookie } = await setup();
    await done(app, cookie, "p", "a", 2);
    expect(path((await done(app, cookie, "p", "b", 2)).json).completedAt).toBeTruthy();
    const u = path((await undo(app, cookie, "p", "b")).json);
    expect(u.completedAt).toBeNull();
    expect(u.completedLessonIds).toEqual(["a"]);
    const again = await undo(app, cookie, "p", "b");
    expect(again.status).toBe(200);
    expect(path(again.json).completedLessonIds).toEqual(["a"]);
    expect(path((await done(app, cookie, "p", "b", 2)).json).completedAt).toBeTruthy();
    expect(
      count(app, "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'path.lesson_undone'"),
    ).toBe(1);
  });

  it("undo on an unknown path creates nothing", async () => {
    const { app, cookie } = await setup();
    const r = await undo(app, cookie, "ghost", "x");
    expect(r.status).toBe(200);
    expect(path(r.json)).toMatchObject({ slug: "ghost", startedAt: null, completedLessonIds: [] });
    expect(slugs((await list(app, cookie)).json)).toEqual([]);
  });

  it("validates ids and the total before spending the rate limit", async () => {
    const { app, cookie } = await setup();
    for (const bad of ["Upper", "-lead", "has_underscore", "a".repeat(65)]) {
      expect((await done(app, cookie, bad, "l")).status, bad).toBe(400);
      expect((await done(app, cookie, "p", bad)).status, bad).toBe(400);
      expect((await undo(app, cookie, "p", bad)).status, bad).toBe(400);
      expect((await start(app, cookie, bad)).status, bad).toBe(400);
      expect((await star(app, cookie, bad)).status, bad).toBe(400);
      expect((await unstar(app, cookie, bad)).status, bad).toBe(400);
    }
    for (const total of [0, 201, 1.5, "3", null, -1]) {
      const r = await done(app, cookie, "p", "l", total);
      expect(r.status, String(total)).toBe(400);
      expect(r.json.code).toBe("invalid_request");
    }
    const noBody = await app.call("/api/me/paths/p/lessons/l", { method: "PUT", cookie });
    expect(noBody.status).toBe(400);
    expect((await done(app, cookie, "p", "l", 200)).status).toBe(200);
    expect((await done(app, cookie, "p".repeat(64), "9-x", 1)).status).toBe(200);
    expect(slugs((await list(app, cookie)).json).length).toBe(2);
  });
});

describe("star", () => {
  it("can star before starting and is idempotent", async () => {
    const { app, cookie } = await setup();
    const s = path((await star(app, cookie, "p")).json);
    expect(s.starredAt).toBeTruthy();
    expect(s.startedAt).toBeNull();
    app.sqlite.prepare("UPDATE path_enrolments SET starred_at = '2020-01-01T00:00:00.000Z'").run();
    expect(path((await star(app, cookie, "p")).json).starredAt).toBe("2020-01-01T00:00:00.000Z");
    expect(slugs((await list(app, cookie)).json)).toEqual(["p"]);
    const started = path((await start(app, cookie, "p")).json);
    expect(started.starredAt).toBe("2020-01-01T00:00:00.000Z");
    expect(started.startedAt).toBeTruthy();
  });

  it("unstar keeps a started path and drops one that was only starred", async () => {
    const { app, cookie } = await setup();
    await star(app, cookie, "only-star");
    await start(app, cookie, "started");
    await star(app, cookie, "started");
    const a = await unstar(app, cookie, "only-star");
    expect(a.status).toBe(200);
    expect(path(a.json).starredAt).toBeNull();
    expect((await unstar(app, cookie, "only-star")).status).toBe(200);
    expect(path((await unstar(app, cookie, "started")).json).startedAt).toBeTruthy();
    expect(slugs((await list(app, cookie)).json)).toEqual(["started"]);
  });
});

describe("GET /api/me/paths", () => {
  it("lists started or starred paths, most recent activity first, with lessons", async () => {
    const { app, cookie } = await setup();
    await start(app, cookie, "a");
    await done(app, cookie, "b", "l1");
    await star(app, cookie, "c");
    const set = app.sqlite.prepare(
      "UPDATE path_enrolments SET last_activity_at = ? WHERE path_slug = ?",
    );
    set.run("2024-01-01T00:00:00.000Z", "a");
    set.run("2024-03-01T00:00:00.000Z", "b");
    app.sqlite
      .prepare(
        "UPDATE path_enrolments SET starred_at = '2024-02-01T00:00:00.000Z' WHERE path_slug = 'c'",
      )
      .run();
    const res = await list(app, cookie);
    expect(res.status).toBe(200);
    expect(slugs(res.json)).toEqual(["b", "c", "a"]);
    expect((res.json.paths as P[])[0]?.completedLessonIds).toEqual(["l1"]);
  });

  it("is empty for a new account", async () => {
    const { app, cookie } = await setup();
    expect((await list(app, cookie)).json).toEqual({ paths: [] });
  });
});

describe("limits", () => {
  it("caps a learner at 200 paths with path_limit", async () => {
    const { app, cookie } = await setup();
    const uid = (app.sqlite.prepare("SELECT id FROM user").get() as { id: string }).id;
    const ins = app.sqlite.prepare(
      "INSERT INTO path_enrolments (user_id, path_slug, started_at) VALUES (?, ?, ?)",
    );
    for (let i = 0; i < 200; i++) ins.run(uid, `p-${i}`, "2024-01-01T00:00:00.000Z");
    for (const fn of [
      () => start(app, cookie, "one-more"),
      () => star(app, cookie, "one-more"),
      () => done(app, cookie, "one-more", "l"),
    ]) {
      const r = await fn();
      expect(r.status).toBe(409);
      expect(r.json.code).toBe("path_limit");
    }
    expect((await start(app, cookie, "p-3")).status).toBe(200);
    expect((await done(app, cookie, "p-3", "l")).status).toBe(200);
  });

  it("allows 120 changes an hour per user, then 429", async () => {
    const { app, cookie } = await setup();
    for (let i = 0; i < 120; i++)
      expect((await start(app, cookie, `p-${i % 5}`)).status, String(i)).toBe(200);
    const res = await star(app, cookie, "p-1");
    expect(res.status).toBe(429);
    expect(res.json.code).toBe("rate_limited");
    expect(res.json.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect((await list(app, cookie)).status).toBe(200);
    const row = app.sqlite
      .prepare("SELECT meta FROM audit_log WHERE action = 'rate_limit.hit'")
      .get() as { meta: string };
    expect(JSON.parse(row.meta)).toEqual({ scope: "paths_user" });
    const bob = (await app.signUpConfirmed("bob@example.com")).cookie as string;
    expect((await start(app, bob, "p-1")).status).toBe(200);
  });
});

describe("access", () => {
  const routes = [
    ["GET", "/api/me/paths"],
    ["POST", "/api/me/paths/a/start"],
    ["PUT", "/api/me/paths/a/lessons/b"],
    ["DELETE", "/api/me/paths/a/lessons/b"],
    ["PUT", "/api/me/paths/a/star"],
    ["DELETE", "/api/me/paths/a/star"],
  ] as const;

  it("answers 401 signed out and 503 without a good auth secret", async () => {
    const { app } = await setup();
    for (const [m, p] of routes) {
      const r = await app.call(p, { method: m });
      expect(r.status, `${m} ${p}`).toBe(401);
      expect(r.json.code).toBe("unauthorized");
    }
    for (const secret of [undefined, "short"]) {
      const bare = createApp({ BETTER_AUTH_SECRET: secret as string });
      for (const [m, p] of routes) {
        const r = await bare.call(p, { method: m });
        expect(r.status, `${m} ${p}`).toBe(503);
        expect(r.json.code).toBe("auth_unavailable");
      }
    }
  });

  it("refuses foreign origins", async () => {
    const { app, cookie } = await setup();
    const res = await app.call("/api/me/paths/a/start", {
      method: "POST",
      cookie,
      origin: "https://evil.example",
    });
    expect(res.status).toBe(403);
    expect(slugs((await list(app, cookie)).json)).toEqual([]);
  });

  it("isolates users: progress, stars and undo never cross accounts", async () => {
    const { app, cookie } = await setup();
    const bob = (await app.signUpConfirmed("bob@example.com")).cookie as string;
    await done(app, cookie, "p", "l1", 5);
    await star(app, cookie, "p");
    await done(app, bob, "p", "l2", 5);
    await undo(app, bob, "p", "l1");
    await unstar(app, bob, "p");
    const ada = (await list(app, cookie)).json.paths as P[];
    expect(ada[0]?.completedLessonIds).toEqual(["l1"]);
    expect(ada[0]?.starredAt).toBeTruthy();
    const b = (await list(app, bob)).json.paths as P[];
    expect(b[0]?.completedLessonIds).toEqual(["l2"]);
    expect(b[0]?.starredAt).toBeNull();
  });

  it("audit rows hold no personal data", async () => {
    const { app, cookie } = await setup();
    await done(app, cookie, "p", "l1", 1);
    const rows = app.sqlite
      .prepare("SELECT action, target, meta FROM audit_log WHERE action LIKE 'path.%'")
      .all();
    expect(rows.length).toBe(3);
    expect(JSON.stringify(rows)).not.toContain("ada@example.com");
  });

  it("deleting the account removes the user's rows only", async () => {
    const { app, cookie } = await setup();
    const bob = (await app.signUpConfirmed("bob@example.com")).cookie as string;
    await done(app, cookie, "p", "l1");
    await done(app, bob, "p", "l1");
    expect((await app.call("/api/me", { method: "DELETE", cookie })).status).toBe(200);
    expect(count(app, "SELECT COUNT(*) AS n FROM path_enrolments")).toBe(1);
    expect(count(app, "SELECT COUNT(*) AS n FROM path_lessons_done")).toBe(1);
  });
});
