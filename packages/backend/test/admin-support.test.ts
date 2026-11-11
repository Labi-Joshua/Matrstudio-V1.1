import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAccessKeyCache } from "../src/auth/access";
import { createCustomRole } from "../src/auth/admin-perms";
import { type AdminApp, createAdminApp } from "./admin-helpers";
import { ORIGIN } from "./helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  resetAccessKeyCache();
});

const BOSS = "boss@example.com";

async function setup() {
  const app = await createAdminApp();
  const boss = await app.enrolAdmin(BOSS, "super_admin", "Tolu Adeyemi");
  const ada = (await app.signUpConfirmed("ada@example.com")).cookie as string;
  const bob = (await app.signUpConfirmed("bob@example.com")).cookie as string;
  return { app, boss, ada, bob };
}

// Learner calls go through the same worker, without an Access token and from the web origin.
const learner = (app: AdminApp, cookie: string, path: string, body?: unknown) =>
  app.call(path, { as: null, origin: ORIGIN, cookie, body });
const open = async (app: AdminApp, cookie: string, kind = "report") => {
  const r = await learner(app, cookie, "/api/me/support", {
    kind,
    subject: "Quiz five fails",
    message: "The quiz will not submit at all.",
  });
  return (r.json.ticket as { id: string }).id;
};
type Boss = { cookie: string };
const reply = (app: AdminApp, boss: Boss, id: string, body: unknown = { message: "On it." }) =>
  app.call(`/api/admin/support/${id}/reply`, { as: BOSS, cookie: boss.cookie, body });
const status = (app: AdminApp, boss: Boss, id: string, st: unknown) =>
  app.call(`/api/admin/support/${id}/status`, {
    as: BOSS,
    cookie: boss.cookie,
    body: { status: st },
  });
const notes = (app: AdminApp) =>
  app.sqlite.prepare("SELECT kind, title, body, href, user_id FROM notifications").all() as Array<{
    kind: string;
    title: string;
    body: string;
    href: string;
    user_id: string;
  }>;
const count = async (app: AdminApp, cookie: string) =>
  ((await learner(app, cookie, "/api/me/notifications")).json.notifications as unknown[]).length;

describe("POST /api/admin/support/:id/reply", () => {
  it("adds the staff message, sets replied, notifies, emails and audits", async () => {
    const { app, boss, ada } = await setup();
    const id = await open(app, ada);
    const r = await reply(app, boss, id);
    expect(r.status).toBe(200);
    const t = r.json.ticket as {
      status: string;
      messageCount: number;
      messages: Array<{ author: string; body: string }>;
    };
    expect(t.status).toBe("replied");
    expect(t.messageCount).toBe(2);
    expect(t.messages[1]).toMatchObject({ author: "support", body: "On it." });
    expect(notes(app)[0]).toMatchObject({
      kind: "support-reply",
      body: "On it.",
      href: `/learn/help?ticket=${id}`,
    });
    expect(await count(app, ada)).toBe(1);
    expect(app.last("support-reply")).toMatchObject({
      to: "ada@example.com",
      subject: "Quiz five fails",
    });
    const audit = app.audit("support.replied");
    expect(audit.length).toBe(1);
    expect(audit[0]?.target).toBe(id);
    expect(audit[0]?.actor).toBe(boss.adminId);
    expect(String(audit[0]?.meta)).not.toContain("On it");
    // The learner can then follow up, which reopens it.
    const f = await learner(app, ada, `/api/me/support/${id}/messages`, { message: "Thanks!" });
    expect((f.json.ticket as { status: string }).status).toBe("open");
  });

  it("validates, 404s unknown tickets and 409s closed ones", async () => {
    const { app, boss, ada } = await setup();
    const id = await open(app, ada);
    const bad = [{}, { message: "" }, { message: "x".repeat(2001) }, { message: "a", x: 1 }, null];
    for (const body of bad) {
      const r = await reply(app, boss, id, body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.json.code).toBe("invalid_request");
    }
    expect((await reply(app, boss, "no-such-ticket")).status).toBe(404);
    expect((await reply(app, boss, "Bad_Id")).status).toBe(400);
    await status(app, boss, id, "resolved");
    const closed = await reply(app, boss, id);
    expect(closed.status).toBe(409);
    expect(closed.json.code).toBe("ticket_closed");
  });
});

describe("POST /api/admin/support/:id/status", () => {
  it("fixed on a report: status, report-fixed notification, email and audit", async () => {
    const { app, boss, ada } = await setup();
    const id = await open(app, ada);
    const r = await status(app, boss, id, "fixed");
    expect(r.status).toBe(200);
    expect((r.json.ticket as { status: string }).status).toBe("fixed");
    expect(notes(app)[0]).toMatchObject({
      kind: "report-fixed",
      body: "Quiz five fails",
      href: `/learn/help?ticket=${id}`,
    });
    expect(app.last("support-closed")).toMatchObject({ to: "ada@example.com", status: "fixed" });
    expect(app.audit("support.status_changed")[0]).toMatchObject({
      target: id,
      actor: boss.adminId,
    });
    const f = await learner(app, ada, `/api/me/support/${id}/messages`, { message: "More." });
    expect(f.status).toBe(409);
    expect(f.json.code).toBe("ticket_closed");
  });

  it("cant_reproduce on a report, resolved on a support ticket", async () => {
    const { app, boss, ada } = await setup();
    const rep = await open(app, ada, "report");
    const sup = await open(app, ada, "support");
    expect((await status(app, boss, rep, "cant_reproduce")).status).toBe(200);
    expect((await status(app, boss, sup, "resolved")).status).toBe(200);
    expect(notes(app).map((n) => n.kind)).toEqual(["report-cant-reproduce", "support-reply"]);
  });

  it("rejects fixed and cant_reproduce for a support ticket, bad statuses, and closed tickets", async () => {
    const { app, boss, ada } = await setup();
    const sup = await open(app, ada, "support");
    for (const st of ["fixed", "cant_reproduce", "open", "replied", "nope", undefined]) {
      const r = await status(app, boss, sup, st);
      expect(r.status, String(st)).toBe(400);
      expect(r.json.code).toBe("invalid_request");
    }
    expect(notes(app).length).toBe(0);
    await status(app, boss, sup, "resolved");
    const again = await status(app, boss, sup, "resolved");
    expect(again.status).toBe(409);
    expect(again.json.code).toBe("ticket_closed");
    expect(notes(app).length).toBe(1);
    expect((await status(app, boss, "missing", "resolved")).status).toBe(404);
  });

  it("notifies the ticket's owner only", async () => {
    const { app, boss, ada, bob } = await setup();
    const id = await open(app, ada);
    await status(app, boss, id, "fixed");
    expect(await count(app, bob)).toBe(0);
    expect(await count(app, ada)).toBe(1);
  });
});

describe("admin access", () => {
  it("403 without Access, 401 without an admin session, 403 below manage, 200 at manage", async () => {
    const { app, boss, ada } = await setup();
    const id = await open(app, ada);
    const url = `/api/admin/support/${id}/reply`;
    const body = { message: "Hi there." };
    expect((await app.call(url, { as: null, body })).status).toBe(403);
    expect((await app.call(url, { as: BOSS, body })).status).toBe(401);
    // A learner session is not an admin session.
    expect((await app.call(url, { as: BOSS, cookie: ada, body })).status).toBe(401);
    // A stolen admin cookie under a different Access identity.
    const other = await app.call(url, { as: "other@example.com", cookie: boss.cookie, body });
    expect(other.status).toBe(401);

    const mk = (name: string, permissions: Record<string, "view" | "manage">) =>
      createCustomRole(app.env, { name, permissions });
    const viewer = await mk("Reader", { support_inbox: "view", dashboard: "manage" });
    const nothing = await mk("Nothing", { dashboard: "view" });
    const agent = await mk("Agent", { support_inbox: "manage" });
    for (const [email, roleId, expected] of [
      ["viewer@example.com", viewer.id, 403],
      ["none@example.com", nothing.id, 403],
      ["agent@example.com", agent.id, 200],
    ] as const) {
      const a = await app.enrolAdmin(email, roleId);
      for (const p of ["reply", "status"]) {
        const target = await open(app, ada);
        const r = await app.call(`/api/admin/support/${target}/${p}`, {
          as: email,
          cookie: a.cookie,
          body: p === "reply" ? body : { status: "resolved" },
        });
        expect(r.status, `${email} ${p}`).toBe(expected);
        if (expected === 403) expect(r.json.code).toBe("forbidden");
      }
    }
  });

  it("503 without a good auth secret", async () => {
    const bare = await createAdminApp({ BETTER_AUTH_SECRET: "short" });
    const r = await bare.call("/api/admin/support/abc/reply", {
      as: BOSS,
      body: { message: "Hi there." },
    });
    expect(r.status).toBe(503);
    expect(r.json.code).toBe("auth_unavailable");
  });

  it("refuses the learner origin on admin routes", async () => {
    const { app, boss, ada } = await setup();
    const id = await open(app, ada);
    const r = await app.call(`/api/admin/support/${id}/reply`, {
      as: BOSS,
      cookie: boss.cookie,
      origin: ORIGIN,
      body: { message: "Hi there." },
    });
    expect(r.status).toBe(403);
  });
});
