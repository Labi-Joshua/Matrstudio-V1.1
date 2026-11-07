import { ADMIN_AREAS } from "@matr/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAccessKeyCache } from "../src/auth/access";
import { canAdmin, createCustomRole, loadPermissions, RoleError } from "../src/auth/admin-perms";
import { ADMIN_PASSWORD, type AdminApp, codeNow, createAdminApp } from "./admin-helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  resetAccessKeyCache();
});

const BOSS = "boss@example.com";
const EDITOR = "editor@example.com";

const rows = <T = Record<string, unknown>>(app: AdminApp, sql: string, ...args: unknown[]) =>
  app.sqlite.prepare(sql).all(...(args as never[])) as T[];

async function setup() {
  const app = await createAdminApp();
  const boss = await app.enrolAdmin(BOSS, "super_admin", "Tolu Adeyemi");
  const role = await createCustomRole(app.env, {
    name: "Editor",
    permissions: { dashboard: "view", resources: "manage", admin_team: "view" },
    createdBy: boss.adminId,
  });
  const editor = await app.enrolAdmin(EDITOR, role.id, "Ada Obi");
  return { app, boss, editor, role };
}

describe("roles and permissions", () => {
  it("super admin manages every area except the view-only audit log, and the menu lists them all in order", async () => {
    const { app, boss } = await setup();
    const res = await app.call("/api/admin/me", { as: BOSS, cookie: boss.cookie });
    expect(res.status).toBe(200);
    expect(res.json.menu).toEqual([...ADMIN_AREAS]);
    const p = res.json.permissions as Record<string, string>;
    for (const a of ADMIN_AREAS) expect(p[a]).toBe(a === "audit_log" ? "view" : "manage");
    expect(res.json).toMatchObject({
      id: boss.adminId,
      email: BOSS,
      name: "Tolu Adeyemi",
      role: { id: "super_admin" },
      mfaEnrolled: true,
    });
    expect(typeof res.json.lastReauthAt).toBe("number");
  });

  it("a custom role's /me carries only its permissions; the menu hides areas at none", async () => {
    const { app, editor } = await setup();
    const res = await app.call("/api/admin/me", { as: EDITOR, cookie: editor.cookie });
    expect(res.json.menu).toEqual(["dashboard", "resources", "admin_team"]);
    expect(res.json.permissions).toMatchObject({
      resources: "manage",
      admin_team: "view",
      settings: "none",
      roles: "none",
    });
    expect(res.json.role).toMatchObject({ name: "Editor" });
  });

  it("custom roles cannot be given Manage on Admin team, Roles or the audit log", async () => {
    const app = await createAdminApp();
    for (const area of ["admin_team", "roles", "audit_log"] as const) {
      await expect(
        createCustomRole(app.env, { name: `x-${area}`, permissions: { [area]: "manage" } }),
      ).rejects.toMatchObject({
        code: "level_not_allowed",
      });
    }
    await expect(
      createCustomRole(app.env, { name: "ok", permissions: { admin_team: "view", roles: "view" } }),
    ).resolves.toBeTruthy();
    expect(rows(app, "SELECT * FROM admin_roles WHERE is_system = 0")).toHaveLength(1);
  });

  it("the database refuses those levels too, so no code path can store them", async () => {
    const app = await createAdminApp();
    const { id } = await createCustomRole(app.env, {
      name: "R",
      permissions: { dashboard: "view" },
    });
    const insert = (area: string, level: string) =>
      app.sqlite
        .prepare("INSERT INTO admin_role_permissions (role_id, area, level) VALUES (?, ?, ?)")
        .run(id, area, level);
    expect(() => insert("admin_team", "manage")).toThrow();
    expect(() => insert("roles", "manage")).toThrow();
    expect(() => insert("audit_log", "manage")).toThrow();
    expect(() => insert("settings", "root")).toThrow();
    expect(() => insert("not_an_area", "view")).toThrow();
    expect(() =>
      app.sqlite
        .prepare(
          "UPDATE admin_role_permissions SET level = 'manage' WHERE role_id = ? AND area = 'dashboard'",
        )
        .run(id),
    ).not.toThrow(); // allowed area
    app.sqlite
      .prepare(
        "INSERT INTO admin_role_permissions (role_id, area, level) VALUES (?, 'admin_team', 'view')",
      )
      .run(id);
    expect(() =>
      app.sqlite
        .prepare(
          "UPDATE admin_role_permissions SET level = 'manage' WHERE role_id = ? AND area = 'admin_team'",
        )
        .run(id),
    ).toThrow();
  });

  it("even a stored over-limit level is clamped when permissions are loaded", async () => {
    const app = await createAdminApp();
    const { id } = await createCustomRole(app.env, { name: "R", permissions: {} });
    app.sqlite.exec("DROP TRIGGER trg_admin_perm_cap_insert");
    app.sqlite
      .prepare(
        "INSERT INTO admin_role_permissions (role_id, area, level) VALUES (?, 'admin_team', 'manage')",
      )
      .run(id);
    const perms = await loadPermissions(app.env.DB, id);
    expect(perms.admin_team).toBe("view");
    expect(canAdmin(perms, "admin_team", "manage")).toBe(false);
  });

  it("allows at most 20 custom roles", async () => {
    const app = await createAdminApp();
    for (let i = 0; i < 20; i++)
      await createCustomRole(app.env, { name: `Role ${i}`, permissions: { dashboard: "view" } });
    await expect(
      createCustomRole(app.env, { name: "One too many", permissions: {} }),
    ).rejects.toBeInstanceOf(RoleError);
    await expect(
      createCustomRole(app.env, { name: "One too many", permissions: {} }),
    ).rejects.toMatchObject({ code: "role_limit" });
    expect(() =>
      app.sqlite
        .prepare("INSERT INTO admin_roles (id, name, is_system) VALUES ('x', 'X', 0)")
        .run(),
    ).toThrow();
    expect(() =>
      app.sqlite.prepare("DELETE FROM admin_roles WHERE id = 'super_admin'").run(),
    ).toThrow();
  });

  it("can() fails closed for unknown areas and levels", () => {
    const perms = { dashboard: "manage" } as never;
    expect(canAdmin(perms, "dashboard", "manage")).toBe(true);
    expect(canAdmin(perms, "dashboard", "none")).toBe(true);
    expect(canAdmin(perms, "nonsense", "view")).toBe(false);
    expect(canAdmin(perms, "dashboard", "root" as never)).toBe(false);
    expect(canAdmin(null, "dashboard", "view")).toBe(false);
    expect(canAdmin(undefined, "dashboard", "none")).toBe(false);
  });
});

describe("team endpoints: guarded writes", () => {
  it("lists the team for View on Admin team, and refuses roles with none", async () => {
    const { app, boss, editor } = await setup();
    const ok = await app.call("/api/admin/team", { as: EDITOR, cookie: editor.cookie });
    expect(ok.status).toBe(200);
    expect((ok.json.members as unknown[]).length).toBe(2);
    expect(JSON.stringify(ok.json)).not.toMatch(/password|totp|token|hash/i);
    const none = await createCustomRole(app.env, {
      name: "Nothing",
      permissions: { dashboard: "view" },
    });
    const third = await app.enrolAdmin("third@example.com", none.id);
    expect(
      (await app.call("/api/admin/team", { as: "third@example.com", cookie: third.cookie })).status,
    ).toBe(403);
    expect((await app.call("/api/admin/team", { as: BOSS, cookie: boss.cookie })).status).toBe(200);
    // no session at all
    expect((await app.call("/api/admin/team", { as: BOSS })).status).toBe(401);
  });

  it("POST /team/invite needs Manage on Admin team: a View role is refused even when fresh", async () => {
    const { app, editor } = await setup();
    const res = await app.call("/api/admin/team/invite", {
      as: EDITOR,
      cookie: editor.cookie,
      body: { email: "new@example.com", roleId: "super_admin" },
    });
    expect(res.status).toBe(403);
    expect(res.json.code).toBe("forbidden");
    expect(rows(app, "SELECT * FROM admin_users WHERE email = 'new@example.com'")).toHaveLength(0);
  });

  it("POST /team/invite needs step-up: stale session gets reauth_required, then /reauth unlocks it", async () => {
    const { app, boss } = await setup();
    const body = { email: "new@example.com", roleId: "super_admin" };
    app.sqlite
      .prepare("UPDATE admin_sessions SET last_reauth_at = unixepoch() - 301 WHERE admin_id = ?")
      .run(boss.adminId);
    const stale = await app.call("/api/admin/team/invite", { as: BOSS, cookie: boss.cookie, body });
    expect(stale.status).toBe(401);
    expect(stale.json.code).toBe("reauth_required");
    expect(rows(app, "SELECT * FROM admin_invites WHERE email = 'new@example.com'")).toHaveLength(
      0,
    );
    app.sqlite.prepare("UPDATE admin_users SET totp_last_step = 0 WHERE id = ?").run(boss.adminId);
    const re = await app.call("/api/admin/reauth", {
      as: BOSS,
      cookie: boss.cookie,
      body: { password: ADMIN_PASSWORD, code: codeNow(boss.secret) },
    });
    expect(re.status).toBe(200);
    const ok = await app.call("/api/admin/team/invite", { as: BOSS, cookie: boss.cookie, body });
    expect(ok.status).toBe(201);
    expect(ok.json.invite).toMatchObject({ email: "new@example.com", roleId: "super_admin" });
    expect(JSON.stringify(ok.json)).not.toContain("token");
    // exactly at the 5 minute edge is still fine; just past it is not
    app.sqlite
      .prepare("UPDATE admin_sessions SET last_reauth_at = unixepoch() - 290 WHERE admin_id = ?")
      .run(boss.adminId);
    expect(
      (
        await app.call("/api/admin/team/invite", {
          as: BOSS,
          cookie: boss.cookie,
          body: { email: "n2@example.com", roleId: "super_admin" },
        })
      ).status,
    ).toBe(201);
  });

  it("an invite writes an audit row (actor, role) and queues the email on the admin origin", async () => {
    const { app, boss } = await setup();
    const before = app.emails.length;
    const ok = await app.call("/api/admin/team/invite", {
      as: BOSS,
      cookie: boss.cookie,
      body: { email: "new@example.com", roleId: "super_admin", name: "New Person" },
    });
    expect(ok.status).toBe(201);
    const mail = app.emails.slice(before).find((e) => e.type === "admin-invite");
    expect(mail).toMatchObject({
      to: "new@example.com",
      invitedBy: "Tolu Adeyemi",
      role: "Super admin",
    });
    expect(
      (mail as { link: string }).link.startsWith(
        "https://admin.matrstudio.com/accept-invite?token=",
      ),
    ).toBe(true);
    const log = app.audit("admin.invite.created").pop() as { actor: string; meta: string };
    expect(log.actor).toBe(boss.adminId);
    expect(JSON.parse(log.meta)).toMatchObject({ role: "super_admin" });
    expect(JSON.stringify(rows(app, "SELECT * FROM audit_log"))).not.toContain("new@example.com");
  });

  it("validates the invite body and refuses duplicates and unknown roles", async () => {
    const { app, boss } = await setup();
    const go = (body: unknown) =>
      app.call("/api/admin/team/invite", { as: BOSS, cookie: boss.cookie, body });
    expect((await go({ email: "not-an-email", roleId: "super_admin" })).status).toBe(400);
    expect((await go({ email: "a@b.co" })).status).toBe(400);
    expect((await go({ email: "a@b.co", roleId: "super_admin", isSuperAdmin: true })).status).toBe(
      400,
    ); // strict
    expect((await go({ email: "a@b.co", roleId: "nope" })).json.code).toBe("role_not_found");
    expect((await go({ email: EDITOR, roleId: "super_admin" })).json.code).toBe("admin_exists");
    expect((await go({ email: BOSS.toUpperCase(), roleId: "super_admin" })).json.code).toBe(
      "admin_exists",
    );
  });

  it("re-inviting a pending address replaces the earlier invite", async () => {
    const { app, boss } = await setup();
    const go = () =>
      app.call("/api/admin/team/invite", {
        as: BOSS,
        cookie: boss.cookie,
        body: { email: "new@example.com", roleId: "super_admin" },
      });
    expect((await go()).status).toBe(201);
    expect((await go()).status).toBe(201);
    expect(rows(app, "SELECT * FROM admin_users WHERE email = 'new@example.com'")).toHaveLength(1);
    expect(
      rows(
        app,
        "SELECT * FROM admin_invites WHERE email = 'new@example.com' AND cancelled_at IS NULL",
      ),
    ).toHaveLength(1);
  });

  it("DELETE /team/:id removes an admin, revokes their sessions at once and audits before/after", async () => {
    const { app, boss, editor } = await setup();
    const res = await app.call(`/api/admin/team/${editor.adminId}`, {
      method: "DELETE",
      as: BOSS,
      cookie: boss.cookie,
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ removed: true });
    expect((await app.call("/api/admin/me", { as: EDITOR, cookie: editor.cookie })).status).toBe(
      401,
    );
    expect(rows(app, "SELECT * FROM admin_users WHERE id = ?", editor.adminId)).toHaveLength(0);
    expect(
      rows(app, "SELECT * FROM admin_sessions WHERE admin_id = ?", editor.adminId),
    ).toHaveLength(0);
    expect(
      rows(app, "SELECT * FROM admin_backup_codes WHERE admin_id = ?", editor.adminId),
    ).toHaveLength(0);
    const log = app.audit("admin.removed")[0] as { actor: string; target: string; meta: string };
    expect(log.actor).toBe(boss.adminId);
    expect(log.target).toBe(editor.adminId);
    expect(JSON.parse(log.meta)).toMatchObject({
      before: expect.stringContaining("role:"),
      after: "removed",
    });
    expect(JSON.stringify(log)).not.toContain("@");
    // the removed admin can no longer sign in, and the same call again is a 404
    expect((await app.signIn(editor)).step1.status).toBe(401);
    expect(
      (
        await app.call(`/api/admin/team/${editor.adminId}`, {
          method: "DELETE",
          as: BOSS,
          cookie: boss.cookie,
        })
      ).status,
    ).toBe(404);
  });

  it("DELETE needs Manage and step-up", async () => {
    const { app, boss, editor } = await setup();
    const asEditor = await app.call(`/api/admin/team/${boss.adminId}`, {
      method: "DELETE",
      as: EDITOR,
      cookie: editor.cookie,
    });
    expect(asEditor.status).toBe(403);
    expect(rows(app, "SELECT * FROM admin_users WHERE id = ?", boss.adminId)).toHaveLength(1);
    app.sqlite
      .prepare("UPDATE admin_sessions SET last_reauth_at = unixepoch() - 600 WHERE admin_id = ?")
      .run(boss.adminId);
    const stale = await app.call(`/api/admin/team/${editor.adminId}`, {
      method: "DELETE",
      as: BOSS,
      cookie: boss.cookie,
    });
    expect(stale.status).toBe(401);
    expect(stale.json.code).toBe("reauth_required");
    expect(rows(app, "SELECT * FROM admin_users WHERE id = ?", editor.adminId)).toHaveLength(1);
    expect(
      (await app.call(`/api/admin/team/${editor.adminId}`, { method: "DELETE", as: BOSS })).status,
    ).toBe(401); // no session
  });

  it("IDOR: only real admin ids resolve; self, other record types and junk ids are refused", async () => {
    const { app, boss, editor } = await setup();
    const del = (id: string) =>
      app.call(`/api/admin/team/${encodeURIComponent(id)}`, {
        method: "DELETE",
        as: BOSS,
        cookie: boss.cookie,
      });
    expect((await del(boss.adminId)).json.code).toBe("cannot_remove_self");
    const sessionId = (
      app.sqlite
        .prepare("SELECT id FROM admin_sessions WHERE admin_id = ?")
        .get(editor.adminId) as { id: string }
    ).id;
    for (const id of [
      sessionId,
      editor.invite.id,
      "1; DROP TABLE admin_users",
      "../../etc/passwd",
      "x".repeat(200),
      "%00",
    ]) {
      expect((await del(id)).status).toBe(404);
    }
    expect(rows(app, "SELECT * FROM admin_users")).toHaveLength(2);
    expect(
      rows(app, "SELECT * FROM admin_sessions WHERE admin_id = ?", editor.adminId),
    ).toHaveLength(1);
    // the editor's own id in a request body or query changes nothing about who they are
    const spoof = await app.call(`/api/admin/me?id=${boss.adminId}`, {
      as: EDITOR,
      cookie: editor.cookie,
      headers: { "x-admin-id": boss.adminId },
    });
    expect(spoof.json.id).toBe(editor.adminId);
  });

  it("two Super admins can remove each other's access only one at a time, and the last cannot remove itself", async () => {
    const { app, boss } = await setup();
    const second = await app.enrolAdmin("second@example.com", "super_admin");
    expect(
      (
        await app.call(`/api/admin/team/${boss.adminId}`, {
          method: "DELETE",
          as: "second@example.com",
          cookie: second.cookie,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.call(`/api/admin/team/${second.adminId}`, {
          method: "DELETE",
          as: "second@example.com",
          cookie: second.cookie,
        })
      ).json.code,
    ).toBe("cannot_remove_self");
    expect(
      rows(app, "SELECT * FROM admin_users WHERE role_id = 'super_admin' AND status = 'active'"),
    ).toHaveLength(1);
  });
});
