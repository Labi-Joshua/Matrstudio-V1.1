import { afterEach, describe, expect, it, vi } from "vitest";
import { createNotification } from "../src/notifications/create";
import { createApp, stubFetch, type TestApp } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

async function setup() {
  stubFetch();
  const app = createApp();
  const ada = await app.signUpConfirmed("ada@example.com");
  const bob = await app.signUpConfirmed("bob@example.com");
  const uid = (email: string) =>
    (app.sqlite.prepare("SELECT id FROM user WHERE email = ?").get(email) as { id: string }).id;
  return {
    app,
    ada: ada.cookie as string,
    bob: bob.cookie as string,
    adaId: uid("ada@example.com"),
    bobId: uid("bob@example.com"),
  };
}

const list = (app: TestApp, cookie: string) => app.call("/api/me/notifications", { cookie });
const read = (app: TestApp, cookie: string, body?: unknown) =>
  app.call("/api/me/notifications/read", { method: "POST", cookie, body: body ?? {} });
type N = {
  id: string;
  title: string;
  readAt: string | null;
  href: string | null;
  createdAt: string;
};
const items = (json: Record<string, unknown>) => json.notifications as N[];

describe("createNotification", () => {
  it("stores a row, clips long text and rejects unknown kinds and offsite links", async () => {
    const { app, adaId } = await setup();
    const id = await createNotification(app.db, {
      userId: adaId,
      kind: "new-lesson",
      title: "t".repeat(500),
      body: "b".repeat(900),
      href: "/learn/paths",
    });
    const row = app.sqlite.prepare("SELECT * FROM notifications WHERE id = ?").get(id) as {
      title: string;
      body: string;
      read_at: number | null;
    };
    expect(row.title.length).toBe(120);
    expect(row.body.length).toBe(300);
    expect(row.read_at).toBeNull();
    const base = { userId: adaId, title: "x", body: "y" };
    await expect(createNotification(app.db, { ...base, kind: "nope" as never })).rejects.toThrow();
    for (const href of ["https://evil.example", "//evil.example", "javascript:alert(1)"])
      await expect(
        createNotification(app.db, { ...base, kind: "new-lesson", href }),
      ).rejects.toThrow();
    await createNotification(app.db, { ...base, kind: "path-reminder" });
  });
});

describe("GET /api/me/notifications", () => {
  it("lists own rows newest first as ISO strings, at most 50", async () => {
    const { app, ada, bob, adaId, bobId } = await setup();
    for (let i = 0; i < 55; i++)
      await createNotification(app.db, {
        userId: adaId,
        kind: "new-lesson",
        title: `n${i}`,
        body: "b",
      });
    await createNotification(app.db, {
      userId: bobId,
      kind: "path-reminder",
      title: "bob",
      body: "b",
    });
    app.sqlite.prepare("UPDATE notifications SET created_at = 1000 WHERE title = 'n0'").run();
    const res = await list(app, ada);
    expect(res.status).toBe(200);
    const got = items(res.json);
    expect(got.length).toBe(50);
    expect(got[0]?.title).toBe("n54");
    expect(got.map((n) => n.title)).not.toContain("n0");
    expect(got[0]).toMatchObject({ kind: "new-lesson", href: null, readAt: null });
    expect(new Date(got[0]?.createdAt as string).toISOString()).toBe(got[0]?.createdAt);
    expect(items((await list(app, bob)).json).map((n) => n.title)).toEqual(["bob"]);
  });
});

describe("POST /api/me/notifications/read", () => {
  it("marks all (no ids) or only the listed ids, and only the caller's rows", async () => {
    const { app, ada, bob, adaId, bobId } = await setup();
    const make = (userId: string, title: string) =>
      createNotification(app.db, { userId, kind: "new-lesson", title, body: "b" });
    const a1 = await make(adaId, "1");
    await make(adaId, "2");
    const b1 = await make(bobId, "b");

    const one = await read(app, ada, { ids: [a1, b1, "unknown"] });
    expect(one.status).toBe(200);
    expect(one.json).toEqual({ updated: 1 });
    expect(items((await list(app, bob)).json)[0]?.readAt).toBeNull();
    expect((await read(app, ada, { ids: [a1] })).json).toEqual({ updated: 0 });
    expect((await read(app, ada, { ids: [] })).json).toEqual({ updated: 0 });

    const all = await read(app, ada);
    expect(all.json).toEqual({ updated: 1 });
    expect(items((await list(app, ada)).json).every((n) => n.readAt !== null)).toBe(true);
    const empty = await app.call("/api/me/notifications/read", { method: "POST", cookie: bob });
    expect(empty.json).toEqual({ updated: 1 });
  });

  it("validates the body", async () => {
    const { app, ada } = await setup();
    for (const body of [
      { ids: "x" },
      { ids: Array(51).fill("a") },
      { ids: [1] },
      { extra: 1 },
      null,
    ]) {
      const r = await app.call("/api/me/notifications/read", { method: "POST", cookie: ada, body });
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.json.code).toBe("invalid_request");
    }
    expect((await read(app, ada, { ids: Array(50).fill("a") })).status).toBe(200);
  });

  it("limits to 300 an hour per user", async () => {
    const { app, ada, bob } = await setup();
    for (let i = 0; i < 300; i++) expect((await read(app, ada)).status).toBe(200);
    const r = await read(app, ada);
    expect(r.status).toBe(429);
    expect(r.json.code).toBe("rate_limited");
    expect(r.headers.get("retry-after")).toBeTruthy();
    expect((await list(app, ada)).status).toBe(200);
    expect((await read(app, bob)).status).toBe(200);
  }, 30000);
});

describe("access", () => {
  const routes = [
    ["GET", "/api/me/notifications"],
    ["POST", "/api/me/notifications/read"],
  ] as const;

  it("answers 401 signed out, 503 without a good secret, 403 for a foreign origin", async () => {
    const { app, ada } = await setup();
    for (const [m, p] of routes) {
      const r = await app.call(p, { method: m });
      expect(r.status).toBe(401);
      expect(r.json.code).toBe("unauthorized");
    }
    for (const secret of [undefined, "short"]) {
      const bare = createApp({ BETTER_AUTH_SECRET: secret as string });
      for (const [m, p] of routes) {
        const r = await bare.call(p, { method: m });
        expect(r.status).toBe(503);
        expect(r.json.code).toBe("auth_unavailable");
      }
    }
    const r = await app.call("/api/me/notifications/read", {
      method: "POST",
      cookie: ada,
      origin: "https://evil.example",
    });
    expect(r.status).toBe(403);
  });

  it("deleting the account removes the user's notifications only", async () => {
    const { app, ada, adaId, bobId } = await setup();
    await createNotification(app.db, { userId: adaId, kind: "new-lesson", title: "a", body: "b" });
    await createNotification(app.db, { userId: bobId, kind: "new-lesson", title: "b", body: "b" });
    expect((await app.call("/api/me", { method: "DELETE", cookie: ada })).status).toBe(200);
    expect(app.sqlite.prepare("SELECT user_id FROM notifications").all()).toEqual([
      { user_id: bobId },
    ]);
  });
});
