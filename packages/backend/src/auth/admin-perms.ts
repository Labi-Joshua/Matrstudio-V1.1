import { ADMIN_AREAS, type AdminArea, type AdminLevel, type AdminPermissions } from "@matr/types";
import type { Bindings } from "../env";
import { type AuditAction, writeAudit } from "./audit";

export type { AdminArea, AdminLevel };
// Admin roles and permissions (SECURITY-AUTH.md sections 6.3 and 7). The area list follows the
// admin side menu in the Figma file (Nav 1, page "Admin - Auth and navigation"): Overview
// (Dashboard, Metrics), Content (Resources, Paths), Review (Review queues), People (Users and
// waitlist, Support inbox), Admin (Admin team, Roles and permissions, Audit log, Settings).
export { ADMIN_AREAS };
export type Permissions = AdminPermissions;

export const SUPER_ADMIN_ROLE = "super_admin";
export const MAX_CUSTOM_ROLES = 20;

/** Areas where a custom role can never go above View. Only super_admin manages them. */
export const SUPER_ADMIN_ONLY_MANAGE: readonly AdminArea[] = ["admin_team", "roles"];
/** The audit log is append-only: View is the highest level that means anything. */
export const VIEW_ONLY_AREAS: readonly AdminArea[] = ["audit_log"];

const RANK: Record<AdminLevel, number> = { none: 0, view: 1, manage: 2 };
export const isAdminArea = (v: string): v is AdminArea =>
  (ADMIN_AREAS as readonly string[]).includes(v);

export const emptyPermissions = (): Permissions =>
  Object.fromEntries(ADMIN_AREAS.map((a) => [a, "none"])) as Permissions;

/** The highest level a role may hold on an area. */
export function maxLevel(roleId: string, area: AdminArea): AdminLevel {
  if (VIEW_ONLY_AREAS.includes(area)) return "view";
  if (roleId !== SUPER_ADMIN_ROLE && SUPER_ADMIN_ONLY_MANAGE.includes(area)) return "view";
  return "manage";
}

export async function loadPermissions(db: D1Database, roleId: string): Promise<Permissions> {
  const perms = emptyPermissions();
  if (roleId === SUPER_ADMIN_ROLE) {
    // Computed, not stored: nobody can edit the system role.
    for (const a of ADMIN_AREAS) perms[a] = maxLevel(roleId, a);
    return perms;
  }
  const rows = await db
    .prepare("SELECT area, level FROM admin_role_permissions WHERE role_id = ?")
    .bind(roleId)
    .all<{ area: string; level: AdminLevel }>();
  for (const r of rows.results) {
    if (!isAdminArea(r.area) || RANK[r.level] === undefined) continue;
    // Clamp to the area ceiling, so a row stored above it (it cannot be, see the triggers) never grants more.
    const ceiling = maxLevel(roleId, r.area);
    perms[r.area] = RANK[r.level] > RANK[ceiling] ? ceiling : r.level;
  }
  return perms;
}

/** The one permission check (spec section 7). Unknown areas and unknown levels fail closed. */
export function canAdmin(
  perms: Permissions | null | undefined,
  area: string,
  level: AdminLevel,
): boolean {
  if (!perms || !isAdminArea(area)) return false;
  if (!(level in RANK)) return false;
  if (level === "none") return true;
  return RANK[perms[area]] >= RANK[level];
}

/** Areas the admin may open: what the UI builds the side menu from. */
export const menuFor = (perms: Permissions): AdminArea[] =>
  ADMIN_AREAS.filter((a) => perms[a] !== "none");

export class RoleError extends Error {
  constructor(public readonly code: "role_limit" | "role_name_taken" | "level_not_allowed") {
    super(code);
  }
}

/**
 * Creates a custom role. Internal for now (the Roles screen comes later). Enforces the 20-role cap
 * and the per-area ceilings in code; the migration's triggers enforce the same in the database.
 */
export async function createCustomRole(
  env: Bindings,
  input: {
    name: string;
    description?: string;
    permissions: Partial<Permissions>;
    createdBy?: string;
  },
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const name = input.name.trim().slice(0, 60);
  const rows = Object.entries(input.permissions).filter(
    (e): e is [AdminArea, AdminLevel] => isAdminArea(e[0]) && e[1] !== undefined,
  );
  for (const [area, level] of rows) {
    if (RANK[level] === undefined || RANK[level] > RANK[maxLevel(id, area)]) {
      throw new RoleError("level_not_allowed");
    }
  }
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM admin_roles WHERE is_system = 0",
  ).first<{
    n: number;
  }>();
  if ((count?.n ?? 0) >= MAX_CUSTOM_ROLES) throw new RoleError("role_limit");
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO admin_roles (id, name, description, is_system, created_by) VALUES (?, ?, ?, 0, ?)",
      ).bind(id, name, input.description?.trim().slice(0, 200) || null, input.createdBy ?? null),
      ...rows.map(([area, level]) =>
        env.DB.prepare(
          "INSERT INTO admin_role_permissions (role_id, area, level) VALUES (?, ?, ?)",
        ).bind(id, area, level),
      ),
    ]);
  } catch (err) {
    if (String(err).includes("UNIQUE")) throw new RoleError("role_name_taken");
    if (String(err).includes("custom role limit")) throw new RoleError("role_limit");
    if (String(err).includes("not allowed")) throw new RoleError("level_not_allowed");
    throw err;
  }
  await writeAudit(env.DB, {
    actor: input.createdBy ?? null,
    action: "admin.role.created",
    target: id,
    meta: { areas: rows.length },
  });
  return { id };
}

/** Deletes every session of one admin, immediately (revocation rule, spec section 3). */
export async function revokeAdminSessions(
  env: Pick<Bindings, "DB">,
  adminId: string,
  opts: { actor?: string | null; reason: string },
): Promise<number> {
  const res = await env.DB.prepare("DELETE FROM admin_sessions WHERE admin_id = ?")
    .bind(adminId)
    .run();
  const n = res.meta.changes ?? 0;
  await writeAudit(env.DB, {
    actor: opts.actor ?? null,
    action: "admin.session.revoked",
    target: adminId,
    meta: { reason: opts.reason, count: n },
  });
  return n;
}

/** Changes an admin's role and signs them out everywhere (a privilege change). */
export async function changeAdminRole(
  env: Bindings,
  input: {
    adminId: string;
    roleId: string;
    actor: string;
    confirmed?: boolean;
    ip?: string | null;
    ua?: string | null;
  },
): Promise<boolean> {
  const before = await env.DB.prepare("SELECT role_id FROM admin_users WHERE id = ?")
    .bind(input.adminId)
    .first<{ role_id: string }>();
  const role = await env.DB.prepare("SELECT id FROM admin_roles WHERE id = ?")
    .bind(input.roleId)
    .first();
  if (!before || !role) return false;
  await env.DB.prepare("UPDATE admin_users SET role_id = ?, updated_at = unixepoch() WHERE id = ?")
    .bind(input.roleId, input.adminId)
    .run();
  await writeAudit(env.DB, {
    actor: input.actor,
    action: "admin.role.assigned" satisfies AuditAction,
    target: input.adminId,
    ip: input.ip,
    ua: input.ua,
    meta: {
      before: before.role_id,
      after: input.roleId,
      ...(input.confirmed ? { confirmed: "password_2step" } : {}),
    },
  });
  await revokeAdminSessions(env, input.adminId, { actor: input.actor, reason: "role_changed" });
  return true;
}

/** Suspends an admin and signs them out everywhere. */
export async function suspendAdmin(
  env: Bindings,
  input: {
    adminId: string;
    actor: string;
    reason?: string;
    confirmed?: boolean;
    ip?: string | null;
    ua?: string | null;
  },
): Promise<boolean> {
  const res = await env.DB.prepare(
    "UPDATE admin_users SET status = 'suspended', updated_at = unixepoch() WHERE id = ? AND status <> 'suspended'",
  )
    .bind(input.adminId)
    .run();
  if (!res.meta.changes) return false;
  await writeAudit(env.DB, {
    actor: input.actor,
    action: "admin.suspended",
    target: input.adminId,
    ip: input.ip,
    ua: input.ua,
    meta: {
      before: "active",
      after: "suspended",
      ...(input.reason ? { reason: input.reason.slice(0, 200) } : {}),
      ...(input.confirmed ? { confirmed: "password_2step" } : {}),
    },
  });
  await revokeAdminSessions(env, input.adminId, { actor: input.actor, reason: "suspended" });
  return true;
}
