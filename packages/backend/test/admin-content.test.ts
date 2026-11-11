import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAccessKeyCache } from "../src/auth/access";
import { createCustomRole } from "../src/auth/admin-perms";
import { runLinkChecks } from "../src/cron/link-check";
import { type AdminApp, createAdminApp } from "./admin-helpers";
import { ORIGIN } from "./helpers";

vi.setConfig({ testTimeout: 90_000 });

afterEach(() => {
  vi.unstubAllGlobals();
  resetAccessKeyCache();
});

const BOSS = "boss@example.com";
const CUR = "curator@example.com";
const SUP = "support@example.com";

type J = Record<string, any>;
type Res = { status: number; json: J; adminCookie?: string };

async function setup() {
  const app = await createAdminApp();
  const boss = await app.enrolAdmin(BOSS, "super_admin", "Tolu Adeyemi");
  const curRole = await createCustomRole(app.env, {
    name: "Curator",
    permissions: { resources: "manage", paths: "manage", review_queues: "manage" },
  });
  const supRole = await createCustomRole(app.env, {
    name: "Support",
    permissions: { support_inbox: "manage", resources: "none", review_queues: "none" },
  });
  const cur = await app.enrolAdmin(CUR, curRole.id, "Kemi Curator");
  const sup = await app.enrolAdmin(SUP, supRole.id, "Sade Support");
  const ada = (await app.signUpConfirmed("ada@example.com", undefined, "Ada Obi")).cookie as string;
  const bob = (await app.signUpConfirmed("bob@example.com", undefined, "Bob Eze")).cookie as string;
  return { app, boss, cur, sup, ada, bob };
}
type Ctx = Awaited<ReturnType<typeof setup>>;

const as =
  (app: AdminApp, who: { email: string; cookie: string }) =>
  async (path: string, opts: J = {}) =>
    (await app.call(`/api/admin${path}`, {
      as: who.email,
      cookie: who.cookie,
      ...opts,
    })) as unknown as Res;
const learner = async (
  app: AdminApp,
  cookie: string,
  path: string,
  body?: unknown,
  method?: string,
) => (await app.call(path, { as: null, origin: ORIGIN, cookie, body, method })) as unknown as Res;

/** Page fetches answered by `handler`; everything else (Access keys, HIBP) by the previous stub. */
function stubPages(handler: (url: string) => Response | undefined) {
  const prev = globalThis.fetch;
  const seen: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://example.") || url.includes(".test/")) {
      seen.push(url);
      return handler(url) ?? new Response("nope", { status: 404 });
    }
    return prev(input, init);
  });
  return seen;
}
const html = (title: string, extra = "") =>
  new Response(
    `<html lang="en"><head><title>${title}</title><meta property="og:site_name" content="Example Blog">${extra}</head></html>`,
    { headers: { "content-type": "text/html" } },
  );

const newResource = (url = "https://example.com/grid", over: J = {}) => ({
  url,
  title: "Grid basics",
  type: "article",
  topic: "ui-ux",
  level: "beginner",
  intro: "Start here.",
  tags: ["Grids"],
  status: "live",
  ...over,
});
const addResource = async (c: Ctx, url?: string, over?: J) => {
  const r = await as(c.app, c.boss)("/resources", { body: newResource(url, over) });
  expect(r.status).toBe(201);
  return r.json.resource as J;
};

describe("role guards", () => {
  it("keeps each admin inside their role", async () => {
    const c = await setup();
    const sup = as(c.app, c.sup);
    expect((await sup("/resources")).status).toBe(403);
    expect((await sup("/paths")).status).toBe(403);
    expect((await sup("/review/submissions")).status).toBe(403);
    const cur = as(c.app, c.cur);
    expect((await cur("/resources")).status).toBe(200);
    expect((await cur("/settings/taxonomy")).status).toBe(403);
    expect((await cur("/settings/queue-targets")).status).toBe(403);
    expect((await cur("/settings/email-templates")).status).toBe(403);
    expect((await cur("/settings/home-curation")).status).toBe(200);
    const noSession = await c.app.call("/api/admin/resources", { as: CUR });
    expect(noSession.status).toBe(401);
  });

  it("a view-only role cannot write", async () => {
    const c = await setup();
    const role = await createCustomRole(c.app.env, {
      name: "Viewer",
      permissions: { resources: "view", paths: "view" },
    });
    const v = await c.app.enrolAdmin("viewer@example.com", role.id);
    const call = as(c.app, v);
    expect((await call("/resources")).status).toBe(200);
    expect((await call("/resources", { body: newResource() })).status).toBe(403);
    expect(
      (await call("/paths", { body: { title: "x", topic: "ui-ux", level: "beginner" } })).status,
    ).toBe(403);
  });
});

describe("resources", () => {
  it("previews a link and never fetches private or looping addresses", async () => {
    const c = await setup();
    const seen = stubPages((u) =>
      u === "https://example.com/redirect-private"
        ? new Response(null, { status: 302, headers: { location: "https://localhost/admin" } })
        : u === "https://example.com/redirect-ip"
          ? new Response(null, { status: 302, headers: { location: "https://10.0.0.1/" } })
          : html(
              "Grid basics for UI designers",
              '<meta property="og:video:duration" content="960">',
            ),
    );
    const call = as(c.app, c.boss);
    const ok = await call("/resources/preview", {
      body: { url: "https://example.com/grid?utm_source=x" },
    });
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({
      title: "Grid basics for UI designers",
      source: "Example Blog",
      durationMin: 16,
      linkOk: true,
      duplicateOf: null,
    });
    expect(ok.json.suggested.type).toBe("article");
    for (const url of [
      "https://localhost/x",
      "https://127.0.0.1/",
      "https://[::1]/",
      "https://intranet/x",
      "https://a.internal/x",
      "http://example.com/x",
      "https://user:pw@example.com/",
    ]) {
      const r = await call("/resources/preview", { body: { url } });
      expect([400]).toContain(r.status);
    }
    expect(seen.filter((u) => /localhost|127\.|::1|intranet|internal/.test(u))).toEqual([]);
    const redirect = await call("/resources/preview", {
      body: { url: "https://example.com/redirect-private" },
    });
    expect(redirect.json.linkOk).toBe(false);
    const redirect2 = await call("/resources/preview", {
      body: { url: "https://example.com/redirect-ip" },
    });
    expect(redirect2.json.linkOk).toBe(false);
    expect(seen.some((u) => u.includes("localhost") || u.includes("10.0.0.1"))).toBe(false);
  });

  it("rate limits previews per admin", async () => {
    const c = await setup();
    stubPages(() => html("x"));
    const call = as(c.app, c.boss);
    let last = 0;
    for (let i = 0; i < 31; i++)
      last = (await call("/resources/preview", { body: { url: "https://example.com/a" } })).status;
    expect(last).toBe(429);
  });

  it("creates, detects duplicates by normalised URL, lists with filters and cursor", async () => {
    const c = await setup();
    const call = as(c.app, c.boss);
    const r1 = await addResource(c, "https://example.com/grid");
    expect(r1.tags).toEqual(["grids"]);
    const dup = await call("/resources", {
      body: newResource("https://EXAMPLE.com/grid/?utm_medium=a#top"),
    });
    expect(dup.status).toBe(409);
    expect(dup.json).toMatchObject({ code: "duplicate", existing: { id: r1.id } });
    const preview = await call("/resources/preview", {
      body: { url: "https://example.com/grid/" },
    });
    stubPages(() => html("x"));
    expect(preview.status).toBe(200);
    await addResource(c, "https://example.com/two", { title: "Spacing", type: "video" });
    await addResource(c, "https://example.com/three", { title: "Colour", level: "advanced" });
    const bad = await call("/resources", {
      body: newResource("https://example.com/x", { topic: "nope" }),
    });
    expect(bad.status).toBe(400);
    const all = await call("/resources?limit=2");
    expect(all.json.items).toHaveLength(2);
    expect(all.json.nextCursor).toBeTruthy();
    const page2 = await call(
      `/resources?limit=2&cursor=${encodeURIComponent(all.json.nextCursor)}`,
    );
    expect(page2.json.items).toHaveLength(1);
    expect(page2.json.nextCursor).toBeNull();
    expect((await call("/resources?type=video")).json.items).toHaveLength(1);
    expect((await call("/resources?q=colo")).json.items[0].title).toBe("Colour");
    expect((await call("/resources?level=advanced")).json.items).toHaveLength(1);
    expect((await call("/resources?q=%25")).json.items).toHaveLength(0);
    expect((await call("/resources?cursor=@@")).status).toBe(400);
    expect(all.json.counts.total).toBe(3);
    expect(c.app.audit("content.resource.created")).toHaveLength(3);
  });

  it("gets detail, patches and retires with usage", async () => {
    const c = await setup();
    const call = as(c.app, c.boss);
    const r = await addResource(c);
    const path = (
      await call("/paths", {
        body: { title: "UI Foundations", topic: "ui-ux", level: "beginner", time: "60 min" },
      })
    ).json;
    const mod = await call(`/paths/${path.id}`, {
      method: "PATCH",
      body: { modules: [{ title: "Getting started", lessonIds: [] }] },
    });
    const moduleId = mod.json.modules[0].id;
    await call(`/paths/${path.id}/lessons`, { body: { resourceIds: [r.id], moduleId } });
    const detail = await call(`/resources/${r.id}`);
    expect(detail.json.usedIn[0]).toMatchObject({
      pathTitle: "UI Foundations",
      moduleNumber: 1,
      lessonNumber: 1,
    });
    expect(detail.json.stats30d).toMatchObject({ opened: null, saved: 0, brokenReports: 0 });
    const patched = await call(`/resources/${r.id}`, {
      method: "PATCH",
      body: { intro: "New intro", tags: ["a b", "grids"] },
    });
    expect(patched.json.intro).toBe("New intro");
    expect(patched.json.tags).toEqual(["a-b", "grids"]);
    expect((await call(`/resources/${r.id}`, { method: "PATCH", body: {} })).status).toBe(400);
    expect((await call(`/resources/${r.id}/retire`, { body: { confirm: false } })).status).toBe(
      400,
    );
    const retired = await call(`/resources/${r.id}/retire`, { body: { confirm: true } });
    expect(retired.status).toBe(200);
    expect(retired.json.flaggedLessons).toHaveLength(1);
    expect((await call(`/resources/${r.id}/retire`, { body: { confirm: true } })).status).toBe(409);
    expect(
      (await call(`/resources/${r.id}`, { method: "PATCH", body: { intro: "z" } })).status,
    ).toBe(409);
    expect((await call("/resources")).json.items).toHaveLength(0);
    expect((await call("/resources?status=retired")).json.items).toHaveLength(1);
    expect((await call("/resources/nope%20id")).status).toBe(404);
  });

  it("fixes a link and tells the reporters", async () => {
    const c = await setup();
    const call = as(c.app, c.boss);
    const r = await addResource(c, "https://example.com/old", { title: "Intro to grids" });
    for (const cookie of [c.ada, c.bob])
      await learner(c.app, cookie, "/api/me/support", {
        kind: "report",
        category: "Broken link",
        subject: "Link broken",
        message: "The video is gone.",
        context: { resource: "Intro to grids", link: "https://example.com/old" },
      });
    const list = await call("/review/link-reports");
    expect(list.json.items[0]).toMatchObject({ id: r.id, reportCount: 2 });
    stubPages((u) => (u === "https://example.com/new" ? html("ok") : undefined));
    expect(
      (
        await call(`/resources/${r.id}/fix-link`, {
          body: { url: "https://example.com/dead", notifyReporters: true },
        })
      ).status,
    ).toBe(422);
    const fixed = await call(`/resources/${r.id}/fix-link`, {
      body: { url: "https://example.com/new", notifyReporters: true },
    });
    expect(fixed.status).toBe(200);
    expect(fixed.json.notified).toBe(2);
    expect(fixed.json.url).toBe("https://example.com/new");
    const notes = c.app.sqlite.prepare("SELECT kind FROM notifications").all() as J[];
    expect(notes.map((n) => n.kind)).toEqual(["report-fixed", "report-fixed"]);
    const tickets = c.app.sqlite.prepare("SELECT status FROM support_tickets").all() as J[];
    expect(tickets.every((t) => t.status === "fixed")).toBe(true);
    expect((await call("/review/link-reports")).json.items).toHaveLength(0);
    expect((await call("/review/link-reports?status=fixed")).json.items).toHaveLength(1);
    expect(c.app.audit("content.resource.link_fixed")).toHaveLength(1);
  });
});

describe("link-check job", () => {
  it("marks needs_fix after two failures in a row and recovers on a pass", async () => {
    const c = await setup();
    const r = await addResource(c, "https://example.com/flaky");
    let up = false;
    stubPages(() => (up ? html("ok") : new Response("gone", { status: 404 })));
    const day = 86400;
    const t0 = Math.floor(Date.now() / 1000);
    expect(await runLinkChecks(c.app.env, { now: t0 })).toEqual({ checked: 1, failed: 1 });
    expect(await runLinkChecks(c.app.env, { now: t0 + 60 })).toEqual({ checked: 0, failed: 0 });
    const status = () =>
      (c.app.sqlite.prepare("SELECT status FROM resources WHERE id = ?").get(r.id as string) as J)
        .status;
    expect(status()).toBe("live");
    await runLinkChecks(c.app.env, { now: t0 + day });
    expect(status()).toBe("needs_fix");
    const call = as(c.app, c.boss);
    expect((await call("/resources?tab=needs_fix")).json.items).toHaveLength(1);
    up = true;
    await runLinkChecks(c.app.env, { now: t0 + 2 * day });
    expect(status()).toBe("live");
    const detail = await call(`/resources/${r.id}`);
    expect(detail.json.linkCheck.ok).toBe(true);
    expect(detail.json.linkChecks).toHaveLength(3);
  });

  it("never fetches a stored private address", async () => {
    const c = await setup();
    const seen = stubPages(() => html("ok"));
    c.app.sqlite
      .prepare(
        `INSERT INTO resources (id, url, url_normalised, title, type, topic, level, status, created_at, updated_at)
         VALUES ('r1', 'https://localhost/x', 'https://localhost/x', 'x', 'article', 'ui-ux', 'beginner', 'live', 1, 1)`,
      )
      .run();
    const res = await runLinkChecks(c.app.env);
    expect(res.failed).toBe(1);
    expect(seen).toEqual([]);
  });
});

describe("paths", () => {
  async function draftPath(c: Ctx) {
    const call = as(c.app, c.boss);
    const r1 = await addResource(c, "https://example.com/a", { title: "Lesson A" });
    const r2 = await addResource(c, "https://example.com/b", { title: "Lesson B" });
    const created = await call("/paths", {
      body: { title: "UI/UX Foundations", topic: "ui-ux", level: "beginner", time: "90 min" },
    });
    expect(created.status).toBe(201);
    const path = created.json;
    expect(path.status).toBe("draft");
    const mods = await call(`/paths/${path.id}`, {
      method: "PATCH",
      body: {
        modules: [
          { title: "One", lessonIds: [] },
          { title: "Two", lessonIds: [] },
        ],
      },
    });
    const [m1, m2] = mods.json.modules;
    const added = await call(`/paths/${path.id}/lessons`, {
      body: { resourceIds: [r1.id, r2.id], moduleId: m1.id },
    });
    expect(added.json.added).toHaveLength(2);
    const again = await call(`/paths/${path.id}/lessons`, {
      body: { resourceIds: [r1.id], moduleId: m1.id },
    });
    expect(again.json.skipped).toEqual([r1.id]);
    return { call, path, m1, m2, r1, r2, lessons: added.json.added as string[] };
  }

  it("blocks publishing until the checklist passes, then publishes and unpublishes", async () => {
    const c = await setup();
    const { call, path, lessons } = await draftPath(c);
    const check = await call(`/paths/${path.id}/publish-check`);
    expect(check.json.canPublish).toBe(false);
    expect(check.json.checks.find((x: J) => x.key === "intros")).toMatchObject({
      ok: false,
      lessonIds: lessons,
    });
    expect(check.json.warnings[0]).toContain("cover");
    const blocked = await call(`/paths/${path.id}/publish`, { body: {} });
    expect(blocked.status).toBe(409);
    expect(blocked.json.code).toBe("publish_blocked");
    for (const l of lessons)
      await call(`/paths/${path.id}/lessons/${l}`, {
        method: "PATCH",
        body: { intro: "Why this matters" },
      });
    const pub = await call(`/paths/${path.id}/publish`, { body: {} });
    expect(pub.status).toBe(200);
    expect(pub.json.status).toBe("live");
    expect((await call(`/paths/${path.id}/publish`, { body: {} })).status).toBe(409);
    expect((await call("/paths?status=live")).json.items).toHaveLength(1);
    const un = await call(`/paths/${path.id}/unpublish`, { body: {} });
    expect(un.json.status).toBe("unpublished");
    expect((await call(`/paths/${path.id}/unpublish`, { body: {} })).status).toBe(409);
    expect(c.app.audit("content.path.published")).toHaveLength(1);
  });

  it("refuses a module change that drops lessons, and reorders otherwise", async () => {
    const c = await setup();
    const { call, path, m1, m2, lessons } = await draftPath(c);
    const drop = await call(`/paths/${path.id}`, {
      method: "PATCH",
      body: {
        modules: [
          { id: m1.id, title: "One", lessonIds: [lessons[0]] },
          { id: m2.id, title: "Two", lessonIds: [] },
        ],
      },
    });
    expect(drop.status).toBe(409);
    const bogus = await call(`/paths/${path.id}`, {
      method: "PATCH",
      body: { modules: [{ id: m1.id, title: "One", lessonIds: [lessons[0], "ghost"] }] },
    });
    expect(bogus.status).toBe(400);
    const ok = await call(`/paths/${path.id}`, {
      method: "PATCH",
      body: {
        modules: [
          { id: m2.id, title: "Two", lessonIds: [lessons[1]] },
          { id: m1.id, title: "One!", lessonIds: [lessons[0]] },
        ],
      },
    });
    expect(ok.status).toBe(200);
    expect(ok.json.modules.map((m: J) => m.title)).toEqual(["Two", "One!"]);
    expect(ok.json.modules[0].lessons[0].id).toBe(lessons[1]);
  });

  it("removes a lesson from a live path and tells the learners", async () => {
    const c = await setup();
    const { call, path, lessons } = await draftPath(c);
    for (const l of lessons)
      await call(`/paths/${path.id}/lessons/${l}`, { method: "PATCH", body: { intro: "Why" } });
    await call(`/paths/${path.id}/publish`, { body: {} });
    const slug = path.slug as string;
    const adaId = (
      c.app.sqlite.prepare("SELECT id FROM user WHERE email = 'ada@example.com'").get() as J
    ).id;
    const bobId = (
      c.app.sqlite.prepare("SELECT id FROM user WHERE email = 'bob@example.com'").get() as J
    ).id;
    const iso = new Date().toISOString();
    // Ada finished lesson 1 (so she is on lesson 2); Bob just started.
    c.app.sqlite
      .prepare("INSERT INTO path_enrolments (user_id, path_slug, started_at) VALUES (?, ?, ?)")
      .run(adaId, slug, iso);
    c.app.sqlite
      .prepare("INSERT INTO path_enrolments (user_id, path_slug, started_at) VALUES (?, ?, ?)")
      .run(bobId, slug, iso);
    c.app.sqlite
      .prepare(
        "INSERT INTO path_lessons_done (user_id, path_slug, lesson_id, completed_at) VALUES (?, ?, ?, ?)",
      )
      .run(adaId, slug, lessons[0] as string, iso);
    const impact = await call(`/paths/${path.id}/lessons/${lessons[1]}/removal-impact`);
    expect(impact.json).toMatchObject({
      live: true,
      tookLesson: 0,
      onLesson: 1,
      onPath: 2,
      notify: 2,
    });
    const first = await call(`/paths/${path.id}/lessons/${lessons[0]}/removal-impact`);
    expect(first.json).toMatchObject({ tookLesson: 1, onLesson: 1, notify: 2 });
    const del = await call(`/paths/${path.id}/lessons/${lessons[1]}`, {
      method: "DELETE",
      body: { message: "Lesson B was removed." },
    });
    expect(del.status).toBe(200);
    expect(del.json.notified).toBe(2);
    const notes = c.app.sqlite.prepare("SELECT kind, body, href FROM notifications").all() as J[];
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatchObject({ kind: "new-lesson", body: "Lesson B was removed." });
    expect(notes[0]?.href).toBe(`/learn/paths/ui-ux/${slug}`);
    // Ada had done every remaining lesson, so recalculating finishes her path.
    const ada = c.app.sqlite
      .prepare("SELECT completed_at FROM path_enrolments WHERE user_id = ?")
      .get(adaId) as J;
    expect(ada.completed_at).toBeTruthy();
    expect(del.json.modules[0].lessons).toHaveLength(1);
    // The last lesson of a live path cannot go.
    const last = await call(`/paths/${path.id}/lessons/${lessons[0]}`, { method: "DELETE" });
    expect(last.status).toBe(409);
    expect((await call(`/paths/${path.id}/lessons/ghost`, { method: "DELETE" })).status).toBe(404);
  });

  it("previews as a learner and flags retired resources", async () => {
    const c = await setup();
    const { call, path, r1 } = await draftPath(c);
    await call(`/resources/${r1.id}/retire`, { body: { confirm: true } });
    const p = await call(`/paths/${path.id}/preview`);
    expect(p.json.modules[0].lessons).toHaveLength(2);
    expect(p.json.modules[0].lessons[0].unavailable).toBe(true);
    expect(p.json.banner).toContain("as a learner");
    expect(
      (await call(`/paths/${path.id}/lessons`, { body: { resourceIds: [r1.id], moduleId: "x" } }))
        .status,
    ).toBe(400);
  });
});

describe("review: submissions", () => {
  async function submit(
    c: Ctx,
    cookie: string,
    url = "https://example.com/spacing",
    title = "Spacing and rhythm",
  ) {
    const r = await learner(c.app, cookie, "/api/me/submissions", {
      url,
      title,
      topic: "ui-ux",
      note: "Helps.",
    });
    expect(r.status).toBe(201);
    return (r.json.submission as J).id as string;
  }
  const record = {
    record: {
      title: "Spacing and rhythm",
      type: "article",
      topic: "UI/UX",
      level: "beginner",
      intro: "Good.",
      tags: [],
      placement: "library",
    },
    credit: true,
  };

  it("lists oldest first with auto-checks and duplicates", async () => {
    const c = await setup();
    stubPages(() => html("Spacing"));
    const id = await submit(c, c.ada);
    await addResource(c, "https://example.com/other");
    const call = as(c.app, c.cur);
    const list = await call("/review/submissions");
    expect(list.json.items[0]).toMatchObject({
      id,
      submitter: { name: "Ada Obi" },
      ageDays: 0,
      overdue: false,
    });
    expect(list.json.targetDays).toBe(3);
    const d = await call(`/review/submissions/${id}`);
    expect(d.json.autoChecks.map((x: J) => [x.key, x.status])).toEqual([
      ["link_works", "pass"],
      ["free_to_read", "warn"],
      ["not_in_library", "pass"],
      ["language", "pass"],
    ]);
    expect(d.json.submitter).toMatchObject({ submitted: 1, approved: 0, declined: 0 });
    c.app.sqlite.prepare("UPDATE resource_submissions SET created_at = created_at - 400000").run();
    expect((await call("/review/submissions")).json.items[0].overdue).toBe(true);
    expect((await call("/review/submissions?status=bogus")).status).toBe(400);
    expect((await call("/review/submissions?assignee=none")).json.items).toHaveLength(1);
  });

  it("approves once, creates the resource, credits and notifies; the second reviewer gets 409", async () => {
    const c = await setup();
    stubPages(() => html("Spacing"));
    const id = await submit(c, c.ada);
    const call = as(c.app, c.cur);
    const [a, b] = await Promise.all([
      call(`/review/submissions/${id}/approve`, { body: record }),
      as(c.app, c.boss)(`/review/submissions/${id}/approve`, { body: record }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.json.code).toBe("already_reviewed");
    const winner = a.status === 200 ? a : b;
    expect(winner.json.nextId).toBeNull();
    expect(c.app.sqlite.prepare("SELECT status, url FROM resources").get()).toMatchObject({
      status: "live",
      url: "https://example.com/spacing",
    });
    const sub = c.app.sqlite
      .prepare("SELECT status, reviewed_by FROM resource_submissions WHERE id = ?")
      .get(id) as J;
    expect(sub.status).toBe("accepted");
    expect(c.app.sqlite.prepare("SELECT submitted_by FROM resources").get()).toMatchObject({
      submitted_by: expect.any(String),
    });
    expect(c.app.sqlite.prepare("SELECT * FROM notifications").all() as J[]).toHaveLength(1);
    expect(c.app.last("staff-message")).toMatchObject({ to: "ada@example.com" });
    expect(c.app.audit("review.submission.approved")).toHaveLength(1);
    expect(
      (await call(`/review/submissions/${id}/decline`, { body: { reason: "not_a_fit" } })).json
        .code,
    ).toBe("already_reviewed");
  });

  it("refuses to approve a URL already in the library, and requests changes and declines", async () => {
    const c = await setup();
    stubPages(() => html("x"));
    await addResource(c, "https://example.com/spacing");
    const dupId = await submit(c, c.ada);
    const call = as(c.app, c.cur);
    const dup = await call(`/review/submissions/${dupId}/approve`, { body: record });
    expect(dup.status).toBe(409);
    expect(dup.json.code).toBe("duplicate");
    expect(
      (c.app.sqlite.prepare("SELECT status FROM resource_submissions WHERE id = ?").get(dupId) as J)
        .status,
    ).toBe("in_review");
    const ch = await call(`/review/submissions/${dupId}/request-change`, {
      body: { message: "Add why it helps." },
    });
    expect(ch.json.submission.status).toBe("needs_changes");
    expect(
      (await call(`/review/submissions/${dupId}/request-change`, { body: { message: "again" } }))
        .status,
    ).toBe(409);
    const id2 = await submit(c, c.bob, "https://example.com/two", "Two");
    expect(
      (await call(`/review/submissions/${id2}/decline`, { body: { reason: "nope" } })).status,
    ).toBe(400);
    const dec = await call(`/review/submissions/${id2}/decline`, {
      body: { reason: "duplicate", note: "Same video." },
    });
    expect(dec.status).toBe(200);
    const stats = await call(`/review/submissions/${id2}`);
    expect(stats.json.submitter.declined).toBe(0);
    expect(stats.json.declineReason).toBe("duplicate");
    const mine = (await learner(c.app, c.bob, "/api/me/submissions")).json.submissions as J[];
    expect(mine[0]).toMatchObject({ status: "declined" });
  });

  it("assigns only to active reviewers", async () => {
    const c = await setup();
    stubPages(() => html("x"));
    const id = await submit(c, c.ada);
    const call = as(c.app, c.cur);
    const me = await call(`/review/submissions/${id}/assign`, {
      method: "PATCH",
      body: { assignee: "me" },
    });
    expect(me.json.assignedTo.name).toBe("Kemi Curator");
    expect(
      (
        await call(`/review/submissions/${id}/assign`, {
          method: "PATCH",
          body: { assignee: c.sup.adminId },
        })
      ).status,
    ).toBe(400);
    expect((await call("/review/submissions?assignee=me")).json.items).toHaveLength(1);
    const clear = await call(`/review/submissions/${id}/assign`, {
      method: "PATCH",
      body: { assignee: null },
    });
    expect(clear.json.assignedTo).toBeNull();
  });
});

describe("review: link reports", () => {
  it("shows reports for a resource and dismissing notifies the reporters", async () => {
    const c = await setup();
    const r = await addResource(c, "https://example.com/vid", { title: "Intro video" });
    await learner(c.app, c.ada, "/api/me/support", {
      kind: "report",
      category: "Broken link",
      message: "It will not play for me.",
      context: { resource: "Intro video" },
    });
    await learner(c.app, c.bob, "/api/me/support", {
      kind: "report",
      category: "Something’s broken",
      message: "Button broken here.",
    });
    const call = as(c.app, c.cur);
    const list = await call("/review/link-reports");
    expect(list.json.items).toHaveLength(1);
    const d = await call(`/review/link-reports/${r.id}`);
    expect(d.json.reports[0]).toMatchObject({
      name: "Ada Obi",
      text: "It will not play for me.",
    });
    expect(
      (
        await call(`/review/link-reports/${r.id}/assign`, {
          method: "PATCH",
          body: { assignee: "me" },
        })
      ).status,
    ).toBe(200);
    expect((await call("/review/link-reports?assignee=me")).json.items).toHaveLength(1);
    const dis = await call(`/review/link-reports/${r.id}/dismiss`, {
      body: { note: "Opens fine for us." },
    });
    expect(dis.json).toMatchObject({ status: "dismissed", notified: 1 });
    expect(c.app.sqlite.prepare("SELECT kind, body FROM notifications").all()).toEqual([
      { kind: "report-cant-reproduce", body: "Opens fine for us." },
    ]);
    expect((await call(`/review/link-reports/${r.id}/dismiss`, { body: {} })).json.code).toBe(
      "already_reviewed",
    );
    // A newer report reopens it.
    await learner(c.app, c.bob, "/api/me/support", {
      kind: "report",
      category: "Broken link",
      message: "Broken again now.",
      context: { resource: "Intro video" },
    });
    c.app.sqlite.prepare("UPDATE link_report_state SET handled_at = handled_at - 100").run();
    expect((await call("/review/link-reports")).json.items).toHaveLength(1);
    expect((await as(c.app, c.sup)("/review/link-reports")).status).toBe(403);
  });
});

describe("review: profile reports", () => {
  async function publicProfile(c: Ctx, cookie: string) {
    const res = await learner(c.app, cookie, "/api/me/profile", { isPublic: true }, "PATCH");
    expect(res.status).toBe(200);
    return (res.json.profile as J).username as string;
  }

  it("takes a learner report, then hides the profile with a message", async () => {
    const c = await setup();
    const handle = await publicProfile(c, c.ada);
    const rep = (cookie: string, body: J = { username: handle, reason: "spam" }) =>
      learner(c.app, cookie, "/api/me/profile-reports", body);
    expect((await rep(c.bob)).status).toBe(201);
    expect((await rep(c.bob)).status).toBe(201); // same person: still one report
    expect((c.app.sqlite.prepare("SELECT COUNT(*) AS n FROM profile_reports").get() as J).n).toBe(
      1,
    );
    expect((await rep(c.ada)).status).toBe(400); // own profile
    expect((await rep(c.bob, { username: "nobody-here", reason: "spam" })).status).toBe(404);
    expect(
      (await learner(c.app, "", "/api/me/profile-reports", { username: handle, reason: "spam" }))
        .status,
    ).toBe(401);
    const call = as(c.app, c.cur);
    const list = await call("/review/profile-reports");
    expect(list.json.items[0]).toMatchObject({ handle: `@${handle}`, reportCount: 1 });
    const id = list.json.items[0].id;
    const d = await call(`/review/profile-reports/${id}`);
    expect(d.json.reports[0].text).toContain("Spam");
    expect(JSON.stringify(d.json)).not.toContain("bob");
    const hide = await call(`/review/profile-reports/${id}/hide-profile`, {
      body: { message: "Your profile broke our guidelines." },
    });
    expect(hide.json.status).toBe("hidden");
    expect(
      (
        await c.app.call(`/api/profiles/${handle}`, {
          headers: { "cf-connecting-ip": "203.0.113.9" },
        })
      ).status,
    ).toBe(404);
    expect((await learner(c.app, c.ada, "/api/me/profile")).status).toBe(200);
    expect((c.app.sqlite.prepare("SELECT body FROM notifications").get() as J).body).toContain(
      "guidelines",
    );
    expect((await call(`/review/profile-reports/${id}/dismiss`, { body: {} })).json.code).toBe(
      "already_reviewed",
    );
    expect((await rep(c.bob)).status).toBe(404); // hidden profiles can't be reported again
  });

  it("dismisses without touching the profile", async () => {
    const c = await setup();
    const handle = await publicProfile(c, c.ada);
    await learner(c.app, c.bob, "/api/me/profile-reports", {
      username: handle,
      reason: "other",
      note: "meh",
    });
    const call = as(c.app, c.cur);
    const id = (await call("/review/profile-reports")).json.items[0].id;
    expect(
      (
        await call(`/review/profile-reports/${id}/assign`, {
          method: "PATCH",
          body: { assignee: "me" },
        })
      ).status,
    ).toBe(200);
    expect(
      (await call(`/review/profile-reports/${id}/dismiss`, { body: { note: "fine" } })).json.status,
    ).toBe("dismissed");
    expect(
      (
        await c.app.call(`/api/profiles/${handle}`, {
          headers: { "cf-connecting-ip": "203.0.113.10" },
        })
      ).status,
    ).toBe(200);
    expect((await call("/review/profile-reports?status=handled")).json.items).toHaveLength(1);
  });
});

describe("settings", () => {
  it("manages taxonomy with usage, merge and guarded delete", async () => {
    const c = await setup();
    const call = as(c.app, c.boss);
    await addResource(c, "https://example.com/a", { tags: ["UX", "Wireframing"] });
    await addResource(c, "https://example.com/b", { tags: ["UX"] });
    const tags = (await call("/settings/taxonomy?kind=tag")).json.items as J[];
    const ux = tags.find((t) => t.slug === "ux") as J;
    expect(ux).toMatchObject({ resources: 2, paths: 0 });
    expect((await call("/settings/taxonomy", { body: { kind: "tag", name: "ux" } })).status).toBe(
      409,
    );
    const added = await call("/settings/taxonomy", {
      body: { kind: "tag", name: "User experience" },
    });
    expect(added.status).toBe(201);
    const merge = await call(`/settings/taxonomy/${ux.id}/merge`, {
      body: { into: added.json.item.id },
    });
    expect(merge.json.moved.resources).toBe(2);
    expect((await call(`/settings/taxonomy/${ux.id}/usage`)).status).toBe(404);
    expect(
      (
        await call(`/settings/taxonomy/${added.json.item.id}/merge`, {
          body: { into: "topic-brand" },
        })
      ).status,
    ).toBe(400);
    const wf = tags.find((t) => t.slug === "wireframing") as J;
    const inUse = await call(`/settings/taxonomy/${wf.id}`, { method: "DELETE" });
    expect(inUse.status).toBe(409);
    expect(inUse.json).toMatchObject({ code: "in_use", resources: 1 });
    expect(
      (await call(`/settings/taxonomy/${wf.id}`, { method: "DELETE", body: { mode: "remove" } }))
        .status,
    ).toBe(200);
    const topic = await call("/settings/taxonomy/topic-ui-ux", {
      method: "DELETE",
      body: { mode: "remove" },
    });
    expect(topic.status).toBe(400);
    const moved = await call("/settings/taxonomy/topic-ui-ux", {
      method: "DELETE",
      body: { mode: "move", into: "topic-brand" },
    });
    expect(moved.status).toBe(200);
    expect((await call("/resources")).json.items.every((r: J) => r.topicSlug === "brand")).toBe(true);
    expect(
      (await call("/settings/taxonomy/topic-seo", { method: "PATCH", body: { name: "Search" } }))
        .json.item.name,
    ).toBe("Search");
    expect(c.app.audit("settings.taxonomy.merged")).toHaveLength(1);
  });

  it("home curation: curators write, only live items, ordered", async () => {
    const c = await setup();
    const boss = as(c.app, c.boss);
    const r = await addResource(c);
    const draftRes = await addResource(c, "https://example.com/d", { status: "draft" });
    const p = (
      await boss("/paths", {
        body: { title: "Live path", topic: "ui-ux", level: "beginner", time: "30 min" },
      })
    ).json;
    const cur = as(c.app, c.cur);
    expect(
      (
        await cur("/settings/home-curation", {
          method: "PUT",
          body: {
            featuredPaths: [p.id],
            libraryPicks: [],
            popularRules: { rankBy: "opens", window: "30d", hideReported: true, minLearners: null },
          },
        })
      ).status,
    ).toBe(400);
    const mod = await boss(`/paths/${p.id}`, {
      method: "PATCH",
      body: { modules: [{ title: "M", lessonIds: [] }] },
    });
    const added = await boss(`/paths/${p.id}/lessons`, {
      body: { resourceIds: [r.id], moduleId: mod.json.modules[0].id },
    });
    await boss(`/paths/${p.id}/lessons/${added.json.added[0]}`, {
      method: "PATCH",
      body: { intro: "Why" },
    });
    expect((await boss(`/paths/${p.id}/publish`, { body: {} })).status).toBe(200);
    const pickPaths = await boss("/paths?status=published");
    expect(pickPaths.json.items).toEqual([
      expect.objectContaining({ id: p.id, title: "Live path", level: "beginner" }),
    ]);
    const pickRes = await boss("/resources?status=published");
    expect(pickRes.json.items).toEqual([expect.objectContaining({ id: r.id, kind: "article" })]);
    const body = {
      featuredPaths: [p.id],
      libraryPicks: [r.id],
      popularRules: { rankBy: "saves", window: "7d", hideReported: false, minLearners: 5 },
    };
    const put = await cur("/settings/home-curation", { method: "PUT", body });
    expect(put.status).toBe(200);
    expect(put.json.featuredPaths[0]).toMatchObject({ id: p.id, title: "Live path" });
    expect(put.json.popularRules).toEqual({
      rankBy: "saves",
      window: "7d",
      hideReported: false,
      minLearners: 5,
    });
    expect(
      (
        await cur("/settings/home-curation", {
          method: "PUT",
          body: { ...body, libraryPicks: [draftRes.id] },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await cur("/settings/home-curation", {
          method: "PUT",
          body: { ...body, featuredPaths: [p.id, p.id] },
        })
      ).status,
    ).toBe(400);
    expect((await as(c.app, c.sup)("/settings/home-curation")).status).toBe(403);
    expect(c.app.audit("settings.home_curation.updated")).toHaveLength(1);
  });

  it("edits email templates, validates variables and sends tests only to the admin", async () => {
    const c = await setup();
    const call = as(c.app, c.boss);
    const list = await call("/settings/email-templates");
    expect(list.json.items.map((t: J) => t.key)).toContain("continue-learning");
    const one = await call("/settings/email-templates/continue-learning");
    expect(one.json.preview.subject).toBe("Ada, lesson 10 is waiting");
    const bad = await call("/settings/email-templates/continue-learning", {
      method: "PUT",
      body: { subject: "Hi {{secret}}", body: "x" },
    });
    expect(bad.status).toBe(400);
    expect(bad.json.code).toBe("unknown_variable");
    const put = await call("/settings/email-templates/continue-learning", {
      method: "PUT",
      body: { subject: "{{name}}, keep going", body: "{{path}} awaits." },
    });
    expect(put.json.template).toMatchObject({ customised: true, subject: "{{name}}, keep going" });
    const test = await call("/settings/email-templates/continue-learning/test", {
      body: { to: "attacker@example.com" },
    });
    expect(test.json.sent).toBe(true);
    expect(c.app.last("staff-message")).toMatchObject({
      to: BOSS,
      subject: "[Test] Ada, keep going",
    });
    expect((await call("/settings/email-templates/nope")).status).toBe(404);
    const reset = await call("/settings/email-templates/continue-learning", {
      method: "PUT",
      body: {
        subject:
          one.json.template.subject.replace("keep going", "x") &&
          "{{name}}, lesson {{lesson}} is waiting",
        body: "You’re {{progress}}% of the way through {{path}}. Pick up where you left off whenever you’re ready.",
      },
    });
    expect(reset.json.template.customised).toBe(false);
    expect(
      (await as(c.app, c.cur)("/settings/email-templates/continue-learning/test", { body: {} }))
        .status,
    ).toBe(403);
  });

  it("nudge rules and queue targets: defaults, validation, writes", async () => {
    const c = await setup();
    const call = as(c.app, c.boss);
    expect((await call("/settings/queue-targets")).json).toEqual({
      submissionDays: 3,
      linkReportDays: 3,
      firstReplyDays: 2,
      autoResolveDays: 7,
      workingDays: ["mon", "tue", "wed", "thu", "fri"],
    });
    const targets = {
      submissionDays: 5,
      linkReportDays: 4,
      firstReplyDays: 1,
      autoResolveDays: 7,
      workingDays: ["mon", "tue"],
    };
    expect(
      (
        await call("/settings/queue-targets", {
          method: "PUT",
          body: { ...targets, submissionDays: 0 },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("/settings/queue-targets", {
          method: "PUT",
          body: { ...targets, workingDays: [] },
        })
      ).status,
    ).toBe(400);
    expect((await call("/settings/queue-targets", { method: "PUT", body: targets })).status).toBe(
      200,
    );
    expect((await call("/settings/queue-targets")).json.submissionDays).toBe(5);
    const nudge = await call("/settings/nudge-rules");
    expect(nudge.json).toMatchObject({
      enabled: true,
      firstAfterDays: 3,
      secondAfterDays: 7,
      maxPerWeek: 2,
    });
    expect(nudge.json.wired).toBe(false);
    const rules = { enabled: false, firstAfterDays: 2, secondAfterDays: 5, maxPerWeek: 1 };
    expect(
      (
        await call("/settings/nudge-rules", {
          method: "PUT",
          body: { ...rules, secondAfterDays: 2 },
        })
      ).status,
    ).toBe(400);
    const ok = await call("/settings/nudge-rules", { method: "PUT", body: rules });
    expect(ok.json).toMatchObject(rules);
    expect((await call("/settings/nudge-rules")).json.enabled).toBe(false);
    // The review queue reads the new target.
    expect((await as(c.app, c.cur)("/review/submissions")).json.targetDays).toBe(5);
    expect(c.app.audit("settings.queue_targets.updated")).toHaveLength(1);
  });
});
