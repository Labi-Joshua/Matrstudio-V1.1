import { ADMIN_AREAS } from "@matr/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAccessKeyCache } from "../src/auth/access";
import { createCustomRole } from "../src/auth/admin-perms";
import { runAdminAccessTick } from "../src/cron/admin-access";
import { createAdminNotification } from "../src/notifications/admin";
import { type AdminApp, codeNow, createAdminApp } from "./admin-helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  resetAccessKeyCache();
});

const BOSS = "boss@example.com";
const VIEWER = "viewer@example.com";
const PLAIN = "plain@example.com";
const STAFF = "staff@example.com";

type Admin = Awaited<ReturnType<AdminApp["enrolAdmin"]>>;
const rows = <T = Record<string, unknown>>(app: AdminApp, sql: string, ...args: unknown[]) =>
  app.sqlite.prepare(sql).all(...(args as never[])) as T[];
const run = (app: AdminApp, sql: string, ...args: unknown[]) =>
  app.sqlite.prepare(sql).run(...(args as never[]));

async function setup() {
  const app = await createAdminApp();
  const boss = await app.enrolAdmin(BOSS, "super_admin", "Tolu Adeyemi");
  // View on the admin areas, and the review queue: can read everything but write nothing.
  const viewerRole = await createCustomRole(app.env, {
    name: "Auditor",
    permissions: {
      dashboard: "view",
      admin_team: "view",
      roles: "view",
      audit_log: "view",
      review_queues: "view",
      users_waitlist: "view",
    },
  });
  const plainRole = await createCustomRole(app.env, {
    name: "Plain",
    permissions: { dashboard: "view" },
  });
  const viewer = await app.enrolAdmin(VIEWER, viewerRole.id, "Vi Ewer");
  const plain = await app.enrolAdmin(PLAIN, plainRole.id, "Plain Person");
  const staff = await app.enrolAdmin(STAFF, "support", "Seyi Ade");
  return { app, boss, viewer, plain, staff, viewerRole, plainRole };
}

const as = (email: string, a: Admin) => ({ as: email, cookie: a.cookie });
const get = (app: AdminApp, path: string, email: string, a: Admin) => app.call(path, as(email, a));
const send = (
  app: AdminApp,
  method: string,
  path: string,
  email: string,
  a: Admin,
  body?: unknown,
) => app.call(path, { method, body, ...as(email, a) });

describe("admin team", () => {
  it("lists members with 2-step state and session counts, and pending invites apart", async () => {
    const { app, boss, staff } = await setup();
    const inv = await send(app, "POST", "/api/admin/team/invite", BOSS, boss, {
      email: "new@example.com",
      roleId: "curator",
    });
    expect(inv.status).toBe(201);
    const res = await get(app, "/api/admin/team", BOSS, boss);
    expect(res.status).toBe(200);
    const members = res.json.members as Array<Record<string, unknown>>;
    expect(members.map((m) => m.email)).toEqual([BOSS, VIEWER, PLAIN, STAFF]);
    expect(members[0]).toMatchObject({
      isYou: true,
      mfaEnrolled: true,
      sessions: 1,
      roleId: "super_admin",
      status: "active",
      accessExpiresAt: null,
    });
    expect(members[3]).toMatchObject({ roleName: "Support", isYou: false });
    expect(typeof members[3]?.lastSignIn).toBe("string");
    expect(JSON.stringify(res.json)).not.toMatch(/password|totp|token_hash/i);
    const pending = res.json.pendingInvites as Array<Record<string, unknown>>;
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      email: "new@example.com",
      roleName: "Curator",
      expired: false,
      invitedBy: { name: "Tolu Adeyemi" },
    });
    expect(res.json.onlySuperAdmin).toBe(true);
    expect(staff.adminId).toBeTruthy();
  });

  it("a view role reads the team but every write is refused; no area, no read", async () => {
    const { app, boss, viewer, plain, staff } = await setup();
    expect((await get(app, "/api/admin/team", VIEWER, viewer)).status).toBe(200);
    expect((await get(app, `/api/admin/team/${staff.adminId}`, VIEWER, viewer)).status).toBe(200);
    expect((await get(app, "/api/admin/team", PLAIN, plain)).status).toBe(403);
    expect((await get(app, `/api/admin/team/${boss.adminId}`, PLAIN, plain)).status).toBe(403);
    const writes: Array<[string, string, unknown?]> = [
      ["PUT", `/api/admin/team/${staff.adminId}/roles`, { roleIds: ["curator"] }],
      ["POST", `/api/admin/team/${staff.adminId}/temporary-access`, { until: null }],
      ["POST", `/api/admin/team/${staff.adminId}/suspend`, {}],
      ["POST", `/api/admin/team/${staff.adminId}/restore`],
      ["POST", `/api/admin/team/${staff.adminId}/sign-out-everywhere`],
      ["POST", `/api/admin/team/${staff.adminId}/unlock`],
      ["POST", "/api/admin/team/invites/abc/cancel"],
      ["POST", "/api/admin/team/invites/abc/resend"],
    ];
    for (const [method, path, body] of writes) {
      const res = await send(app, method, path, VIEWER, viewer, body);
      expect(res.status, `${method} ${path}`).toBe(403);
    }
    // Nothing changed, and without a session nothing answers at all.
    expect(
      rows(app, "SELECT status, role_id FROM admin_users WHERE id = ?", staff.adminId),
    ).toEqual([{ status: "active", role_id: "support" }]);
    expect((await app.call("/api/admin/team", { as: BOSS })).status).toBe(401);
  });

  it("member detail carries who invited them, devices and the founding flag", async () => {
    const { app, boss, staff } = await setup();
    const res = await get(app, `/api/admin/team/${boss.adminId}`, BOSS, boss);
    const m = res.json.member as Record<string, unknown>;
    expect(m).toMatchObject({ id: boss.adminId, foundingSuperAdmin: true, isYou: true });
    const sessions = m.sessions as Array<Record<string, unknown>>;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ device: "Chrome on macOS", current: true });
    const other = (await get(app, `/api/admin/team/${staff.adminId}`, BOSS, boss)).json
      .member as Record<string, unknown>;
    expect(other.foundingSuperAdmin).toBe(false);
    expect((other.sessions as unknown[])[0]).toMatchObject({ current: false });
    expect((await get(app, "/api/admin/team/nope", BOSS, boss)).status).toBe(404);
    expect((await get(app, `/api/admin/team/${"x".repeat(80)}`, BOSS, boss)).status).toBe(404);
  });

  it("changing a role signs the person out, is audited with before/after and needs a fresh step-up", async () => {
    const { app, boss, staff } = await setup();
    const path = `/api/admin/team/${staff.adminId}/roles`;
    expect(
      (await send(app, "PUT", path, BOSS, boss, { roleIds: ["curator", "support"] })).status,
    ).toBe(400);
    expect((await send(app, "PUT", path, BOSS, boss, { roleIds: ["ghost"] })).status).toBe(404);
    const ok = await send(app, "PUT", path, BOSS, boss, { roleIds: ["curator"] });
    expect(ok.status).toBe(200);
    expect(ok.json.member).toMatchObject({ roleId: "curator", roleName: "Curator" });
    expect((await get(app, "/api/admin/me", STAFF, staff)).status).toBe(401);
    const [entry] = app.audit("admin.role.assigned");
    expect(entry).toMatchObject({ actor: boss.adminId, target: staff.adminId });
    expect(JSON.parse(entry?.meta as string)).toMatchObject({
      before: "support",
      after: "curator",
      confirmed: "password_2step",
    });
    // stale step-up
    run(
      app,
      "UPDATE admin_sessions SET last_reauth_at = unixepoch() - 400 WHERE admin_id = ?",
      boss.adminId,
    );
    const stale = await send(app, "PUT", path, BOSS, boss, { roleIds: ["support"] });
    expect(stale.status).toBe(401);
    expect(stale.json.code).toBe("reauth_required");
  });

  it("making someone a Super admin needs the acting admin's 2-step code; you cannot change yourself", async () => {
    const { app, boss, staff } = await setup();
    const path = `/api/admin/team/${staff.adminId}/roles`;
    const body = { roleIds: ["super_admin"] };
    const none = await send(app, "PUT", path, BOSS, boss, body);
    expect(none.status).toBe(400);
    expect(none.json.code).toBe("two_step_required");
    const wrong = await send(app, "PUT", path, BOSS, boss, { ...body, twoStepCode: "000000" });
    expect(wrong.status).toBe(401);
    expect(wrong.json.code).toBe("invalid_code");
    expect(rows(app, "SELECT role_id FROM admin_users WHERE id = ?", staff.adminId)).toEqual([
      { role_id: "support" },
    ]);
    run(app, "UPDATE admin_users SET totp_last_step = 0 WHERE id = ?", boss.adminId);
    const ok = await send(app, "PUT", path, BOSS, boss, {
      ...body,
      twoStepCode: codeNow(boss.secret),
    });
    expect(ok.status).toBe(200);
    expect(ok.json.member).toMatchObject({ roleId: "super_admin" });
    const me = await send(app, "PUT", `/api/admin/team/${boss.adminId}/roles`, BOSS, boss, {
      roleIds: ["support"],
    });
    expect(me.status).toBe(400);
    expect(me.json.code).toBe("cannot_change_self");
  });

  it("suspend blocks sign-in and ends sessions; restore brings them back; never yourself", async () => {
    const { app, boss, staff } = await setup();
    const base = `/api/admin/team/${staff.adminId}`;
    const s = await send(app, "POST", `${base}/suspend`, BOSS, boss, {
      reason: "Left the company",
    });
    expect(s.status).toBe(200);
    expect(s.json.member).toMatchObject({ status: "suspended" });
    expect((await get(app, "/api/admin/me", STAFF, staff)).status).toBe(401);
    expect((await app.signIn(staff)).step1.status).toBe(401);
    expect((await send(app, "POST", `${base}/suspend`, BOSS, boss, {})).status).toBe(409);
    const [entry] = app.audit("admin.suspended");
    expect(JSON.parse(entry?.meta as string)).toMatchObject({ reason: "Left the company" });
    const back = await send(app, "POST", `${base}/restore`, BOSS, boss);
    expect(back.status).toBe(200);
    expect(back.json.member).toMatchObject({ status: "active" });
    expect((await app.signIn(staff)).step2?.status).toBe(200);
    expect((await send(app, "POST", `${base}/restore`, BOSS, boss)).status).toBe(409);
    const self = await send(app, "POST", `/api/admin/team/${boss.adminId}/suspend`, BOSS, boss, {});
    expect(self.status).toBe(400);
    expect(app.audit("admin.restored")).toHaveLength(1);
  });

  it("temporary access: enforced at the session, at sign-in and by the cron; clearable", async () => {
    const { app, boss, staff } = await setup();
    const base = `/api/admin/team/${staff.adminId}/temporary-access`;
    const past = await send(app, "POST", base, BOSS, boss, { until: "2020-01-01" });
    expect(past.status).toBe(400);
    expect(past.json.code).toBe("invalid_until");
    expect((await send(app, "POST", base, BOSS, boss, { until: "2099-01-01" })).status).toBe(400);
    const soon = new Date(Date.now() + 2 * 86400_000).toISOString();
    const set = await send(app, "POST", base, BOSS, boss, { until: soon });
    expect(set.status).toBe(200);
    expect(set.json.member).toMatchObject({
      accessExpiresAt: `${soon.slice(0, 19)}.000Z`,
      accessExpired: false,
    });
    const me = await get(app, "/api/admin/me", STAFF, staff);
    expect(me.status).toBe(200);
    expect(me.json.accessExpiresAt).toBe(Math.floor(Date.parse(soon) / 1000));

    // three days out: one reminder for people who manage the team, once.
    expect(await runAdminAccessTick(app.env)).toEqual({ reminded: 1, expired: 0 });
    expect(await runAdminAccessTick(app.env)).toEqual({ reminded: 0, expired: 0 });
    const bell = await get(app, "/api/admin/notifications", BOSS, boss);
    expect((bell.json.notifications as Array<{ kind: string }>)[0]?.kind).toBe("access-ending");
    const plainBell = await get(app, "/api/admin/notifications", STAFF, staff);
    expect(plainBell.json.notifications).toEqual([]);

    // the end date passes: the same cookie stops working at once, before any cron runs
    run(
      app,
      "UPDATE admin_users SET access_expires_at = unixepoch() - 5 WHERE id = ?",
      staff.adminId,
    );
    expect((await get(app, "/api/admin/me", STAFF, staff)).status).toBe(401);
    expect(
      rows(app, "SELECT id FROM admin_sessions WHERE admin_id = ?", staff.adminId),
    ).toHaveLength(0);
    expect((await app.signIn(staff)).step1.status).toBe(401);
    expect(await runAdminAccessTick(app.env)).toEqual({ reminded: 0, expired: 1 });
    expect(app.audit("admin.access.expired")).toHaveLength(1);
    const list = await get(app, "/api/admin/team", BOSS, boss);
    const row = (list.json.members as Array<Record<string, unknown>>).find(
      (m) => m.id === staff.adminId,
    );
    expect(row).toMatchObject({ accessExpired: true });

    // permanent again
    const clear = await send(app, "POST", base, BOSS, boss, { until: null });
    expect(clear.status).toBe(200);
    expect(clear.json.member).toMatchObject({ accessExpiresAt: null, accessExpired: false });
    expect((await app.signIn(staff)).step2?.status).toBe(200);
    const [audited] = app.audit("admin.access.temporary");
    expect(JSON.parse(audited?.meta as string)).toMatchObject({ confirmed: "password_2step" });
  });

  it("sign out everywhere and unlock", async () => {
    const { app, boss, staff } = await setup();
    const out = await send(
      app,
      "POST",
      `/api/admin/team/${staff.adminId}/sign-out-everywhere`,
      BOSS,
      boss,
    );
    expect(out.status).toBe(200);
    expect(out.json.signedOut).toBe(1);
    expect((await get(app, "/api/admin/me", STAFF, staff)).status).toBe(401);
    expect(
      (await send(app, "POST", `/api/admin/team/${boss.adminId}/sign-out-everywhere`, BOSS, boss))
        .status,
    ).toBe(400);
    // lock them with wrong passwords, then unlock
    for (let i = 0; i < 5; i++) await app.signIn(staff, "wrong password wrong password");
    expect((await app.signIn(staff)).step1.status).toBe(429);
    const un = await send(app, "POST", `/api/admin/team/${staff.adminId}/unlock`, BOSS, boss);
    expect(un.status).toBe(200);
    expect((await app.signIn(staff)).step2?.status).toBe(200);
    expect(app.audit("admin.unlocked")).toHaveLength(1);
  });

  it("pending invites can be cancelled and resent; removing an admin cancels the invites they sent", async () => {
    const { app, boss, staff } = await setup();
    await send(app, "POST", "/api/admin/team/invite", BOSS, boss, {
      email: "a@example.com",
      roleId: "curator",
    });
    await send(app, "POST", "/api/admin/team/invite", BOSS, boss, {
      email: "b@example.com",
      roleId: "support",
    });
    const list = await get(app, "/api/admin/team/invites", BOSS, boss);
    const invites = list.json.invites as Array<{ id: string; email: string }>;
    expect(invites.map((i) => i.email).sort()).toEqual(["a@example.com", "b@example.com"]);
    const a = invites.find((i) => i.email === "a@example.com") as { id: string };
    const b = invites.find((i) => i.email === "b@example.com") as { id: string };

    expect(
      (await send(app, "POST", `/api/admin/team/invites/${a.id}/cancel`, BOSS, boss)).status,
    ).toBe(200);
    expect(
      (await send(app, "POST", `/api/admin/team/invites/${a.id}/cancel`, BOSS, boss)).status,
    ).toBe(409);
    expect(
      (await send(app, "POST", `/api/admin/team/invites/${a.id}/resend`, BOSS, boss)).status,
    ).toBe(409);

    const resend = await send(app, "POST", `/api/admin/team/invites/${b.id}/resend`, BOSS, boss);
    expect(resend.status).toBe(200);
    const newId = (resend.json.invite as { id: string }).id;
    expect(newId).not.toBe(b.id);
    const after = (await get(app, "/api/admin/team/invites", BOSS, boss)).json.invites as Array<{
      id: string;
    }>;
    expect(after.map((i) => i.id)).toEqual([newId]);
    expect(app.audit("admin.invite.resent")).toHaveLength(1);

    // an invite sent by someone who is then removed stops working
    const mgr = await createCustomRole(app.env, {
      name: "Mgr",
      permissions: { dashboard: "view" },
    });
    run(app, "UPDATE admin_invites SET created_by = ? WHERE id = ?", staff.adminId, newId);
    void mgr;
    const rm = await send(app, "DELETE", `/api/admin/team/${staff.adminId}`, BOSS, boss);
    expect(rm.status).toBe(200);
    expect((await get(app, "/api/admin/team/invites", BOSS, boss)).json.invites).toEqual([]);
  });
});

describe("roles", () => {
  it("lists built-in and custom roles with member counts and the 20-role cap", async () => {
    const { app, boss } = await setup();
    const res = await get(app, "/api/admin/roles", BOSS, boss);
    expect(res.status).toBe(200);
    const roles = res.json.roles as Array<Record<string, unknown>>;
    expect(roles.map((r) => r.id).slice(0, 3)).toEqual(["super_admin", "curator", "support"]);
    expect(res.json.customCount).toBe(2);
    expect(res.json.customLimit).toBe(20);
    const curator = roles.find((r) => r.id === "curator") as Record<string, unknown>;
    expect(curator).toMatchObject({ builtIn: true, members: 0 });
    expect(curator.permissions).toMatchObject({
      dashboard: "view",
      metrics: "view",
      resources: "manage",
      paths: "manage",
      review_queues: "manage",
      users_waitlist: "none",
      settings: "none",
      admin_team: "none",
      audit_log: "none",
    });
    const support = roles.find((r) => r.id === "support") as Record<string, unknown>;
    expect(support).toMatchObject({ builtIn: true, members: 1 });
    expect(support.permissions).toMatchObject({
      users_waitlist: "manage",
      support_inbox: "manage",
      resources: "none",
    });
    const sup = roles.find((r) => r.id === "super_admin") as {
      permissions: Record<string, string>;
    };
    for (const a of ADMIN_AREAS)
      expect(sup.permissions[a]).toBe(a === "audit_log" ? "view" : "manage");
    const one = await get(app, "/api/admin/roles/support", BOSS, boss);
    expect((one.json.role as { memberList: unknown[] }).memberList).toEqual([
      expect.objectContaining({ name: "Seyi Ade" }),
    ]);
  });

  it("built-in roles cannot be edited, deleted or changed in the database", async () => {
    const { app, boss } = await setup();
    const put = await send(app, "PUT", "/api/admin/roles/curator", BOSS, boss, { name: "Mine" });
    expect(put.status).toBe(403);
    expect(put.json.code).toBe("role_builtin");
    expect((await send(app, "DELETE", "/api/admin/roles/support", BOSS, boss, {})).status).toBe(
      403,
    );
    expect((await send(app, "DELETE", "/api/admin/roles/super_admin", BOSS, boss, {})).status).toBe(
      403,
    );
    expect(() =>
      run(app, "UPDATE admin_role_permissions SET level = 'none' WHERE role_id = 'curator'"),
    ).toThrow();
    expect(() =>
      run(app, "DELETE FROM admin_role_permissions WHERE role_id = 'support'"),
    ).toThrow();
    expect(() =>
      run(
        app,
        "INSERT INTO admin_role_permissions (role_id, area, level) VALUES ('curator', 'settings', 'view')",
      ),
    ).toThrow();
    expect(() => run(app, "UPDATE admin_roles SET name = 'x' WHERE id = 'curator'")).toThrow();
    expect(() => run(app, "DELETE FROM admin_roles WHERE id = 'curator'")).toThrow();
    // built-ins do not use up custom slots
    expect(rows(app, "SELECT COUNT(*) AS n FROM admin_roles WHERE is_system = 0")).toEqual([
      { n: 2 },
    ]);
  });

  it("only Roles:manage writes; a view role cannot, even with a fresh session", async () => {
    const { app, viewer, plain, plainRole } = await setup();
    expect((await get(app, "/api/admin/roles", VIEWER, viewer)).status).toBe(200);
    expect((await get(app, "/api/admin/roles", PLAIN, plain)).status).toBe(403);
    const body = { name: "Sneaky", permissions: { settings: "manage" } };
    expect((await send(app, "POST", "/api/admin/roles", VIEWER, viewer, body)).status).toBe(403);
    expect(
      (await send(app, "PUT", `/api/admin/roles/${plainRole.id}`, VIEWER, viewer, { name: "x" }))
        .status,
    ).toBe(403);
    expect(
      (await send(app, "POST", `/api/admin/roles/${plainRole.id}/duplicate`, VIEWER, viewer, {}))
        .status,
    ).toBe(403);
    expect(
      (await send(app, "DELETE", `/api/admin/roles/${plainRole.id}`, VIEWER, viewer, {})).status,
    ).toBe(403);
    expect(rows(app, "SELECT id FROM admin_roles WHERE name = 'Sneaky'")).toHaveLength(0);
  });

  it("creates with ceilings enforced, rejects bad matrices and duplicate names, enforces the cap", async () => {
    const { app, boss } = await setup();
    const create = (b: unknown) => send(app, "POST", "/api/admin/roles", BOSS, boss, b);
    const ok = await create({
      name: "Content lead",
      description: "Runs the library",
      permissions: { resources: "manage", paths: "view", admin_team: "view" },
    });
    expect(ok.status).toBe(201);
    expect(ok.json.role).toMatchObject({
      name: "Content lead",
      description: "Runs the library",
      builtIn: false,
      members: 0,
      permissions: { resources: "manage", paths: "view", admin_team: "view", settings: "none" },
    });
    const level = await create({ name: "Over", permissions: { roles: "manage" } });
    expect(level.status).toBe(400);
    expect(level.json.code).toBe("level_not_allowed");
    expect((await create({ name: "Over", permissions: { audit_log: "manage" } })).status).toBe(400);
    expect((await create({ name: "Bad", permissions: { nonsense: "view" } })).status).toBe(400);
    expect((await create({ name: "", permissions: {} })).status).toBe(400);
    const dup = await create({ name: "content LEAD", permissions: {} });
    expect(dup.status).toBe(409);
    expect(dup.json.code).toBe("role_name_taken");
    expect((await create({ name: "Curator", permissions: {} })).status).toBe(409);
    for (let i = 0; i < 17; i++)
      expect((await create({ name: `Role ${i}`, permissions: {} })).status).toBe(201);
    const full = await create({ name: "One too many", permissions: {} });
    expect(full.status).toBe(409);
    expect(full.json.code).toBe("role_limit");
    expect((await get(app, "/api/admin/roles", BOSS, boss)).json.customCount).toBe(20);
  });

  it("update: ?preview=1 returns the diff and the people affected without writing; the real save needs step-up", async () => {
    const { app, boss, viewer, viewerRole } = await setup();
    const path = `/api/admin/roles/${viewerRole.id}`;
    const body = { name: "Senior auditor", permissions: { review_queues: "none", paths: "view" } };
    const preview = await send(app, "PUT", `${path}?preview=1`, BOSS, boss, body);
    expect(preview.status).toBe(200);
    const p = preview.json.preview as {
      changes: Array<{ area: string; from: string; to: string }>;
      nameChanged: boolean;
      affectedCount: number;
      affected: Array<{ name: string }>;
    };
    expect(p.changes).toEqual([
      { area: "paths", from: "none", to: "view" },
      { area: "review_queues", from: "view", to: "none" },
    ]);
    expect(p).toMatchObject({
      nameChanged: true,
      affectedCount: 1,
      affected: [{ name: "Vi Ewer" }],
    });
    expect(rows(app, "SELECT name FROM admin_roles WHERE id = ?", viewerRole.id)).toEqual([
      { name: "Auditor" },
    ]);

    // preview works on a stale session, saving does not
    run(
      app,
      "UPDATE admin_sessions SET last_reauth_at = unixepoch() - 400 WHERE admin_id = ?",
      boss.adminId,
    );
    expect((await send(app, "PUT", `${path}?preview=1`, BOSS, boss, body)).status).toBe(200);
    const stale = await send(app, "PUT", path, BOSS, boss, body);
    expect(stale.status).toBe(401);
    expect(stale.json.code).toBe("reauth_required");
    run(
      app,
      "UPDATE admin_sessions SET last_reauth_at = unixepoch() WHERE admin_id = ?",
      boss.adminId,
    );

    const saved = await send(app, "PUT", path, BOSS, boss, body);
    expect(saved.status).toBe(200);
    expect(saved.json.affectedCount).toBe(1);
    expect(saved.json.role).toMatchObject({
      name: "Senior auditor",
      permissions: { review_queues: "none", paths: "view", audit_log: "view" },
    });
    // takes effect on the member's very next request
    const me = await get(app, "/api/admin/me", VIEWER, viewer);
    expect((me.json.permissions as Record<string, string>).review_queues).toBe("none");
    const [entry] = app.audit("admin.role.updated");
    expect(JSON.parse(entry?.meta as string)).toMatchObject({
      changed: 2,
      before: "paths=none,review_queues=view",
      after: "paths=view,review_queues=none",
      affected: 1,
    });
    expect(
      (await send(app, "PUT", path, BOSS, boss, { permissions: { roles: "manage" } })).status,
    ).toBe(400);
    expect(
      (await send(app, "PUT", "/api/admin/roles/ghost", BOSS, boss, { name: "x" })).status,
    ).toBe(404);
    expect((await send(app, "PUT", path, BOSS, boss, { name: "Curator" })).status).toBe(409);
  });

  it("duplicates a role (a Super admin copy is clamped to custom ceilings) and counts against the cap", async () => {
    const { app, boss } = await setup();
    const dup = await send(app, "POST", "/api/admin/roles/curator/duplicate", BOSS, boss, {});
    expect(dup.status).toBe(201);
    expect(dup.json.role).toMatchObject({
      name: "Curator copy",
      builtIn: false,
      permissions: { resources: "manage", review_queues: "manage", settings: "none" },
    });
    const again = await send(app, "POST", "/api/admin/roles/curator/duplicate", BOSS, boss, {});
    expect((again.json.role as { name: string }).name).toBe("Curator copy 2");
    const named = await send(app, "POST", "/api/admin/roles/curator/duplicate", BOSS, boss, {
      name: "Curator copy",
    });
    expect(named.status).toBe(409);
    const sup = await send(app, "POST", "/api/admin/roles/super_admin/duplicate", BOSS, boss, {
      name: "Almost super",
    });
    expect(sup.status).toBe(201);
    expect(sup.json.role).toMatchObject({
      permissions: { settings: "manage", admin_team: "view", roles: "view", audit_log: "view" },
    });
    expect(app.audit("admin.role.duplicated")).toHaveLength(3);
  });

  it("delete: members must be moved first, never into Super admin; then the role is gone", async () => {
    const { app, boss, viewer, viewerRole } = await setup();
    const path = `/api/admin/roles/${viewerRole.id}`;
    const blocked = await send(app, "DELETE", path, BOSS, boss, {});
    expect(blocked.status).toBe(409);
    expect(blocked.json).toMatchObject({ code: "role_has_members", members: 1 });
    expect(
      (await send(app, "DELETE", path, BOSS, boss, { moveMembersTo: "super_admin" })).status,
    ).toBe(400);
    expect(
      (await send(app, "DELETE", path, BOSS, boss, { moveMembersTo: viewerRole.id })).status,
    ).toBe(400);
    expect((await send(app, "DELETE", path, BOSS, boss, { moveMembersTo: "ghost" })).status).toBe(
      400,
    );
    expect(rows(app, "SELECT id FROM admin_roles WHERE id = ?", viewerRole.id)).toHaveLength(1);
    const ok = await send(app, "DELETE", path, BOSS, boss, { moveMembersTo: "support" });
    expect(ok.status).toBe(200);
    expect(ok.json).toEqual({ deleted: true, moved: 1 });
    expect(rows(app, "SELECT role_id FROM admin_users WHERE id = ?", viewer.adminId)).toEqual([
      { role_id: "support" },
    ]);
    expect(rows(app, "SELECT id FROM admin_roles WHERE id = ?", viewerRole.id)).toHaveLength(0);
    // an unused role needs no target
    const empty = await send(app, "POST", "/api/admin/roles", BOSS, boss, {
      name: "Spare",
      permissions: {},
    });
    const id = (empty.json.role as { id: string }).id;
    expect((await send(app, "DELETE", `/api/admin/roles/${id}`, BOSS, boss)).status).toBe(200);
    const [entry] = app.audit("admin.role.deleted");
    expect(JSON.parse(entry?.meta as string)).toMatchObject({ moved: 1, to: "support" });
  });
});

describe("audit log", () => {
  it("needs audit_log:view and has no way to write, edit or delete", async () => {
    const { app, boss, viewer, plain } = await setup();
    expect((await get(app, "/api/admin/audit", VIEWER, viewer)).status).toBe(200);
    expect((await get(app, "/api/admin/audit", PLAIN, plain)).status).toBe(403);
    expect((await get(app, "/api/admin/audit/export", PLAIN, plain)).status).toBe(403);
    expect((await get(app, "/api/admin/audit/1", PLAIN, plain)).status).toBe(403);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const res = await send(app, method, "/api/admin/audit/1", BOSS, boss, {});
      expect([401, 404], method).toContain(res.status);
    }
    const first = rows<{ id: number }>(app, "SELECT MIN(id) AS id FROM audit_log")[0]?.id;
    expect(() => run(app, "DELETE FROM audit_log WHERE id = ?", first)).toThrow();
    expect(() => run(app, "UPDATE audit_log SET action = 'x' WHERE id = ?", first)).toThrow();
  });

  it("lists admin events only, newest first, with filters, a cursor and who/what/before/after", async () => {
    const { app, boss, staff } = await setup();
    // a learner event must never show up here
    run(
      app,
      "INSERT INTO audit_log (actor, action, created_at) VALUES ('some-learner-id', 'signin.success', unixepoch())",
    );
    await send(app, "PUT", `/api/admin/team/${staff.adminId}/roles`, BOSS, boss, {
      roleIds: ["curator"],
    });
    const all = await get(app, "/api/admin/audit?limit=100", BOSS, boss);
    const entries = all.json.entries as Array<Record<string, unknown>>;
    expect(entries.some((e) => e.action === "signin.success")).toBe(false);
    const ids = entries.map((e) => e.id as number);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    const changed = entries.find((e) => e.action === "admin.role.assigned") as Record<
      string,
      unknown
    >;
    expect(changed).toMatchObject({
      actor: { id: boss.adminId, name: "Tolu Adeyemi", role: "Super admin" },
      target: staff.adminId,
      targetLabel: "Seyi Ade",
      before: "support",
      after: "curator",
      confirmedWith: "password_2step",
      device: "Chrome on macOS",
    });
    expect(JSON.stringify(entries)).not.toMatch(/@example\.com/);

    const byAction = await get(app, "/api/admin/audit?action=admin.role", BOSS, boss);
    const kinds = new Set(
      (byAction.json.entries as Array<{ action: string }>).map((e) => e.action),
    );
    expect([...kinds].every((k) => k.startsWith("admin.role."))).toBe(true);
    expect(kinds.has("admin.role.assigned")).toBe(true);
    expect(
      (
        (await get(app, `/api/admin/audit?actor=${staff.adminId}&limit=100`, BOSS, boss)).json
          .entries as Array<{ actor: { id: string } }>
      ).every((e) => e.actor.id === staff.adminId),
    ).toBe(true);
    const byName = await get(app, "/api/admin/audit?q=Seyi", BOSS, boss);
    expect((byName.json.entries as unknown[]).length).toBeGreaterThan(0);
    const today = new Date().toISOString().slice(0, 10);
    expect(
      (
        (await get(app, `/api/admin/audit?from=${today}&to=${today}&limit=100`, BOSS, boss)).json
          .entries as unknown[]
      ).length,
    ).toBe(entries.length);
    expect(
      (await get(app, "/api/admin/audit?to=2020-01-01", BOSS, boss)).json.entries as unknown[],
    ).toEqual([]);
    expect((await get(app, "/api/admin/audit?from=notadate", BOSS, boss)).status).toBe(400);
    expect((await get(app, "/api/admin/audit?cursor=abc", BOSS, boss)).status).toBe(400);

    const p1 = await get(app, "/api/admin/audit?limit=3", BOSS, boss);
    expect((p1.json.entries as unknown[]).length).toBe(3);
    const cursor = p1.json.nextCursor as string;
    expect(cursor).toBeTruthy();
    const p2 = await get(app, `/api/admin/audit?limit=3&cursor=${cursor}`, BOSS, boss);
    const first = (p1.json.entries as Array<{ id: number }>).map((e) => e.id);
    const second = (p2.json.entries as Array<{ id: number }>).map((e) => e.id);
    expect(Math.max(...second)).toBeLessThan(Math.min(...first));

    const detail = await get(app, `/api/admin/audit/${changed.id}`, BOSS, boss);
    expect(detail.json.entry).toMatchObject({ id: changed.id, action: "admin.role.assigned" });
    expect((await get(app, "/api/admin/audit/999999", BOSS, boss)).status).toBe(404);
    expect((await get(app, "/api/admin/audit/abc", BOSS, boss)).status).toBe(404);
  });

  it("exports CSV that cannot run as a spreadsheet formula, and records the export", async () => {
    const { app, boss } = await setup();
    run(
      app,
      "INSERT INTO audit_log (actor, action, target, created_at) VALUES (?, 'admin.test', '=HYPERLINK(\"x\")', unixepoch())",
      boss.adminId,
    );
    const res = await get(app, "/api/admin/audit/export", BOSS, boss);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const lines = res.text.trim().split("\r\n");
    expect(lines[0]).toBe(
      "id,at,actor,actor_role,action,target,before,after,confirmed_with,device,ip",
    );
    expect(res.text).toContain("'=HYPERLINK");
    expect(res.text).not.toMatch(/,=HYPERLINK/);
    const [entry] = app.audit("admin.audit.exported");
    expect(JSON.parse(entry?.meta as string).rows).toBeGreaterThan(0);
  });
});

describe("shell: search, notifications, /me badges", () => {
  const addUser = (app: AdminApp, id: string, name: string, email: string) =>
    run(
      app,
      "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)",
      id,
      name,
      email,
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    );
  const addSubmission = (
    app: AdminApp,
    id: string,
    userId: string,
    title: string,
    status = "in_review",
  ) =>
    run(
      app,
      "INSERT INTO resource_submissions (id, user_id, url, url_normalised, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 1)",
      id,
      userId,
      `https://x.test/${id}`,
      `x.test/${id}`,
      title,
      status,
    );

  it("search is area-filtered and tolerant of tables that do not exist yet", async () => {
    const { app, boss, viewer, plain } = await setup();
    addUser(app, "u1", "Kemi Bello", "kemi@learner.test");
    addSubmission(app, "s1", "u1", "Kemi's guide to CSS grid");
    const full = await get(app, "/api/admin/search?q=kemi", BOSS, boss);
    expect(full.status).toBe(200);
    expect(full.json).toMatchObject({
      users: [{ id: "u1", name: "Kemi Bello", email: "kemi@learner.test" }],
      submissions: [{ id: "s1", status: "in_review" }],
      resources: [],
      paths: [],
    });
    // Auditor sees users and submissions (view), Plain sees nothing
    const v = await get(app, "/api/admin/search?q=kemi", VIEWER, viewer);
    expect((v.json.users as unknown[]).length).toBe(1);
    const none = await get(app, "/api/admin/search?q=kemi", PLAIN, plain);
    expect(none.json).toEqual({ users: [], resources: [], paths: [], submissions: [] });
    expect((await get(app, "/api/admin/search?q=k", BOSS, boss)).json).toEqual({
      users: [],
      resources: [],
      paths: [],
      submissions: [],
    });
    // wildcard characters are literal
    expect((await get(app, "/api/admin/search?q=%25%25", BOSS, boss)).json.users).toEqual([]);
    expect((await app.call("/api/admin/search?q=kemi", { as: BOSS })).status).toBe(401);

    // tables from migration 0014 appear: picked up with no code change; gated by their own areas
    run(app, "CREATE TABLE resources (id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT)");
    run(app, "CREATE TABLE paths (id TEXT PRIMARY KEY, title TEXT NOT NULL)");
    run(app, "INSERT INTO resources VALUES ('r1', 'Kemi on Flexbox', 'published')");
    run(app, "INSERT INTO paths VALUES ('p1', 'Kemi learns CSS')");
    const withTables = await get(app, "/api/admin/search?q=kemi", BOSS, boss);
    expect(withTables.json.resources).toEqual([
      { id: "r1", title: "Kemi on Flexbox", status: "published" },
    ]);
    expect(withTables.json.paths).toEqual([{ id: "p1", title: "Kemi learns CSS", status: null }]);
    expect((await get(app, "/api/admin/search?q=kemi", VIEWER, viewer)).json.resources).toEqual([]);
  });

  it("GET /me carries the review-queue badge (only with review_queues:view) and unread count", async () => {
    const { app, boss, viewer, plain } = await setup();
    addUser(app, "u1", "Kemi Bello", "kemi@learner.test");
    addSubmission(app, "s1", "u1", "One");
    addSubmission(app, "s2", "u1", "Two");
    addSubmission(app, "s3", "u1", "Done", "accepted");
    expect((await get(app, "/api/admin/me", BOSS, boss)).json).toMatchObject({
      badges: { review: 2 },
      unreadNotifications: 0,
      accessExpiresAt: null,
    });
    expect((await get(app, "/api/admin/me", VIEWER, viewer)).json.badges).toEqual({ review: 2 });
    expect((await get(app, "/api/admin/me", PLAIN, plain)).json.badges).toEqual({ review: 0 });
  });

  it("notifications are per area, read-all is per admin and persists", async () => {
    const { app, boss, viewer, plain } = await setup();
    await createAdminNotification(app.env.DB, { kind: "note", title: "For everyone" });
    await createAdminNotification(app.env.DB, {
      kind: "links",
      title: "Review queue is long",
      href: "/review",
      area: "review_queues",
    });
    await createAdminNotification(app.env.DB, {
      kind: "team",
      title: "Team thing",
      area: "admin_team",
    });

    const titles = async (email: string, a: Admin) =>
      (
        (await get(app, "/api/admin/notifications", email, a)).json.notifications as Array<{
          title: string;
        }>
      ).map((n) => n.title);
    expect(await titles(BOSS, boss)).toEqual([
      "Team thing",
      "Review queue is long",
      "For everyone",
    ]);
    expect(await titles(VIEWER, viewer)).toEqual([
      "Team thing",
      "Review queue is long",
      "For everyone",
    ]);
    expect(await titles(PLAIN, plain)).toEqual(["For everyone"]);
    const before = await get(app, "/api/admin/notifications", PLAIN, plain);
    expect(before.json.unread).toBe(1);
    expect((await get(app, "/api/admin/me", PLAIN, plain)).json.unreadNotifications).toBe(1);
    expect((await get(app, "/api/admin/me", BOSS, boss)).json.unreadNotifications).toBe(3);

    const read = await send(app, "POST", "/api/admin/notifications/read-all", PLAIN, plain, {});
    expect(read.status).toBe(200);
    const after = await get(app, "/api/admin/notifications", PLAIN, plain);
    expect(after.json.unread).toBe(0);
    expect((after.json.notifications as Array<{ read: boolean }>).every((n) => n.read)).toBe(true);
    expect((await get(app, "/api/admin/notifications", BOSS, boss)).json.unread).toBe(3);
    await createAdminNotification(app.env.DB, { kind: "note", title: "Later" });
    expect((await get(app, "/api/admin/notifications", PLAIN, plain)).json.unread).toBe(1);
    expect((await app.call("/api/admin/notifications", { as: BOSS })).status).toBe(401);
    expect(
      (await app.call("/api/admin/notifications/read-all", { as: BOSS, method: "POST", body: {} }))
        .status,
    ).toBe(401);
  });
});
