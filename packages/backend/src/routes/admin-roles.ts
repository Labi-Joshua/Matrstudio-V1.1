import {
  ADMIN_AREAS,
  ADMIN_ROLE_CAP,
  type AdminArea,
  type AdminLevel,
  type AdminPermissions,
  type AdminRoleDetail,
  type AdminRolePreview,
  type AdminRoleSummary,
  adminRoleCreateSchema,
  adminRoleDeleteSchema,
  adminRoleDuplicateSchema,
  adminRoleUpdateSchema,
} from "@matr/types";
import { type Context, Hono, type Next } from "hono";
import type { ZodType } from "zod";
import { type AdminCtx, requireAdmin, requireFreshAuth } from "../auth/admin-guard";
import {
  createCustomRole,
  isAdminArea,
  loadPermissions,
  maxLevel,
  RoleError,
  SUPER_ADMIN_ROLE,
} from "../auth/admin-perms";
import { type AuditEntry, writeAudit } from "../auth/audit";
import { authError } from "../auth/guard";
import { clientIp } from "../auth/util";

// Roles API (ADMIN-TEAM.md). Mounted at /api/admin/roles after requireAccess (lock 1). Reading needs
// roles:view; every write needs roles:manage, which only the Super admin can hold. Built-in roles
// (Super admin, Curator, Support) are immutable here and in the database (triggers in 0013).
export const adminRoles = new Hono<AdminCtx>();
type C = Context<AdminCtx>;

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const RANK: Record<AdminLevel, number> = { none: 0, view: 1, manage: 2 };

const invalid = (c: C) =>
  c.json(authError("invalid_request", "Check the details you entered."), 400);
const notFound = (c: C) => c.json(authError("not_found", "Role not found."), 404);
const builtIn = (c: C) =>
  c.json(
    authError(
      "role_builtin",
      "Built-in roles can’t be edited. Duplicate this one to make a custom role.",
    ),
    403,
  );
const nameTaken = (c: C) =>
  c.json(authError("role_name_taken", "A role with that name already exists."), 409);
const roleLimit = (c: C) =>
  c.json(
    authError("role_limit", `You can have up to ${ADMIN_ROLE_CAP} custom roles.`, {
      limit: ADMIN_ROLE_CAP,
    }),
    409,
  );

async function parse<T>(c: C, schema: ZodType<T>, empty = false): Promise<T | null> {
  const raw = await c.req.json().catch(() => (empty ? {} : null));
  const r = schema.safeParse(raw ?? (empty ? {} : null));
  return r.success ? r.data : null;
}

const audit = (c: C, e: Omit<AuditEntry, "actor" | "ip" | "ua">) =>
  writeAudit(c.env.DB, {
    actor: c.get("admin").id,
    ip: clientIp(c.req.raw.headers),
    ua: c.req.header("user-agent"),
    ...e,
  });

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  is_system: number;
};

const loadRole = async (c: C, id: string) =>
  ID_RE.test(id)
    ? c.env.DB.prepare("SELECT id, name, description, is_system FROM admin_roles WHERE id = ?")
        .bind(id)
        .first<RoleRow>()
    : null;

/** Validates the matrix from a request: known areas only, and never above an area's ceiling. */
function checkMatrix(
  input: Record<string, AdminLevel>,
): Partial<AdminPermissions> | "invalid" | "level" {
  const out: Partial<AdminPermissions> = {};
  for (const [area, level] of Object.entries(input)) {
    if (!isAdminArea(area)) return "invalid";
    if (RANK[level] > RANK[maxLevel("custom", area)]) return "level";
    out[area] = level;
  }
  return out;
}

const memberCounts = async (db: D1Database) => {
  const r = await db
    .prepare("SELECT role_id, COUNT(*) AS n FROM admin_users GROUP BY role_id")
    .all<{ role_id: string; n: number }>();
  return new Map(r.results.map((x) => [x.role_id, x.n]));
};

const toSummary = async (
  db: D1Database,
  r: RoleRow,
  members: number,
): Promise<AdminRoleSummary> => ({
  id: r.id,
  name: r.name,
  description: r.description,
  builtIn: r.is_system === 1,
  members,
  permissions: await loadPermissions(db, r.id),
});

async function detail(c: C, r: RoleRow): Promise<AdminRoleDetail> {
  const list = await c.env.DB.prepare(
    "SELECT id, name FROM admin_users WHERE role_id = ? ORDER BY name LIMIT 100",
  )
    .bind(r.id)
    .all<{ id: string; name: string }>();
  const total = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM admin_users WHERE role_id = ?")
    .bind(r.id)
    .first<{ n: number }>();
  return { ...(await toSummary(c.env.DB, r, total?.n ?? 0)), memberList: list.results };
}

const customCount = async (db: D1Database) =>
  (
    await db
      .prepare("SELECT COUNT(*) AS n FROM admin_roles WHERE is_system = 0")
      .first<{ n: number }>()
  )?.n ?? 0;

// --- read ------------------------------------------------------------------------------------
adminRoles.get("/", requireAdmin("roles", "view"), async (c) => {
  const db = c.env.DB;
  const rows = await db
    .prepare(
      `SELECT id, name, description, is_system FROM admin_roles
        ORDER BY CASE WHEN id = 'super_admin' THEN 0 ELSE 1 END, is_system DESC, lower(name)`,
    )
    .all<RoleRow>();
  const counts = await memberCounts(db);
  return c.json({
    roles: await Promise.all(rows.results.map((r) => toSummary(db, r, counts.get(r.id) ?? 0))),
    customCount: await customCount(db),
    customLimit: ADMIN_ROLE_CAP,
  });
});

adminRoles.get("/:id", requireAdmin("roles", "view"), async (c) => {
  const role = await loadRole(c, c.req.param("id"));
  if (!role) return notFound(c);
  return c.json({ role: await detail(c, role) });
});

// --- create ----------------------------------------------------------------------------------
adminRoles.post("/", requireAdmin("roles", "manage"), async (c) => {
  const body = await parse(c, adminRoleCreateSchema);
  if (!body) return invalid(c);
  const matrix = checkMatrix(body.permissions);
  if (matrix === "invalid") return invalid(c);
  if (matrix === "level") {
    return c.json(authError("level_not_allowed", "That level isn’t allowed for this area."), 400);
  }
  try {
    const { id } = await createCustomRole(c.env, {
      name: body.name,
      description: body.description,
      permissions: matrix,
      createdBy: c.get("admin").id,
    });
    const role = await loadRole(c, id);
    return c.json({ role: role ? await detail(c, role) : null }, 201);
  } catch (err) {
    if (err instanceof RoleError) {
      if (err.code === "role_limit") return roleLimit(c);
      if (err.code === "role_name_taken") return nameTaken(c);
      return c.json(authError("level_not_allowed", "That level isn’t allowed for this area."), 400);
    }
    throw err;
  }
});

// --- update (with ?preview=1 as a dry run) ----------------------------------------------------
const freshUnlessPreview = async (c: C, next: Next) =>
  c.req.query("preview") === "1" ? next() : requireFreshAuth()(c, next);

const levelsText = (items: { area: AdminArea; level: AdminLevel }[]) =>
  items
    .map((i) => `${i.area}=${i.level}`)
    .join(",")
    .slice(0, 400);

adminRoles.put("/:id", requireAdmin("roles", "manage"), freshUnlessPreview, async (c) => {
  const role = await loadRole(c, c.req.param("id"));
  if (!role) return notFound(c);
  if (role.is_system === 1) return builtIn(c);
  const body = await parse(c, adminRoleUpdateSchema);
  if (!body) return invalid(c);
  const matrix = checkMatrix(body.permissions ?? {});
  if (matrix === "invalid") return invalid(c);
  if (matrix === "level") {
    return c.json(authError("level_not_allowed", "That level isn’t allowed for this area."), 400);
  }
  const db = c.env.DB;
  if (body.name !== undefined) {
    const clash = await db
      .prepare("SELECT 1 AS x FROM admin_roles WHERE lower(name) = lower(?) AND id <> ?")
      .bind(body.name, role.id)
      .first();
    if (clash) return nameTaken(c);
  }

  const current = await loadPermissions(db, role.id);
  const changes = ADMIN_AREAS.flatMap((area) => {
    const to = matrix[area];
    return to !== undefined && to !== current[area] ? [{ area, from: current[area], to }] : [];
  });
  const nameChanged = body.name !== undefined && body.name !== role.name;
  const people = await db
    .prepare("SELECT id, name FROM admin_users WHERE role_id = ? ORDER BY name LIMIT 100")
    .bind(role.id)
    .all<{ id: string; name: string }>();
  const countRow = await db
    .prepare("SELECT COUNT(*) AS n FROM admin_users WHERE role_id = ?")
    .bind(role.id)
    .first<{ n: number }>();

  if (c.req.query("preview") === "1") {
    const preview: AdminRolePreview = {
      changes,
      nameChanged,
      affected: people.results,
      affectedCount: countRow?.n ?? 0,
    };
    return c.json({ preview });
  }

  const next = { ...current, ...matrix };
  const stmts = [
    db
      .prepare(
        "UPDATE admin_roles SET name = ?, description = ?, updated_at = unixepoch() WHERE id = ? AND is_system = 0",
      )
      .bind(
        body.name ?? role.name,
        body.description === undefined ? role.description : body.description || null,
        role.id,
      ),
    db.prepare("DELETE FROM admin_role_permissions WHERE role_id = ?").bind(role.id),
    ...ADMIN_AREAS.filter((a) => next[a] !== "none").map((a) =>
      db
        .prepare("INSERT INTO admin_role_permissions (role_id, area, level) VALUES (?, ?, ?)")
        .bind(role.id, a, next[a]),
    ),
  ];
  try {
    await db.batch(stmts);
  } catch (err) {
    if (String(err).includes("UNIQUE")) return nameTaken(c);
    if (String(err).includes("not allowed")) {
      return c.json(authError("level_not_allowed", "That level isn’t allowed for this area."), 400);
    }
    throw err;
  }
  await audit(c, {
    action: "admin.role.updated",
    target: role.id,
    meta: {
      changed: changes.length,
      before: levelsText(changes.map((x) => ({ area: x.area, level: x.from }))),
      after: levelsText(changes.map((x) => ({ area: x.area, level: x.to }))),
      renamed: nameChanged,
      affected: countRow?.n ?? 0,
      confirmed: "password_2step",
    },
  });
  const fresh = await loadRole(c, role.id);
  return c.json({
    role: fresh ? await detail(c, fresh) : null,
    changes,
    affectedCount: countRow?.n ?? 0,
  });
});

// --- duplicate -------------------------------------------------------------------------------
adminRoles.post("/:id/duplicate", requireAdmin("roles", "manage"), async (c) => {
  const role = await loadRole(c, c.req.param("id"));
  if (!role) return notFound(c);
  const body = await parse(c, adminRoleDuplicateSchema, true);
  if (!body) return invalid(c);
  const db = c.env.DB;
  if ((await customCount(db)) >= ADMIN_ROLE_CAP) return roleLimit(c);

  const taken = async (name: string) =>
    Boolean(
      await db
        .prepare("SELECT 1 AS x FROM admin_roles WHERE lower(name) = lower(?)")
        .bind(name)
        .first(),
    );
  let name = body.name ?? `${role.name} copy`.slice(0, 60);
  if (await taken(name)) {
    if (body.name) return nameTaken(c);
    let n = 2;
    while (await taken(`${role.name} copy ${n}`.slice(0, 60))) n++;
    name = `${role.name} copy ${n}`.slice(0, 60);
  }
  // The copy is custom, so it is clamped to the custom-role ceilings (Super admin has Manage on Roles).
  const copied: Partial<AdminPermissions> = {};
  const perms = await loadPermissions(db, role.id);
  for (const area of ADMIN_AREAS) {
    const cap = maxLevel("custom", area);
    const level = RANK[perms[area]] > RANK[cap] ? cap : perms[area];
    if (level !== "none") copied[area] = level;
  }
  try {
    const { id } = await createCustomRole(c.env, {
      name,
      description: role.description ?? undefined,
      permissions: copied,
      createdBy: c.get("admin").id,
    });
    await audit(c, { action: "admin.role.duplicated", target: id, meta: { from: role.id } });
    const made = await loadRole(c, id);
    return c.json({ role: made ? await detail(c, made) : null }, 201);
  } catch (err) {
    if (err instanceof RoleError) {
      return err.code === "role_limit" ? roleLimit(c) : nameTaken(c);
    }
    throw err;
  }
});

// --- delete ----------------------------------------------------------------------------------
adminRoles.delete("/:id", requireAdmin("roles", "manage"), requireFreshAuth(), async (c) => {
  const role = await loadRole(c, c.req.param("id"));
  if (!role) return notFound(c);
  if (role.is_system === 1) return builtIn(c);
  const body = await parse(c, adminRoleDeleteSchema, true);
  if (!body) return invalid(c);
  const db = c.env.DB;
  const members =
    (
      await db
        .prepare("SELECT COUNT(*) AS n FROM admin_users WHERE role_id = ?")
        .bind(role.id)
        .first<{ n: number }>()
    )?.n ?? 0;
  const to = body.moveMembersTo;
  if (members > 0 && !to) {
    return c.json(
      authError("role_has_members", "Move the people on this role to another role first.", {
        members,
      }),
      409,
    );
  }
  if (to) {
    // Moving people into Super admin is a promotion that needs its own 2-step confirmation.
    const target = to === role.id || to === SUPER_ADMIN_ROLE ? null : await loadRole(c, to);
    if (!target) {
      return c.json(
        authError("move_target_invalid", "Pick a different role to move them to."),
        400,
      );
    }
  }
  const stmts = to
    ? [
        db
          .prepare("UPDATE admin_users SET role_id = ?, updated_at = unixepoch() WHERE role_id = ?")
          .bind(to, role.id),
        db.prepare("UPDATE admin_invites SET role_id = ? WHERE role_id = ?").bind(to, role.id),
      ]
    : [db.prepare("DELETE FROM admin_invites WHERE role_id = ?").bind(role.id)];
  stmts.push(db.prepare("DELETE FROM admin_roles WHERE id = ? AND is_system = 0").bind(role.id));
  try {
    await db.batch(stmts);
  } catch (err) {
    if (String(err).includes("FOREIGN KEY")) {
      return c.json(
        authError("role_has_members", "Move the people on this role to another role first."),
        409,
      );
    }
    throw err;
  }
  await audit(c, {
    action: "admin.role.deleted",
    target: role.id,
    meta: { moved: members, to: to ?? null, confirmed: "password_2step" },
  });
  return c.json({ deleted: true, moved: members });
});
