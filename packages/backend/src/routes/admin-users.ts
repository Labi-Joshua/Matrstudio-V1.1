import {
  type AdminUserRow,
  type AdminUserStatus,
  adminDeleteUserSchema,
  adminSuspendSchema,
  USER_STATUSES,
} from "@matr/types";
import { Hono, type MiddlewareHandler } from "hono";
import {
  audit,
  type C,
  clampLimit,
  invalid,
  isSuperAdmin,
  limited,
  notFound,
  parseBody,
  readCursor,
} from "../admin/common";
import { sendResetLinkTo } from "../admin/reset-link";
import { collectLearnerExport, deleteLearnerAccount } from "../auth/account-deletion";
import { type AdminCtx, requireAdmin, requireFreshAuth } from "../auth/admin-guard";
import { authError } from "../auth/guard";
import { LIMITS } from "../auth/limits";
import { enqueueAuthEmail } from "../queue/auth-email";

// Mounted by routes/admin.ts at /users after requireAccess (lock 1); requireAdmin adds lock 2.
export const adminUsers = new Hono<AdminCtx>();

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const REASON_TEXT: Record<string, string> = {
  spam: "spam or abuse",
  guidelines: "breaking our community guidelines",
  security: "a security concern",
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: number;
  createdAt: string;
  suspended: number;
  providers: string | null;
  passkeys: number;
  paths: number;
  last_in: string | null;
};

const SELECT = `SELECT u.id, u.name, u.email, u.emailVerified, u.createdAt,
  (s.user_id IS NOT NULL) AS suspended,
  (SELECT group_concat(a.providerId) FROM account a WHERE a.userId = u.id) AS providers,
  (SELECT COUNT(*) FROM passkey p WHERE p.userId = u.id) AS passkeys,
  (SELECT COUNT(*) FROM path_enrolments e WHERE e.user_id = u.id AND e.started_at IS NOT NULL) AS paths,
  (SELECT MAX(ss.createdAt) FROM session ss WHERE ss.userId = u.id) AS last_in
  FROM user u LEFT JOIN user_suspensions s ON s.user_id = u.id`;

const statusOf = (r: UserRow): AdminUserStatus =>
  r.suspended ? "suspended" : r.emailVerified ? "active" : "unconfirmed";

function toRow(r: UserRow): AdminUserRow {
  const methods = new Set<string>();
  for (const p of (r.providers ?? "").split(",")) {
    if (p === "credential") methods.add("password");
    else if (p) methods.add(p);
  }
  if (r.passkeys > 0) methods.add("passkey");
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    joinedAt: r.createdAt,
    status: statusOf(r),
    authMethods: [...methods],
    pathsCount: r.paths,
    lastSignInAt: r.last_in,
  };
}

// GET /api/admin/users?q&status&cursor&limit  (newest first; search matches the start of a name or an email)
adminUsers.get("/", requireAdmin("users_waitlist", "view"), async (c) => {
  const status = c.req.query("status");
  if (status && !(USER_STATUSES as readonly string[]).includes(status)) return invalid(c);
  const cursor = readCursor(c.req.query("cursor"));
  if (cursor === "bad") return invalid(c);
  const q = (c.req.query("q") ?? "").trim().toLowerCase().slice(0, 100);
  const limit = clampLimit(c.req.query("limit"));
  const where: string[] = [];
  const args: unknown[] = [];
  const arg = (v: unknown) => `?${args.push(v)}`;
  if (q) {
    // Prefix ranges so the email and lower(name) indexes serve the search.
    const lo = arg(q);
    const hi = arg(`${q}￿`);
    where.push(
      `((u.email >= ${lo} AND u.email < ${hi}) OR (lower(u.name) >= ${lo} AND lower(u.name) < ${hi}))`,
    );
  }
  if (status === "suspended") where.push("s.user_id IS NOT NULL");
  if (status === "unconfirmed") where.push("s.user_id IS NULL AND u.emailVerified = 0");
  if (status === "active") where.push("s.user_id IS NULL AND u.emailVerified = 1");
  if (cursor) {
    const a = arg(cursor[0]);
    const b = arg(cursor[1]);
    where.push(`(u.createdAt < ${a} OR (u.createdAt = ${a} AND u.id < ${b}))`);
  }
  const rows = await c.env.DB.prepare(
    `${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY u.createdAt DESC, u.id DESC LIMIT ${limit + 1}`,
  )
    .bind(...args)
    .all<UserRow>();
  const page = rows.results.slice(0, limit);
  const last = page.at(-1);
  const [learners, waiting] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM user").first<{ n: number }>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM waitlist_subscribers s
         LEFT JOIN waitlist_invites wi ON wi.subscriber_id = s.id
         LEFT JOIN user u ON u.email = lower(s.email)
        WHERE s.status = 'verified' AND wi.subscriber_id IS NULL AND u.id IS NULL`,
    ).first<{ n: number }>(),
  ]);
  return c.json({
    totals: { learners: learners?.n ?? 0, waitlist: waiting?.n ?? 0 },
    users: page.map(toRow),
    nextCursor: rows.results.length > limit && last ? `${last.createdAt}:${last.id}` : null,
  });
});

async function loadUser(c: C): Promise<{ res: Response } | { res?: undefined; row: UserRow }> {
  const id = c.req.param("id") ?? "";
  if (!ID.test(id)) return { res: invalid(c) };
  const row = await c.env.DB.prepare(`${SELECT} WHERE u.id = ?1`).bind(id).first<UserRow>();
  return row ? { row } : { res: notFound(c, "That learner") };
}

const at = (s: number) => new Date(s * 1000).toISOString();

function authMethodOf(r: UserRow): "password" | "google" | "both" {
  const m = toRow(r).authMethods;
  const google = m.includes("google");
  const password = m.includes("password");
  return google && password ? "both" : google ? "google" : "password";
}

adminUsers.get("/:id", requireAdmin("users_waitlist", "view"), async (c) => {
  const found = await loadUser(c);
  if (found.res) return found.res;
  const { row } = found;
  const db = c.env.DB;
  const [suspension, profile, paths, submissions, tickets, impact] = await Promise.all([
    db
      .prepare(
        `SELECT s.reason, s.note, s.suspended_at, COALESCE(a.name, 'a former admin') AS by_name
           FROM user_suspensions s LEFT JOIN admin_users a ON a.id = s.suspended_by WHERE s.user_id = ?`,
      )
      .bind(row.id)
      .first<{
        reason: string;
        note: string | null;
        suspended_at: number;
        by_name: string;
      }>(),
    db
      .prepare("SELECT username, is_public FROM profiles WHERE user_id = ?")
      .bind(row.id)
      .first<{ username: string; is_public: number }>(),
    db
      .prepare(
        `SELECT e.path_slug, e.started_at, e.last_activity_at, e.completed_at, e.starred_at,
           (SELECT COUNT(*) FROM path_lessons_done d WHERE d.user_id = e.user_id AND d.path_slug = e.path_slug) AS done
         FROM path_enrolments e WHERE e.user_id = ? ORDER BY COALESCE(e.last_activity_at, e.starred_at) DESC LIMIT 50`,
      )
      .bind(row.id)
      .all<{
        path_slug: string;
        started_at: string | null;
        last_activity_at: string | null;
        completed_at: string | null;
        starred_at: string | null;
        done: number;
      }>(),
    db
      .prepare(
        "SELECT id, title, status, created_at FROM resource_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
      )
      .bind(row.id)
      .all<{ id: string; title: string | null; status: string; created_at: number }>(),
    db
      .prepare(
        "SELECT id, kind, subject, status, created_at FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
      )
      .bind(row.id)
      .all<{ id: string; kind: string; subject: string; status: string; created_at: number }>(),
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM path_enrolments WHERE user_id = ?1 AND started_at IS NOT NULL) AS paths,
                (SELECT COUNT(*) FROM path_enrolments WHERE user_id = ?1 AND completed_at IS NOT NULL) AS completed,
                (SELECT COUNT(*) FROM resource_submissions WHERE user_id = ?1) AS submissions,
                (SELECT COUNT(*) FROM support_tickets WHERE user_id = ?1 AND status IN ('open', 'replied', 'waiting_on_user')) AS open_tickets`,
      )
      .bind(row.id)
      .first<{ paths: number; completed: number; submissions: number; open_tickets: number }>(),
  ]);
  const user = {
    ...toRow(row),
    emailConfirmed: !!row.emailVerified,
    suspension: suspension
      ? {
          reason: suspension.reason,
          note: suspension.note,
          at: at(suspension.suspended_at),
          by: suspension.by_name,
        }
      : null,
    profile: profile ? { username: profile.username, isPublic: !!profile.is_public } : null,
    emailConfirmedAt: null, // Better Auth keeps no confirmation time
    authMethod: authMethodOf(row),
    profileHidden: null, // no profile moderation yet
    paths: paths.results.map((p) => ({
      // id/title/state/lessonsTotal/percent are what the portal reads; the catalogue is not in D1,
      // so the title is the slug and the total is unknown (0).
      id: p.path_slug,
      title: p.path_slug,
      state: p.completed_at ? "completed" : p.started_at ? "in_progress" : "saved",
      lessonsTotal: 0,
      percent: p.completed_at ? 100 : 0,
      finishedAt: p.completed_at,
      slug: p.path_slug,
      startedAt: p.started_at,
      lastActivityAt: p.last_activity_at,
      completedAt: p.completed_at,
      starredAt: p.starred_at,
      lessonsDone: p.done,
    })),
    submissions: submissions.results.map((s) => ({
      id: s.id,
      title: s.title ?? "Untitled submission",
      status: s.status === "accepted" ? "approved" : s.status,
      at: at(s.created_at),
      createdAt: at(s.created_at),
    })),
    tickets: tickets.results.map((t) => ({
      id: t.id,
      kind: t.kind,
      subject: t.subject,
      status: t.status === "replied" ? "waiting_on_user" : t.status,
      at: at(t.created_at),
      createdAt: at(t.created_at),
    })),
    impact: {
      paths: impact?.paths ?? 0,
      pathsCompleted: impact?.completed ?? 0,
      submissions: impact?.submissions ?? 0,
      openTickets: impact?.open_tickets ?? 0,
    },
  };
  return c.json({ user });
});

// POST /users/:id/reset-link: the learner gets the normal reset email. 202, no link is returned.
adminUsers.post("/:id/reset-link", requireAdmin("users_waitlist", "manage"), async (c) => {
  const found = await loadUser(c);
  if (found.res) return found.res;
  const { row } = found;
  const blocked =
    (await limited(
      c,
      `admin-reset:admin:${c.get("admin").id}`,
      LIMITS.adminResetLinkAdmin,
      "admin_reset_admin",
    )) ??
    (await limited(c, `admin-reset:user:${row.id}`, LIMITS.adminResetLinkUser, "admin_reset_user"));
  if (blocked) return blocked;
  if (row.suspended)
    return c.json(authError("user_suspended", "Restore this account before sending a link."), 409);
  await sendResetLinkTo(c.env, row);
  await audit(c, "admin.user.reset_link", row.id);
  return c.json({ sent: true }, 202);
});

adminUsers.post("/:id/suspend", requireAdmin("users_waitlist", "manage"), async (c) => {
  const found = await loadUser(c);
  if (found.res) return found.res;
  const { row } = found;
  const body = await parseBody(c, adminSuspendSchema);
  if (!body) return invalid(c);
  if (row.suspended) return c.json(authError("already_suspended", "Already suspended."), 409);
  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);
  // One batch: the suspension row and every live session go together.
  await db.batch([
    db
      .prepare(
        "INSERT INTO user_suspensions (user_id, reason, note, suspended_by, suspended_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(row.id, body.reason, body.message || null, c.get("admin").id, now),
    db.prepare("DELETE FROM session WHERE userId = ?").bind(row.id),
  ]);
  await enqueueAuthEmail(c.env, {
    type: "account-suspended",
    to: row.email,
    reason: REASON_TEXT[body.reason] ?? "a breach of our community rules",
    ...(body.message ? { message: body.message } : {}),
  });
  await audit(c, "admin.user.suspended", row.id, {
    reason: body.reason,
    hasMessage: !!body.message,
  });
  return c.json({ suspended: true });
});

adminUsers.post("/:id/restore", requireAdmin("users_waitlist", "manage"), async (c) => {
  const found = await loadUser(c);
  if (found.res) return found.res;
  const { row } = found;
  const res = await c.env.DB.prepare("DELETE FROM user_suspensions WHERE user_id = ?")
    .bind(row.id)
    .run();
  if (!res.meta.changes)
    return c.json(authError("not_suspended", "This account isn’t suspended."), 409);
  await enqueueAuthEmail(c.env, { type: "account-restored", to: row.email });
  await audit(c, "admin.user.restored", row.id);
  return c.json({ restored: true });
});

// POST (not GET): an audited action with a rate limit. The body is the learner's data copy.
adminUsers.post("/:id/export", requireAdmin("users_waitlist", "manage"), async (c) => {
  const found = await loadUser(c);
  if (found.res) return found.res;
  const { row } = found;
  const blocked = await limited(
    c,
    `admin-export:admin:${c.get("admin").id}`,
    LIMITS.adminExportAdmin,
    "admin_export",
  );
  if (blocked) return blocked;
  const data = await collectLearnerExport(c.env.DB, {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: !!row.emailVerified,
  });
  await audit(c, "admin.user.exported", row.id);
  c.header("Cache-Control", "no-store");
  return c.json({ queued: false, data });
});

const superAdminOnly: MiddlewareHandler<AdminCtx> = async (c, next) => {
  if (!isSuperAdmin(c))
    return c.json(authError("forbidden", "Only a Super admin can delete an account."), 403);
  await next();
};

// DELETE /users/:id {confirm: <the learner's email>}. Super admin only, plus fresh auth (300 s).
adminUsers.delete(
  "/:id",
  requireAdmin("users_waitlist", "manage"),
  superAdminOnly,
  requireFreshAuth(),
  async (c) => {
    const found = await loadUser(c);
    if (found.res) return found.res;
    const { row } = found;
    const body = await parseBody(c, adminDeleteUserSchema);
    if (!body) return invalid(c);
    if (body.confirm.toLowerCase() !== row.email.toLowerCase())
      return c.json(authError("confirm_mismatch", "Type the learner’s email to confirm."), 400);
    await deleteLearnerAccount(c.env, { id: row.id, email: row.email });
    // After the deletion on purpose: the account's own audit rows were just anonymised, this one
    // names the admin and nothing about the learner.
    await audit(c, "admin.user.deleted", null, { by: "admin" });
    return c.json({ deleted: true });
  },
);
