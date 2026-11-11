import {
  type AdminMemberDetail,
  type AdminPendingInvite,
  type AdminTeamListResponse,
  type AdminTeamMemberRow,
  adminChangeRoleSchema,
  adminSuspendSchema,
  adminTemporaryAccessSchema,
} from "@matr/types";
import { type Context, Hono } from "hono";
import type { ZodType } from "zod";
import { checkSecondFactor } from "../auth/admin-factor";
import { type AdminCtx, requireAdmin, requireFreshAuth } from "../auth/admin-guard";
import { cancelAdminInvite, InviteError, issueAdminInvite } from "../auth/admin-invites";
import { adminKeys, unlockAdmin } from "../auth/admin-lock";
import {
  changeAdminRole,
  revokeAdminSessions,
  SUPER_ADMIN_ROLE,
  suspendAdmin,
} from "../auth/admin-perms";
import { type AuditEntry, writeAudit } from "../auth/audit";
import { authError } from "../auth/guard";
import { hit, LIMITS, windowState } from "../auth/limits";
import { clientIp, describeDevice } from "../auth/util";

// Admin team API (ADMIN-TEAM.md). Mounted at /api/admin/team by routes/admin.ts after requireAccess
// (lock 1); every route adds lock 2 and an area check through requireAdmin. Writes need admin_team:manage
// (only the Super admin can hold it) and a fresh step-up. Invite and remove stay in routes/admin.ts.
export const adminTeam = new Hono<AdminCtx>();
type C = Context<AdminCtx>;

const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const MAX_ACCESS_DAYS = 366;
const iso = (sec: number) => new Date(sec * 1000).toISOString();
const isoOrNull = (sec: number | null) => (sec === null ? null : iso(sec));
const nowSec = () => Math.floor(Date.now() / 1000);

const invalid = (c: C) =>
  c.json(authError("invalid_request", "Check the details you entered."), 400);
const notFound = (c: C) => c.json(authError("not_found", "Admin not found."), 404);
const self = (c: C) =>
  c.json(authError("cannot_change_self", "You can’t do this to your own account."), 400);
const lastSuper = (c: C) =>
  c.json(authError("last_super_admin", "There must be at least one Super admin."), 409);

async function parse<T>(c: C, schema: ZodType<T>): Promise<T | null> {
  const raw = await c.req.json().catch(() => null);
  const r = schema.safeParse(raw);
  return r.success ? r.data : null;
}

const audit = (c: C, e: Omit<AuditEntry, "actor" | "ip" | "ua">) =>
  writeAudit(c.env.DB, {
    actor: c.get("admin").id,
    ip: clientIp(c.req.raw.headers),
    ua: c.req.header("user-agent"),
    ...e,
  });

type Row = {
  id: string;
  email: string;
  name: string;
  role_id: string;
  role_name: string;
  status: "invited" | "active" | "suspended";
  last_signin_at: number | null;
  totp_enrolled_at: number | null;
  access_expires_at: number | null;
  created_by: string | null;
  created_at: number;
  sessions: number;
};

const ROW_SQL = `SELECT u.id, u.email, u.name, u.role_id, r.name AS role_name, u.status, u.last_signin_at,
    u.totp_enrolled_at, u.access_expires_at, u.created_by, u.created_at,
    (SELECT COUNT(*) FROM admin_sessions s WHERE s.admin_id = u.id AND s.stage = 'active'
        AND s.expires_at > unixepoch() AND s.absolute_expires_at > unixepoch()) AS sessions
  FROM admin_users u JOIN admin_roles r ON r.id = u.role_id`;

const toMember = (r: Row, youId: string): AdminTeamMemberRow => ({
  id: r.id,
  email: r.email,
  name: r.name,
  roleId: r.role_id,
  roleName: r.role_name,
  status: r.status === "suspended" ? "suspended" : "active",
  lastSignInAt: r.last_signin_at,
  lastSignIn: isoOrNull(r.last_signin_at),
  mfaEnrolled: r.totp_enrolled_at !== null,
  sessions: r.sessions,
  accessExpiresAt: isoOrNull(r.access_expires_at),
  accessExpired: r.access_expires_at !== null && r.access_expires_at <= nowSec(),
  isYou: r.id === youId,
});

const activeSupers = async (db: D1Database, exceptId?: string) =>
  (
    await db
      .prepare(
        "SELECT COUNT(*) AS n FROM admin_users WHERE role_id = ? AND status = 'active' AND id <> ?",
      )
      .bind(SUPER_ADMIN_ROLE, exceptId ?? "")
      .first<{ n: number }>()
  )?.n ?? 0;

/** True when losing this account (demote, suspend, expiry) would leave no active Super admin. */
async function isLastSuper(db: D1Database, t: Pick<Row, "id" | "role_id" | "status">) {
  return (
    t.role_id === SUPER_ADMIN_ROLE && t.status === "active" && (await activeSupers(db, t.id)) === 0
  );
}

async function loadRow(c: C, id: string): Promise<Row | null> {
  if (!ID_RE.test(id)) return null;
  return c.env.DB.prepare(`${ROW_SQL} WHERE u.id = ?`).bind(id).first<Row>();
}

async function detail(c: C, id: string): Promise<AdminMemberDetail | null> {
  const r = await loadRow(c, id);
  if (!r) return null;
  const db = c.env.DB;
  const by = r.created_by
    ? await db
        .prepare("SELECT id, name FROM admin_users WHERE id = ?")
        .bind(r.created_by)
        .first<{ id: string; name: string }>()
    : null;
  const firstInvite = await db
    .prepare("SELECT MIN(created_at) AS at FROM admin_invites WHERE admin_id = ?")
    .bind(id)
    .first<{ at: number | null }>();
  const sessions = await db
    .prepare(
      `SELECT id, ua, ip, created_at, last_seen_at FROM admin_sessions
        WHERE admin_id = ? AND stage = 'active' AND expires_at > unixepoch() AND absolute_expires_at > unixepoch()
        ORDER BY last_seen_at DESC LIMIT 20`,
    )
    .bind(id)
    .all<{
      id: string;
      ua: string | null;
      ip: string | null;
      created_at: number;
      last_seen_at: number;
    }>();
  const current = c.get("adminSession").id;
  const { sessions: _count, ...member } = toMember(r, c.get("admin").id);
  return {
    ...member,
    invitedBy: by,
    invitedAt: isoOrNull(firstInvite?.at ?? null),
    joinedAt: isoOrNull(r.totp_enrolled_at),
    mfaEnrolledAt: isoOrNull(r.totp_enrolled_at),
    foundingSuperAdmin: r.role_id === SUPER_ADMIN_ROLE && r.created_by === null,
    sessions: sessions.results.map((s) => ({
      id: s.id,
      device: describeDevice(s.ua),
      ip: s.ip,
      createdAt: iso(s.created_at),
      lastSeenAt: iso(s.last_seen_at),
      current: s.id === current,
    })),
  };
}

const memberResponse = async (c: C, id: string) => c.json({ member: await detail(c, id) });

/** Loads the target of a write: 404 for an unknown id, 400 for yourself, 409 for a pending invite. */
async function writeTarget(c: C): Promise<{ res: Response } | { res?: undefined; t: Row }> {
  const t = await loadRow(c, c.req.param("id") ?? "");
  if (!t) return { res: notFound(c) };
  if (t.id === c.get("admin").id) return { res: self(c) };
  if (t.status === "invited") {
    return {
      res: c.json(authError("invite_pending", "This person hasn’t finished joining yet."), 409),
    };
  }
  return { t };
}

const manage = [requireAdmin("admin_team", "manage"), requireFreshAuth()] as const;

// --- list ------------------------------------------------------------------------------------
adminTeam.get("/", requireAdmin("admin_team", "view"), async (c) => {
  const db = c.env.DB;
  const members = await db
    .prepare(`${ROW_SQL} WHERE u.status <> 'invited' ORDER BY u.created_at, u.rowid`)
    .all<Row>();
  const body: AdminTeamListResponse = {
    members: members.results.map((r) => toMember(r, c.get("admin").id)),
    pendingInvites: await pendingInvites(c),
    onlySuperAdmin: (await activeSupers(db)) === 1,
  };
  return c.json(body);
});

async function pendingInvites(c: C): Promise<AdminPendingInvite[]> {
  const rows = await c.env.DB.prepare(
    `SELECT i.id, i.email, i.role_id, r.name AS role_name, i.created_at, i.expires_at,
            a.name AS name, inv.id AS by_id, inv.name AS by_name
       FROM admin_invites i
       JOIN admin_roles r ON r.id = i.role_id
       LEFT JOIN admin_users a ON a.id = i.admin_id
       LEFT JOIN admin_users inv ON inv.id = i.created_by
      WHERE i.used_at IS NULL AND i.cancelled_at IS NULL
      ORDER BY i.created_at DESC LIMIT 200`,
  ).all<{
    id: string;
    email: string;
    role_id: string;
    role_name: string;
    created_at: number;
    expires_at: number;
    name: string | null;
    by_id: string | null;
    by_name: string | null;
  }>();
  return rows.results.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name ?? r.email.split("@")[0] ?? "",
    roleId: r.role_id,
    roleName: r.role_name,
    invitedBy: r.by_id && r.by_name ? { id: r.by_id, name: r.by_name } : null,
    createdAt: iso(r.created_at),
    expiresAt: iso(r.expires_at),
    expired: r.expires_at <= nowSec(),
  }));
}

// --- invites (registered before /:id so "invites" is never read as an id) ---------------------
adminTeam.get("/invites", requireAdmin("admin_team", "view"), async (c) =>
  c.json({ invites: await pendingInvites(c) }),
);

adminTeam.post("/invites/:id/cancel", ...manage, async (c) => {
  const id = c.req.param("id");
  if (!ID_RE.test(id)) return notFound(c);
  const ok = await cancelAdminInvite(c.env, { inviteId: id, actor: c.get("admin").id });
  if (!ok) return c.json(authError("invite_not_pending", "That invite is no longer pending."), 409);
  return c.json({ cancelled: true });
});

adminTeam.post("/invites/:id/resend", ...manage, async (c) => {
  const id = c.req.param("id");
  if (!ID_RE.test(id)) return notFound(c);
  const actor = c.get("admin");
  const limited = await hit(c.env.DB, `adm:resend:${actor.id}`, LIMITS.adminResend);
  if (!limited.allowed) {
    c.header("Retry-After", String(limited.retryAfterSec));
    return c.json(
      authError("rate_limited", "Too many invites sent. Try again later.", {
        retryAfterSeconds: limited.retryAfterSec,
      }),
      429,
    );
  }
  const inv = await c.env.DB.prepare(
    "SELECT email, role_id FROM admin_invites WHERE id = ? AND used_at IS NULL AND cancelled_at IS NULL",
  )
    .bind(id)
    .first<{ email: string; role_id: string }>();
  if (!inv)
    return c.json(authError("invite_not_pending", "That invite is no longer pending."), 409);
  try {
    // A new invite replaces the old one (issueAdminInvite cancels it) and restarts setup.
    const next = await issueAdminInvite(c.env, {
      email: inv.email,
      roleId: inv.role_id,
      createdBy: actor.id,
    });
    await audit(c, {
      action: "admin.invite.resent",
      target: next.adminId,
      meta: { inviteId: next.id, previous: id, confirmed: "password_2step" },
    });
    return c.json({
      invite: { id: next.id, roleId: inv.role_id, expiresAt: iso(next.expiresAt) },
    });
  } catch (err) {
    if (err instanceof InviteError) {
      return c.json(authError("invite_not_pending", "That invite is no longer pending."), 409);
    }
    throw err;
  }
});

// --- member ----------------------------------------------------------------------------------
adminTeam.get("/:id", requireAdmin("admin_team", "view"), async (c) => {
  const member = await detail(c, c.req.param("id"));
  if (!member) return notFound(c);
  return c.json({ member });
});

/** The acting Super admin's own 2-step code, for promoting someone to Super admin. */
async function confirmWithCode(c: C, code: string): Promise<Response | null> {
  const actor = c.get("admin");
  const state = await windowState(c.env.DB, adminKeys.mfa(actor.id), LIMITS.adminMfa);
  if (state.count >= LIMITS.adminMfa.limit) {
    c.header("Retry-After", String(state.retryAfterSec));
    return c.json(
      authError("too_many_attempts", "Too many attempts. Try again later.", {
        retryAfterSeconds: state.retryAfterSec,
      }),
      429,
    );
  }
  const row = await c.env.DB.prepare(
    "SELECT id, totp_secret_enc, totp_last_step FROM admin_users WHERE id = ?",
  )
    .bind(actor.id)
    .first<{ id: string; totp_secret_enc: string | null; totp_last_step: number }>();
  const result = row ? await checkSecondFactor(c.env, row, code) : { ok: false as const };
  if (result.ok) return null;
  await hit(c.env.DB, adminKeys.mfa(actor.id), LIMITS.adminMfa);
  await audit(c, { action: "admin.mfa.failure", target: actor.id, meta: { phase: "role_change" } });
  return c.json(
    authError("invalid_code", "That code didn’t work. Check the app and try again."),
    401,
  );
}

adminTeam.put("/:id/roles", ...manage, async (c) => {
  const body = await parse(c, adminChangeRoleSchema);
  if (!body) return invalid(c);
  const w = await writeTarget(c);
  if (w.res) return w.res;
  const { t } = w;
  const roleId = body.roleIds[0] as string;
  const role = await c.env.DB.prepare("SELECT id FROM admin_roles WHERE id = ?")
    .bind(roleId)
    .first();
  if (!role) return c.json(authError("role_not_found", "That role doesn’t exist."), 404);
  if (roleId === t.role_id) return memberResponse(c, t.id);
  if (roleId !== SUPER_ADMIN_ROLE && (await isLastSuper(c.env.DB, t))) return lastSuper(c);
  if (roleId === SUPER_ADMIN_ROLE) {
    if (!body.twoStepCode) {
      return c.json(
        authError("two_step_required", "Enter your 2-step code to make someone a Super admin."),
        400,
      );
    }
    const refused = await confirmWithCode(c, body.twoStepCode);
    if (refused) return refused;
  }
  const done = await changeAdminRole(c.env, {
    adminId: t.id,
    roleId,
    actor: c.get("admin").id,
    confirmed: true,
    ip: clientIp(c.req.raw.headers),
    ua: c.req.header("user-agent"),
  });
  if (!done) return notFound(c);
  return memberResponse(c, t.id);
});

adminTeam.post("/:id/temporary-access", ...manage, async (c) => {
  const body = await parse(c, adminTemporaryAccessSchema);
  if (!body) return invalid(c);
  const w = await writeTarget(c);
  if (w.res) return w.res;
  const { t } = w;
  let until: number | null = null;
  if (body.until !== null) {
    // A bare date means the end of that day (UTC).
    const ms = Date.parse(
      /^\d{4}-\d{2}-\d{2}$/.test(body.until) ? `${body.until}T23:59:59Z` : body.until,
    );
    until = Math.floor(ms / 1000);
    const max = nowSec() + MAX_ACCESS_DAYS * 86400;
    if (!Number.isFinite(until) || until <= nowSec() || until > max) {
      return c.json(
        authError("invalid_until", "Pick a date in the future, within a year from today."),
        400,
      );
    }
    if (await isLastSuper(c.env.DB, t)) return lastSuper(c);
  }
  await c.env.DB.prepare(
    "UPDATE admin_users SET access_expires_at = ?, access_notice = 0, updated_at = unixepoch() WHERE id = ?",
  )
    .bind(until, t.id)
    .run();
  await audit(c, {
    action: "admin.access.temporary",
    target: t.id,
    meta: {
      before: t.access_expires_at === null ? "permanent" : iso(t.access_expires_at),
      after: until === null ? "permanent" : iso(until),
      confirmed: "password_2step",
    },
  });
  return memberResponse(c, t.id);
});

adminTeam.post("/:id/suspend", ...manage, async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = adminSuspendSchema.safeParse(raw ?? {});
  if (!parsed.success) return invalid(c);
  const w = await writeTarget(c);
  if (w.res) return w.res;
  const { t } = w;
  if (t.status === "suspended") {
    return c.json(authError("already_suspended", "This person is already suspended."), 409);
  }
  if (await isLastSuper(c.env.DB, t)) return lastSuper(c);
  const done = await suspendAdmin(c.env, {
    adminId: t.id,
    actor: c.get("admin").id,
    reason: parsed.data.reason,
    confirmed: true,
    ip: clientIp(c.req.raw.headers),
    ua: c.req.header("user-agent"),
  });
  if (!done)
    return c.json(authError("already_suspended", "This person is already suspended."), 409);
  return memberResponse(c, t.id);
});

adminTeam.post("/:id/restore", ...manage, async (c) => {
  const w = await writeTarget(c);
  if (w.res) return w.res;
  const { t } = w;
  const res = await c.env.DB.prepare(
    `UPDATE admin_users SET status = 'active', updated_at = unixepoch()
      WHERE id = ? AND status = 'suspended' AND totp_enrolled_at IS NOT NULL`,
  )
    .bind(t.id)
    .run();
  if (!res.meta.changes) {
    return c.json(authError("not_suspended", "This person isn’t suspended."), 409);
  }
  await audit(c, {
    action: "admin.restored",
    target: t.id,
    meta: { before: "suspended", after: "active", confirmed: "password_2step" },
  });
  return memberResponse(c, t.id);
});

adminTeam.post("/:id/sign-out-everywhere", ...manage, async (c) => {
  const w = await writeTarget(c);
  if (w.res) return w.res;
  const signedOut = await revokeAdminSessions(c.env, w.t.id, {
    actor: c.get("admin").id,
    reason: "signed_out_by_admin",
  });
  return c.json({ signedOut });
});

adminTeam.post("/:id/unlock", ...manage, async (c) => {
  const w = await writeTarget(c);
  if (w.res) return w.res;
  const ok = await unlockAdmin(c.env, { adminId: w.t.id, actor: c.get("admin").id });
  if (!ok) return notFound(c);
  return c.json({ unlocked: true });
});
