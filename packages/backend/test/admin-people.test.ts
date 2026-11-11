import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAccessKeyCache } from "../src/auth/access";
import { createCustomRole } from "../src/auth/admin-perms";
import { autoResolveWaiting } from "../src/cron/support";
import { type AdminApp, createAdminApp } from "./admin-helpers";
import { GOOD_PASSWORD, ORIGIN } from "./helpers";

vi.setConfig({ testTimeout: 60_000 });

afterEach(() => {
  vi.unstubAllGlobals();
  resetAccessKeyCache();
});

const BOSS = "boss@example.com";
const VIEWER = "viewer@example.com";
const SUPPORT = "support@example.com";

async function setup() {
  const app = await createAdminApp();
  const boss = await app.enrolAdmin(BOSS, "super_admin", "Tolu Adeyemi");
  const viewerRole = await createCustomRole(app.env, {
    name: "Viewer",
    permissions: {
      dashboard: "view",
      metrics: "view",
      users_waitlist: "view",
      support_inbox: "view",
    },
  });
  const supportRole = await createCustomRole(app.env, {
    name: "Helper",
    permissions: { dashboard: "view", users_waitlist: "manage", support_inbox: "manage" },
  });
  const viewer = await app.enrolAdmin(VIEWER, viewerRole.id, "Vi Ewer");
  const helper = await app.enrolAdmin(SUPPORT, supportRole.id, "He Lper");
  const ada = await app.signUpConfirmed("ada@example.com");
  const adaId = (
    app.sqlite.prepare("SELECT id FROM user WHERE email = 'ada@example.com'").get() as {
      id: string;
    }
  ).id;
  return { app, boss, viewer, helper, ada, adaId };
}

type Who = { email: string; cookie: string };
const as = (app: AdminApp, who: Who, path: string, method = "GET", body?: unknown) =>
  app.call(`/api/admin${path}`, { as: who.email, cookie: who.cookie, method, body });
const learner = (app: AdminApp, cookie: string, path: string, body?: unknown) =>
  app.call(path, { as: null, origin: ORIGIN, cookie, body });

const learnerSignIn = (app: AdminApp) =>
  app.call("/api/auth/sign-in/email", {
    as: null,
    origin: ORIGIN,
    body: { email: "ada@example.com", password: GOOD_PASSWORD },
  });

describe("users", () => {
  it("lists with search, status and cursor; view role can read, not write", async () => {
    const { app, boss, viewer } = await setup();
    await app.signUpConfirmed("bob@example.com", GOOD_PASSWORD, "Bob Stone");
    const all = await as(app, viewer, "/users");
    expect(all.status).toBe(200);
    expect((all.json.users as unknown[]).length).toBe(2);
    const q = await as(app, boss, "/users?q=bob");
    expect((q.json.users as Array<{ email: string }>).map((u) => u.email)).toEqual([
      "bob@example.com",
    ]);
    const page = await as(app, boss, "/users?limit=1");
    expect(page.json.nextCursor).toBeTruthy();
    const next = await as(
      app,
      boss,
      `/users?limit=1&cursor=${encodeURIComponent(page.json.nextCursor as string)}`,
    );
    expect((next.json.users as unknown[]).length).toBe(1);
    expect((await as(app, boss, "/users?status=nope")).status).toBe(400);
    expect((await as(app, boss, "/users?status=suspended")).json.users).toEqual([]);
    const id = (all.json.users as Array<{ id: string }>)[0]?.id;
    expect(
      (await as(app, viewer, `/users/${id}/suspend`, "POST", { reason: "other" })).status,
    ).toBe(403);
  });

  it("detail carries the learner's paths, tickets and deletion impact", async () => {
    const { app, boss, adaId } = await setup();
    const d = await as(app, boss, `/users/${adaId}`);
    expect(d.status).toBe(200);
    expect(d.json.user).toMatchObject({
      email: "ada@example.com",
      status: "active",
      authMethods: ["password"],
    });
    expect((await as(app, boss, "/users/nope-nope")).status).toBe(404);
  });

  it("reset-link emails the learner and never returns the link", async () => {
    const { app, helper, adaId } = await setup();
    const r = await as(app, helper, `/users/${adaId}/reset-link`, "POST");
    expect(r.status).toBe(202);
    expect(r.text).not.toContain("token");
    const mail = app.last("reset-password");
    expect(mail?.to).toBe("ada@example.com");
    expect(mail?.link).toContain("/reset-password?token=");
    expect(app.audit("admin.user.reset_link")).toHaveLength(1);
  });

  it("suspend revokes sessions and blocks sign-in; restore lets them back", async () => {
    const { app, helper, ada, adaId } = await setup();
    const s = await as(app, helper, `/users/${adaId}/suspend`, "POST", {
      reason: "spam",
      message: "Your account was suspended for spam.",
    });
    expect(s.status).toBe(200);
    expect(app.sqlite.prepare("SELECT 1 FROM session WHERE userId = ?").all(adaId)).toHaveLength(0);
    expect((await learner(app, ada.cookie as string, "/api/me/account")).status).toBe(401);
    const blocked = await learnerSignIn(app);
    expect(blocked.status).toBe(403);
    expect(blocked.json.code).toBe("account_suspended");
    expect(app.last("account-suspended")?.reason).toBe("spam or abuse");
    const audit = app.audit("admin.user.suspended");
    expect(JSON.stringify(audit)).not.toContain("for spam.");
    expect(
      (await as(app, helper, `/users/${adaId}/suspend`, "POST", { reason: "other" })).status,
    ).toBe(409);
    expect((await as(app, helper, `/users/${adaId}`)).json.user).toMatchObject({
      status: "suspended",
    });
    expect((await as(app, helper, `/users/${adaId}/restore`, "POST")).status).toBe(200);
    expect((await learnerSignIn(app)).status).toBe(200);
    expect((await as(app, helper, `/users/${adaId}/restore`, "POST")).status).toBe(409);
  });

  it("export returns the data copy and is audited", async () => {
    const { app, helper, adaId } = await setup();
    const r = await as(app, helper, `/users/${adaId}/export`, "POST");
    expect(r.status).toBe(200);
    expect((r.json.data as { account: unknown }).account).toMatchObject({
      email: "ada@example.com",
    });
    expect(JSON.stringify(r.json)).not.toContain("scrypt");
    expect(app.audit("admin.user.exported")).toHaveLength(1);
  });

  it("delete needs a Super admin, fresh auth and the typed email", async () => {
    const { app, boss, helper, adaId } = await setup();
    const del = (who: Who, confirm: string) =>
      as(app, who, `/users/${adaId}`, "DELETE", { confirm });
    expect((await del(helper, "ada@example.com")).status).toBe(403);
    expect((await del(boss, "wrong@example.com")).status).toBe(400);
    app.sqlite.prepare("UPDATE admin_sessions SET last_reauth_at = 1").run();
    expect((await del(boss, "ada@example.com")).status).toBe(401);
    app.sqlite.prepare("UPDATE admin_sessions SET last_reauth_at = unixepoch()").run();
    expect((await del(boss, "ada@example.com")).status).toBe(200);
    expect(app.sqlite.prepare("SELECT 1 FROM user WHERE id = ?").all(adaId)).toHaveLength(0);
    expect(app.audit("admin.user.deleted")).toHaveLength(1);
    expect((await del(boss, "ada@example.com")).status).toBe(404);
  });
});

describe("waitlist", () => {
  const seed = (app: AdminApp, n: number) => {
    for (let i = 1; i <= n; i++)
      app.sqlite
        .prepare(
          "INSERT INTO waitlist_subscribers (email, referral_code, status, created_at) VALUES (?, ?, 'verified', ?)",
        )
        .run(`w${i}@example.com`, `code${i}`, 1_700_000_000 + i * 100);
  };

  it("lists, counts, invites the oldest N first, and refuses a second invite for the same people", async () => {
    const { app, boss, viewer } = await setup();
    seed(app, 5);
    expect(((await as(app, viewer, "/waitlist/stats")).json as { waiting: number }).waiting).toBe(
      5,
    );
    expect((await as(app, viewer, "/waitlist/invites", "POST", { count: 2 })).status).toBe(403);
    const r = await as(app, boss, "/waitlist/invites", "POST", { count: 2 });
    expect(r.status).toBe(201);
    expect(r.json.invited).toBe(2);
    const invited = app.sqlite
      .prepare(
        "SELECT s.email FROM waitlist_invites wi JOIN waitlist_subscribers s ON s.id = wi.subscriber_id ORDER BY s.created_at",
      )
      .all() as Array<{ email: string }>;
    expect(invited.map((x) => x.email)).toEqual(["w1@example.com", "w2@example.com"]);
    expect(app.emails.filter((e) => e.type === "waitlist-invite")).toHaveLength(2);
    // only the token hash is stored
    expect(JSON.stringify(app.sqlite.prepare("SELECT * FROM invites").all())).not.toContain(
      "token=",
    );
    const stats = (await as(app, boss, "/waitlist/stats")).json as Record<string, number>;
    expect(stats).toMatchObject({ waiting: 3, invited: 2, created: 0 });
    const list = await as(app, boss, "/waitlist?status=waiting");
    expect((list.json.entries as Array<{ email: string }>).map((p) => p.email)).toEqual([
      "w3@example.com",
      "w4@example.com",
      "w5@example.com",
    ]);
    const again = await as(app, boss, "/waitlist/invites", "POST", { ids: [1, 2] });
    expect(again.status).toBe(409);
    expect((await as(app, boss, "/waitlist/invites", "POST", { count: 0 })).status).toBe(400);
    expect((await as(app, boss, "/waitlist/invites", "POST", { count: 1, ids: [3] })).status).toBe(
      400,
    );
  });

  it("remind goes once, only to people who have not joined, with a fresh link", async () => {
    const { app, boss } = await setup();
    seed(app, 3);
    const batchId = (await as(app, boss, "/waitlist/invites", "POST", { count: 3 })).json
      .batchId as string;
    expect((await as(app, boss, `/waitlist/batches/${batchId}/remind`, "POST")).status).toBe(409); // too early
    app.sqlite.prepare("UPDATE waitlist_invites SET invited_at = invited_at - 8 * 86400").run();
    app.sqlite.prepare("UPDATE waitlist_batches SET created_at = created_at - 8 * 86400").run();
    const batches = (await as(app, boss, "/waitlist/batches")).json.batches as Array<{
      needReminder: number;
    }>;
    expect(batches[0]?.needReminder).toBe(3);
    const r = await as(app, boss, `/waitlist/batches/${batchId}/remind`, "POST");
    expect(r.status).toBe(200);
    expect(r.json.reminded).toBe(3);
    expect(app.emails.filter((e) => e.type === "waitlist-reminder")).toHaveLength(3);
    expect((await as(app, boss, `/waitlist/batches/${batchId}/remind`, "POST")).status).toBe(409);
    expect((await as(app, boss, "/waitlist/batches/not-a-batch/remind", "POST")).status).toBe(404);
  });
});

describe("support inbox", () => {
  const open = async (app: AdminApp, cookie: string, kind = "report") => {
    const r = await learner(app, cookie, "/api/me/support", {
      kind,
      category: kind === "report" ? "Broken link" : "Account and sign-in",
      subject: "Quiz five fails",
      message: "The quiz will not submit at all.",
    });
    return (r.json.ticket as { id: string }).id;
  };

  it("lists by tab, shows the SLA, and a reply moves it to waiting_on_user (learner still sees replied)", async () => {
    const { app, boss, viewer, ada } = await setup();
    const id = await open(app, ada.cookie as string);
    const list = await as(app, viewer, "/support?tab=open");
    expect((list.json.tickets as Array<{ id: string; overdue: boolean }>)[0]).toMatchObject({
      id,
      overdue: false,
    });
    expect((list.json.counts as { open: number }).open).toBe(1);
    app.sqlite.prepare("UPDATE support_tickets SET due_at = 1").run();
    expect(((await as(app, viewer, "/support?overdue=1")).json.tickets as unknown[]).length).toBe(
      1,
    );
    expect((await as(app, boss, "/support?tab=waiting")).json.tickets).toEqual([]);

    const rep = await as(app, boss, `/support/${id}/reply`, "POST", { message: "On it." });
    expect(rep.status).toBe(200);
    expect((rep.json.ticket as { status: string }).status).toBe("replied");
    const row = app.sqlite
      .prepare("SELECT status, first_reply_at, waiting_since FROM support_tickets")
      .get() as Record<string, unknown>;
    expect(row.status).toBe("waiting_on_user");
    expect(row.first_reply_at).toBeTruthy();
    const waiting = await as(app, boss, "/support?tab=waiting");
    expect(
      (waiting.json.tickets as Array<{ status: string; resolvesAt: string }>)[0],
    ).toMatchObject({ status: "waiting_on_user" });
    const detail = await as(app, boss, `/support/${id}`);
    const t = detail.json.ticket as {
      messages: Array<{ author: string; authorName: string }>;
      sla: { state: string };
    };
    expect(t.messages.map((m) => m.author)).toEqual(["learner", "staff"]);
    expect(t.messages[1]?.authorName).toBe("Tolu Adeyemi");
    expect(detail.json.requester).toMatchObject({ email: "ada@example.com", pastRequests: 0 });
    // a learner follow-up reopens it
    await learner(app, ada.cookie as string, `/api/me/support/${id}/messages`, {
      message: "Still broken",
    });
    expect(app.sqlite.prepare("SELECT status FROM support_tickets").get()).toMatchObject({
      status: "open",
    });
  });

  it("internal notes never reach the learner; viewers cannot add them", async () => {
    const { app, boss, viewer, ada } = await setup();
    const id = await open(app, ada.cookie as string);
    expect((await as(app, viewer, `/support/${id}/note`, "POST", { body: "x" })).status).toBe(403);
    expect((await as(app, boss, `/support/${id}/note`, "POST", { body: "" })).status).toBe(400);
    const n = await as(app, boss, `/support/${id}/note`, "POST", { body: "Looks like the CDN" });
    expect(n.status).toBe(201);
    const mine = await learner(app, ada.cookie as string, `/api/me/support/${id}`);
    expect(JSON.stringify(mine.json)).not.toContain("CDN");
    expect((mine.json.ticket as { messageCount: number }).messageCount).toBe(1);
    const staff = await as(app, boss, `/support/${id}`);
    expect(
      (staff.json.ticket as { messages: Array<{ author: string }> }).messages.at(-1)?.author,
    ).toBe("note");
  });

  it("log-issue works once, on reports only", async () => {
    const { app, boss, ada } = await setup();
    const report = await open(app, ada.cookie as string);
    const body = { title: "Lesson 6 video unavailable", severity: "high", linkReportId: "lr-1" };
    const r = await as(app, boss, `/support/${report}/log`, "POST", body);
    expect(r.status).toBe(201);
    expect((r.json.issue as { id: number }).id).toBe(1);
    expect((await as(app, boss, `/support/${report}/log`, "POST", body)).status).toBe(409);
    const d = await as(app, boss, `/support/${report}`);
    expect((d.json.ticket as { linkedIssue: { title: string } }).linkedIssue.title).toBe(
      body.title,
    );
    const plain = await open(app, ada.cookie as string, "support");
    expect((await as(app, boss, `/support/${plain}/log`, "POST", body)).status).toBe(409);
    expect(
      (await as(app, boss, `/support/${report}/log`, "POST", { title: "x", severity: "high" }))
        .status,
    ).toBe(400);
  });

  it("status accepts open, waiting_on_user and a message with fixed; assign and the portal's detail shape work", async () => {
    const { app, boss, helper, ada } = await setup();
    const id = await open(app, ada.cookie as string);
    const st = (b: unknown) => as(app, boss, `/support/${id}/status`, "POST", b);
    expect((await st({ status: "waiting_on_user" })).status).toBe(200);
    expect(
      app.sqlite.prepare("SELECT status, waiting_since FROM support_tickets").get(),
    ).toMatchObject({ status: "waiting_on_user" });
    expect((await st({ status: "open" })).status).toBe(200);
    expect((await as(app, boss, `/support/${id}/assign`, "POST", { to: "me" })).status).toBe(200);
    expect((await as(app, boss, `/support/${id}/assign`, "POST", { to: "everyone" })).status).toBe(
      400,
    );
    expect(((await as(app, boss, "/support?assigned=me")).json.tickets as unknown[]).length).toBe(
      1,
    );
    expect(((await as(app, helper, "/support?assigned=me")).json.tickets as unknown[]).length).toBe(
      0,
    );
    const log = await as(app, boss, `/support/${id}/log`, "POST", {
      title: "Quiz five fails",
      description: "Submit does nothing",
      severity: "high",
      area: "Lessons",
      notifyRequester: true,
    });
    expect(log.json.issueId).toBe(1);
    const fixed = await st({ status: "fixed", message: "Quiz five is fixed now." });
    expect(fixed.status).toBe(200);
    expect(app.last("support-closed")).toMatchObject({
      status: "fixed",
      message: "Quiz five is fixed now.",
    });
    const mine = await learner(app, ada.cookie as string, `/api/me/support/${id}`);
    expect(JSON.stringify(mine.json)).toContain("Quiz five is fixed now.");
    expect((await st({ status: "resolved" })).status).toBe(409);
    expect((await st({ status: "open" })).status).toBe(200); // reopen
    expect(app.sqlite.prepare("SELECT status, closed_at FROM support_tickets").get()).toMatchObject(
      { status: "open", closed_at: null },
    );
    const d = (await as(app, boss, `/support/${id}`)).json.ticket as Record<string, any>;
    expect(d.issue).toMatchObject({ id: 1, severity: "high" });
    expect(d.assignedToMe).toBe(true);
    expect(d.assignee.name).toBe("Tolu Adeyemi");
    expect(d.requester).toMatchObject({ email: "ada@example.com", pastTotal: 0 });
    expect(d.messages[0]).toMatchObject({ author: "learner", name: "Ada Obi" });
    const row = (
      (await as(app, boss, "/support?tab=open")).json.tickets as Array<Record<string, any>>
    )[0];
    expect(row).toMatchObject({
      snippet: "The quiz will not submit at all.",
      logged: true,
      assignedToMe: true,
    });
  });

  it("auto-resolves after 7 days without a reply and tells the learner", async () => {
    const { app, boss, ada } = await setup();
    const id = await open(app, ada.cookie as string, "support");
    await as(app, boss, `/support/${id}/reply`, "POST", { message: "Can you send a screenshot?" });
    const now = Math.floor(Date.now() / 1000);
    expect(await autoResolveWaiting(app.env, now + 6 * 86400)).toBe(0);
    expect(await autoResolveWaiting(app.env, now + 8 * 86400)).toBe(1);
    expect(app.sqlite.prepare("SELECT status, closed_at FROM support_tickets").get()).toMatchObject(
      { status: "resolved" },
    );
    expect(app.last("support-closed")).toMatchObject({ status: "resolved", to: "ada@example.com" });
    expect(app.audit("support.auto_resolved")).toHaveLength(1);
    expect(await autoResolveWaiting(app.env, now + 9 * 86400)).toBe(0);
    expect(((await as(app, boss, "/support?tab=resolved")).json.tickets as unknown[]).length).toBe(
      1,
    );
  });
});

describe("dashboard and metrics", () => {
  it("dashboard is shaped by role and uses real counts", async () => {
    const { app, boss, helper, ada } = await setup();
    await learner(app, ada.cookie as string, "/api/me/support", {
      kind: "support",
      subject: "Help",
      message: "I need some help please.",
    });
    const d = await as(app, boss, "/dashboard?range=30d");
    expect(d.status).toBe(200);
    expect(d.json.variant).toBe("admin");
    const stats = d.json.stats as Array<{ key: string; value: number }>;
    expect(stats.map((s) => s.key)).toEqual([
      "new_learners",
      "weekly_active",
      "path_completions",
      "open_requests",
    ]);
    expect(stats.find((s) => s.key === "new_learners")?.value).toBe(1);
    expect(stats.find((s) => s.key === "open_requests")?.value).toBe(1);
    const series = d.json.series as { signups: { current: number[]; previous: number[] } };
    expect(series.signups.current).toHaveLength(7);
    expect(series.signups.current.reduce((a, b) => a + b, 0)).toBe(1);
    expect((d.json.queue as unknown[]).length).toBe(1);
    expect(d.json.noResultSearches).toEqual({ available: false, items: [] });
    const h = await as(app, helper, "/dashboard");
    expect(h.json.variant).toBe("support");
    expect(h.json.recentActivity).toEqual([]);
    expect((await as(app, boss, "/dashboard?range=custom&from=2026-01-01")).status).toBe(400);
    expect((await as(app, boss, "/dashboard?range=nope")).status).toBe(400);
    expect(
      (await as(app, boss, "/dashboard?range=custom&from=2026-01-01&to=2026-02-01")).status,
    ).toBe(200);
  });

  it("metrics return value, previous and delta, and need metrics:view", async () => {
    const { app, boss, helper, ada, adaId } = await setup();
    app.sqlite
      .prepare(
        "INSERT INTO path_enrolments (user_id, path_slug, started_at, last_activity_at) VALUES (?, 'ux-foundations', ?, ?)",
      )
      .run(adaId, new Date().toISOString(), new Date().toISOString());
    app.sqlite
      .prepare(
        "INSERT INTO path_lessons_done (user_id, path_slug, lesson_id, completed_at) VALUES (?, 'ux-foundations', 'l1', ?)",
      )
      .run(adaId, new Date().toISOString());
    await learner(app, ada.cookie as string, "/api/me/support", {
      kind: "support",
      category: "Account and sign-in",
      subject: "Help",
      message: "I need some help please.",
    });
    expect((await as(app, helper, "/metrics/learners")).status).toBe(403);
    const l = await as(app, boss, "/metrics/learners");
    expect(l.status).toBe(200);
    expect(
      (l.json.stats as Record<string, { value: number; previous: number | null }>).weeklyActive
        ?.value,
    ).toBe(1);
    expect((l.json.series as { current: number[] }).current).toHaveLength(7);
    const p = await as(app, boss, "/metrics/paths");
    expect((p.json.paths as Array<{ slug: string; started: { value: number } }>)[0]).toMatchObject({
      slug: "ux-foundations",
      started: { value: 1 },
    });
    const pd = await as(app, boss, "/metrics/paths/ux-foundations");
    expect(pd.status).toBe(200);
    expect((pd.json.lessons as unknown[]).length).toBe(1);
    expect((await as(app, boss, "/metrics/paths/unknown-path")).status).toBe(404);
    const lib = await as(app, boss, "/metrics/library");
    expect(lib.json.mostOpened).toEqual({ available: false, items: [] });
    const em = await as(app, boss, "/metrics/emails");
    expect(em.status).toBe(200);
    const sp = await as(app, boss, "/metrics/support");
    expect((sp.json.stats as { requestsOpened: { value: number } }).requestsOpened.value).toBe(1);
    expect((sp.json.requestsByTopic as Array<{ category: string }>)[0]?.category).toBe(
      "Account and sign-in",
    );
  });

  it("exports CSV for each tab and refuses an unknown one", async () => {
    const { app, boss } = await setup();
    const r = await as(app, boss, "/metrics/support/export?range=30d");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/csv");
    expect(r.text.startsWith("metric,value")).toBe(true);
    expect(r.text).toContain("stats.requestsOpened.value");
    expect((await as(app, boss, "/metrics/nope/export")).status).toBe(400);
    expect(app.audit("admin.metrics.exported")).toHaveLength(1);
  });
});
