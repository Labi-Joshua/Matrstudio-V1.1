import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { createApp, ORIGIN, stubFetch, type TestApp } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

async function setup() {
  stubFetch();
  const app = createApp();
  const { cookie } = await app.signUpConfirmed("ada@example.com");
  const me = await app.call("/api/me", { cookie: cookie as string });
  return { app, cookie: cookie as string, userId: me.json.id as string };
}

async function second(app: TestApp, email = "bob@example.com", name = "Bob Eze") {
  const { cookie } = await app.signUpConfirmed(email, undefined, name);
  const me = await app.call("/api/me", { cookie: cookie as string });
  return { cookie: cookie as string, userId: me.json.id as string };
}

const get = (app: TestApp, cookie: string) => app.call("/api/me/profile", { cookie });
const patch = (app: TestApp, cookie: string, body: unknown) =>
  app.call("/api/me/profile", { method: "PATCH", cookie, body });
const check = (app: TestApp, cookie: string, u: string) =>
  app.call(`/api/me/profile/username-check?u=${encodeURIComponent(u)}`, { cookie });
const pub = (app: TestApp, username: string, ip = "203.0.113.5") =>
  app.call(`/api/profiles/${username}`, { headers: { "cf-connecting-ip": ip } });

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const image = (head: number[], size = 64) => {
  const b = new Uint8Array(size);
  b.set(head);
  return b;
};

async function putAvatar(
  app: TestApp,
  cookie: string,
  body: Uint8Array | null,
  headers: Record<string, string> = {},
) {
  const h = new Headers({ origin: ORIGIN, cookie, "content-type": "image/png", ...headers });
  const res = await worker.fetch(
    new Request("https://matrstudio.com/api/me/profile/avatar", {
      method: "PUT",
      headers: h,
      body,
    }),
    app.env,
    { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext,
  );
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json };
}

describe("GET /api/me/profile", () => {
  it("creates a private profile with a username derived from the name", async () => {
    const { app, cookie } = await setup();
    const r = await get(app, cookie);
    expect(r.status).toBe(200);
    expect(r.json.profile).toMatchObject({
      username: "adaobi",
      displayName: "Ada Obi",
      bio: "",
      avatarUrl: null,
      isPublic: false,
      visibility: { stats: true, paths: true, submissions: true },
    });
    expect(JSON.stringify(r.json)).not.toContain("ada@example.com");
    expect(typeof (r.json.profile as { createdAt: string }).createdAt).toBe("string");
    expect((await get(app, cookie)).json).toEqual(r.json);
  });

  it("gives two learners with the same name different usernames", async () => {
    stubFetch();
    const app = createApp();
    const a = await app.signUpConfirmed("a@example.com", undefined, "Sam Lee");
    const b = await app.signUpConfirmed("b@example.com", undefined, "Sam Lee");
    const pa = (await get(app, a.cookie as string)).json.profile as { username: string };
    const pb = (await get(app, b.cookie as string)).json.profile as { username: string };
    expect(pa.username).toBe("samlee");
    expect(pb.username).toMatch(/^samlee\d{4}$/);
  });

  it("requires a session", async () => {
    const { app } = await setup();
    expect((await app.call("/api/me/profile")).status).toBe(401);
    expect(
      (await app.call("/api/me/profile", { method: "PATCH", body: { bio: "x" } })).status,
    ).toBe(401);
    expect((await app.call("/api/me/profile/username-check?u=abc")).status).toBe(401);
    expect((await app.call("/api/me/profile/avatar", { method: "DELETE" })).status).toBe(401);
  });

  it("answers 503 without a proper auth secret", async () => {
    stubFetch();
    const app = createApp({ BETTER_AUTH_SECRET: "short" });
    const r = await app.call("/api/me/profile");
    expect(r.status).toBe(503);
    expect(r.json.code).toBe("auth_unavailable");
  });
});

describe("PATCH /api/me/profile", () => {
  it("updates the name, bio and username, and keeps the account name in step", async () => {
    const { app, cookie, userId } = await setup();
    const r = await patch(app, cookie, {
      displayName: "  Ada Lovelace ",
      username: "Ada_Dev",
      bio: " Product designer in Lagos. ",
    });
    expect(r.status).toBe(200);
    expect(r.json.profile).toMatchObject({
      displayName: "Ada Lovelace",
      username: "ada_dev",
      bio: "Product designer in Lagos.",
    });
    const row = app.sqlite.prepare("SELECT name FROM user WHERE id = ?").get(userId) as {
      name: string;
    };
    expect(row.name).toBe("Ada Lovelace");
    const audit = app.sqlite
      .prepare("SELECT action, meta FROM audit_log WHERE action LIKE 'profile.%'")
      .all() as Array<{ action: string; meta: string }>;
    expect(audit.map((a) => a.action)).toEqual(["profile.updated"]);
    expect(JSON.stringify(audit)).not.toMatch(/Lovelace|ada_dev|Lagos|ada@example/);
  });

  it("enforces the username rules", async () => {
    const { app, cookie } = await setup();
    const bad = ["ab", "a".repeat(31), "has space", "dash-ed", "dot.ted", "émile", "", "ada!"];
    for (const username of bad) {
      const r = await patch(app, cookie, { username });
      expect(r.status, username).toBe(400);
      expect(r.json.code).toBe("invalid_request");
      expect((r.json.fieldErrors as Record<string, string>).username).toBeTruthy();
    }
    expect((await patch(app, cookie, { username: "abc" })).status).toBe(200);
    expect((await patch(app, cookie, { username: "a".repeat(30) })).status).toBe(200);
    expect((await patch(app, cookie, { username: "UPPER_case_9" })).json.profile).toMatchObject({
      username: "upper_case_9",
    });
  });

  it("blocks reserved words in any case", async () => {
    const { app, cookie } = await setup();
    for (const username of ["admin", "Admin", "SUPPORT", "matrstudio", "settings"]) {
      const r = await patch(app, cookie, { username });
      expect(r.status, username).toBe(400);
      expect(r.json.code).toBe("username_reserved");
    }
  });

  it("keeps usernames unique, ignoring case", async () => {
    const { app, cookie } = await setup();
    const bob = await second(app);
    expect((await patch(app, cookie, { username: "Ada" })).status).toBe(200);
    for (const username of ["ada", "ADA", "aDa"]) {
      const r = await patch(app, bob.cookie, { username });
      expect(r.status, username).toBe(409);
      expect(r.json.code).toBe("username_taken");
      expect((r.json.fieldErrors as Record<string, string>).username).toBeTruthy();
    }
    // Re-saving your own username is fine.
    expect((await patch(app, cookie, { username: "ADA", bio: "hi" })).status).toBe(200);
    // The failed attempt left Bob's own username alone.
    expect(((await get(app, bob.cookie)).json.profile as { username: string }).username).toBe(
      "bobeze",
    );
  });

  it("validates the other fields and refuses unknown or empty bodies", async () => {
    const { app, cookie } = await setup();
    expect((await patch(app, cookie, { bio: "x".repeat(201) })).status).toBe(400);
    expect((await patch(app, cookie, { bio: "x".repeat(200) })).status).toBe(200);
    expect((await patch(app, cookie, { displayName: "" })).status).toBe(400);
    expect((await patch(app, cookie, { displayName: "n".repeat(61) })).status).toBe(400);
    expect((await patch(app, cookie, { displayName: "bad\u0000name" })).status).toBe(400);
    expect((await patch(app, cookie, {})).status).toBe(400);
    expect((await patch(app, cookie, { userId: "someone-else" })).status).toBe(400);
    expect((await patch(app, cookie, { isPublic: "yes" })).status).toBe(400);
    expect((await patch(app, cookie, { visibility: { email: true } })).status).toBe(400);
    const r = await patch(app, cookie, { bio: "<b>bold</b>" });
    expect((r.json.profile as { bio: string }).bio).toBe("<b>bold</b>"); // stored as text, escaped by the web app
  });

  it("toggles public and the per-section flags, auditing the change", async () => {
    const { app, cookie } = await setup();
    const r = await patch(app, cookie, {
      isPublic: true,
      visibility: { stats: false, submissions: false },
    });
    expect(r.json.profile).toMatchObject({
      isPublic: true,
      visibility: { stats: false, paths: true, submissions: false },
    });
    await patch(app, cookie, { isPublic: true });
    const actions = app.sqlite
      .prepare("SELECT action, meta FROM audit_log WHERE action = 'profile.visibility'")
      .all() as Array<{ meta: string }>;
    expect(actions).toHaveLength(1);
    expect(JSON.parse(actions[0]?.meta ?? "{}")).toEqual({ public: true });
  });

  it("rate limits edits per learner after validation", async () => {
    const { app, cookie, userId } = await setup();
    app.sqlite
      .prepare("INSERT INTO rate_limits (key, count, window_start) VALUES (?, 30, ?)")
      .run(`profileUser:${userId}`, Math.floor(Date.now() / 1000));
    expect((await patch(app, cookie, { bio: "x".repeat(300) })).status).toBe(400);
    const r = await patch(app, cookie, { bio: "hello" });
    expect(r.status).toBe(429);
    expect(r.json.code).toBe("rate_limited");
    expect(r.headers.get("retry-after")).toBeTruthy();
  });
});

describe("GET /api/me/profile/username-check", () => {
  it("reports invalid, reserved, taken and available", async () => {
    const { app, cookie } = await setup();
    const bob = await second(app);
    await patch(app, bob.cookie, { username: "bobby" });
    expect((await check(app, cookie, "x")).json).toEqual({ available: false, reason: "invalid" });
    expect((await check(app, cookie, "Admin")).json).toEqual({
      available: false,
      reason: "reserved",
    });
    expect((await check(app, cookie, "BOBBY")).json).toEqual({ available: false, reason: "taken" });
    expect((await check(app, cookie, "free_name")).json).toEqual({ available: true });
    // Your own username is available to you.
    expect((await check(app, cookie, "adaobi")).json).toEqual({ available: true });
  });

  it("is rate limited per learner", async () => {
    const { app, cookie, userId } = await setup();
    app.sqlite
      .prepare("INSERT INTO rate_limits (key, count, window_start) VALUES (?, 60, ?)")
      .run(`profileCheckUser:${userId}`, Math.floor(Date.now() / 1000));
    const r = await check(app, cookie, "free_name");
    expect(r.status).toBe(429);
    // Syntax problems are answered without spending the budget.
    expect((await check(app, cookie, "x")).status).toBe(200);
  });
});

describe("avatar", () => {
  it("stores png, jpeg and webp, checked by magic bytes, and serves it hardened", async () => {
    const { app, cookie, userId } = await setup();
    for (const [head, type] of [
      [PNG, "image/png"],
      [JPEG, "image/jpeg"],
      [WEBP, "image/webp"],
    ] as const) {
      const r = await putAvatar(app, cookie, image(head), {
        "content-type": "application/octet-stream",
      });
      expect(r.status, type).toBe(200);
      const url = (r.json.profile as { avatarUrl: string }).avatarUrl;
      expect(url).toMatch(new RegExp(`^/api/avatars/${userId}\\?v=\\d+$`));
      await patch(app, cookie, { isPublic: true });
      const served = await app.call(`/api/avatars/${userId}`, { origin: null });
      expect(served.status).toBe(200);
      expect(served.headers.get("content-type")).toBe(type);
      expect(served.headers.get("x-content-type-options")).toBe("nosniff");
      expect(served.headers.get("content-disposition")).toBe("inline");
      expect(served.headers.get("content-security-policy")).toContain("default-src 'none'");
      expect(served.headers.get("cache-control")).toContain("max-age=31536000");
      await patch(app, cookie, { isPublic: false });
    }
  });

  it("rejects wrong magic bytes whatever the Content-Type says", async () => {
    const { app, cookie } = await setup();
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    for (const body of [
      html,
      image([0x47, 0x49, 0x46, 0x38]),
      image([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]),
      new Uint8Array(0),
    ]) {
      const r = await putAvatar(app, cookie, body, { "content-type": "image/png" });
      expect(r.status).toBe(400);
      expect(r.json.code).toBe("avatar_invalid");
    }
  });

  it("rejects photos over 200 KB, by header and by actual size", async () => {
    const { app, cookie } = await setup();
    const big = image(PNG, 200 * 1024 + 1);
    const a = await putAvatar(app, cookie, big);
    expect(a.status).toBe(413);
    expect(a.json.code).toBe("avatar_too_large");
    const b = await putAvatar(app, cookie, big, { "content-length": "10" });
    expect(b.status).toBe(413);
    expect((await putAvatar(app, cookie, image(PNG, 200 * 1024))).status).toBe(200);
  });

  it("removes the photo idempotently", async () => {
    const { app, cookie, userId } = await setup();
    await putAvatar(app, cookie, image(PNG));
    const del = await app.call("/api/me/profile/avatar", { method: "DELETE", cookie });
    expect(del.status).toBe(200);
    expect((del.json.profile as { avatarUrl: unknown }).avatarUrl).toBeNull();
    expect((await app.call("/api/me/profile/avatar", { method: "DELETE", cookie })).status).toBe(
      200,
    );
    expect((await app.call(`/api/avatars/${userId}`, { origin: null, cookie })).status).toBe(404);
    const actions = app.sqlite
      .prepare("SELECT action FROM audit_log WHERE action LIKE 'profile.avatar.%' ORDER BY id")
      .all() as Array<{ action: string }>;
    expect(actions.map((a) => a.action)).toEqual(["profile.avatar.set", "profile.avatar.removed"]);
  });

  it("shows a private profile's photo to its owner only", async () => {
    const { app, cookie, userId } = await setup();
    const bob = await second(app);
    await putAvatar(app, cookie, image(PNG));
    expect((await app.call(`/api/avatars/${userId}`, { origin: null })).status).toBe(404);
    expect(
      (await app.call(`/api/avatars/${userId}`, { origin: null, cookie: bob.cookie })).status,
    ).toBe(404);
    const own = await app.call(`/api/avatars/${userId}`, { origin: null, cookie });
    expect(own.status).toBe(200);
    expect(own.headers.get("cache-control")).toContain("private");
  });

  it("is isolated: one learner's upload never touches another's", async () => {
    const { app, cookie, userId } = await setup();
    const bob = await second(app);
    await putAvatar(app, cookie, image(PNG));
    const b = await get(app, bob.cookie);
    expect((b.json.profile as { avatarUrl: unknown }).avatarUrl).toBeNull();
    expect(userId).not.toBe(bob.userId);
  });

  it("validates the user id in the photo path", async () => {
    const { app } = await setup();
    for (const id of ["x", "a b", "../etc", "a".repeat(80)]) {
      expect(
        (await app.call(`/api/avatars/${encodeURIComponent(id)}`, { origin: null })).status,
      ).toBe(404);
    }
  });
});

describe("GET /api/profiles/:username (public)", () => {
  it("answers 404 with one identical body for private, unknown and invalid names", async () => {
    const { app, cookie } = await setup();
    await get(app, cookie); // exists, but private
    const bodies = [];
    for (const name of ["adaobi", "nobody_here", "x", "bad-name", "ADMIN"]) {
      const r = await pub(app, name);
      expect(r.status, name).toBe(404);
      bodies.push(r.text);
    }
    expect(new Set(bodies).size).toBe(1);
  });

  it("needs no session and ignores one", async () => {
    const { app, cookie } = await setup();
    await patch(app, cookie, { isPublic: true, bio: "Hello" });
    const anon = await pub(app, "AdaObi");
    expect(anon.status).toBe(200);
    expect(anon.headers.get("cache-control")).toBe("no-store");
    expect(anon.json.profile).toMatchObject({
      username: "adaobi",
      displayName: "Ada Obi",
      bio: "Hello",
    });
  });

  it("returns only what the owner chose to show, and never private fields", async () => {
    const { app, cookie, userId } = await setup();
    await app.call("/api/me/onboarding", {
      cookie,
      body: { goal: "switch_careers", level: "beginner", topics: ["ui-ux", "brand"] },
    });
    app.sqlite
      .prepare(
        "INSERT INTO resource_submissions (id, user_id, url, url_normalised, title, status, reviewed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)",
      )
      .run(
        "s1",
        userId,
        "https://example.com/grid",
        "example.com/grid",
        "Grid systems",
        "accepted",
        1_700_000_000,
      );
    app.sqlite
      .prepare(
        "INSERT INTO resource_submissions (id, user_id, url, url_normalised, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 1)",
      )
      .run(
        "s2",
        userId,
        "https://example.com/draft",
        "example.com/draft",
        "Still in review",
        "in_review",
      );
    app.sqlite
      .prepare(
        "INSERT INTO saved_resources (user_id, resource_id, created_at) VALUES (?, 'secret-save', 1)",
      )
      .run(userId);
    await patch(app, cookie, { isPublic: true });

    const all = (await pub(app, "adaobi")).json.profile as Record<string, unknown>;
    expect(all.level).toBe("beginner");
    expect(all.topics).toEqual(["ui-ux", "brand"]);
    expect(all.submissions).toEqual([
      {
        title: "Grid systems",
        url: "https://example.com/grid",
        topic: null,
        approvedAt: new Date(1_700_000_000 * 1000).toISOString(),
      },
    ]);
    const text = JSON.stringify(all);
    for (const secret of [
      "ada@example.com",
      "secret-save",
      "Still in review",
      userId,
      "switch_careers",
    ])
      expect(text, secret).not.toContain(secret);

    await patch(app, cookie, { visibility: { submissions: false, paths: false, stats: false } });
    const hidden = (await pub(app, "adaobi")).json.profile as Record<string, unknown>;
    expect(hidden.submissions).toBeNull();
    expect(hidden.completedPaths).toBeNull();
    expect(hidden.stats).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain("Grid systems");
  });

  it("goes back to 404 when the owner turns it off", async () => {
    const { app, cookie } = await setup();
    await patch(app, cookie, { isPublic: true });
    expect((await pub(app, "adaobi")).status).toBe(200);
    await patch(app, cookie, { isPublic: false });
    expect((await pub(app, "adaobi")).status).toBe(404);
  });

  it("is rate limited per IP", async () => {
    const { app } = await setup();
    app.sqlite
      .prepare("INSERT INTO rate_limits (key, count, window_start) VALUES (?, 120, ?)")
      .run("profile:ip:203.0.113.9", Math.floor(Date.now() / 1000));
    const limited = await pub(app, "adaobi", "203.0.113.9");
    expect(limited.status).toBe(429);
    expect(limited.json.code).toBe("rate_limited");
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect((await pub(app, "adaobi", "203.0.113.10")).status).toBe(404);
  });
});

describe("account deletion", () => {
  it("removes the profile and the photo with the account", async () => {
    const { app, cookie, userId } = await setup();
    await putAvatar(app, cookie, image(PNG));
    await patch(app, cookie, { isPublic: true });
    const del = await app.call("/api/me", { method: "DELETE", cookie, body: {} });
    expect(del.status).toBe(200);
    expect(
      app.sqlite.prepare("SELECT COUNT(*) AS n FROM profiles WHERE user_id = ?").get(userId),
    ).toEqual({ n: 0 });
    expect((await pub(app, "adaobi")).status).toBe(404);
  });
});
