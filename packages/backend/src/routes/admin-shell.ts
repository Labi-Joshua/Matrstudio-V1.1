import {
  ADMIN_AREAS,
  type AdminNotificationsResponse,
  type AdminPermissions,
  type AdminSearchResponse,
} from "@matr/types";
import { type Context, Hono } from "hono";
import { type AdminCtx, requireAdminSession } from "../auth/admin-guard";
import { canAdmin } from "../auth/admin-perms";
import { authError } from "../auth/guard";
import { hit, LIMITS } from "../auth/limits";

// Shell data for the portal chrome: global search and the notifications bell. The review-queue
// badge and the unread count ride on GET /me (see shellCounts, used by buildMe in routes/admin.ts).
// Mounted at /api/admin after requireAccess (lock 1); requireAdminSession adds lock 2.
export const adminShell = new Hono<AdminCtx>();
type C = Context<AdminCtx>;

const iso = (sec: number) => new Date(sec * 1000).toISOString();

// --- notifications ---------------------------------------------------------------------------
/** SQL that limits admin_notifications to what this admin's permissions allow (area at View+). */
function visibleClause(perms: AdminPermissions): { sql: string; args: string[] } {
  const areas = ADMIN_AREAS.filter((a) => canAdmin(perms, a, "view") && perms[a] !== "none");
  if (areas.length === 0) return { sql: "area IS NULL", args: [] };
  return {
    sql: `(area IS NULL OR area IN (${areas.map(() => "?").join(",")}))`,
    args: [...areas],
  };
}

const readMark = async (db: D1Database, adminId: string) =>
  (
    await db
      .prepare("SELECT notifications_read_id AS n FROM admin_users WHERE id = ?")
      .bind(adminId)
      .first<{ n: number }>()
  )?.n ?? 0;

/** Counts behind the shell badges. Review needs review_queues:view; the bell follows the same area rule. */
export async function shellCounts(
  db: D1Database,
  adminId: string,
  perms: AdminPermissions,
): Promise<{ review: number; unread: number }> {
  const vis = visibleClause(perms);
  const mark = await readMark(db, adminId);
  const review = canAdmin(perms, "review_queues", "view")
    ? await db
        .prepare("SELECT COUNT(*) AS n FROM resource_submissions WHERE status = 'in_review'")
        .first<{ n: number }>()
    : { n: 0 };
  const unread = await db
    .prepare(`SELECT COUNT(*) AS n FROM admin_notifications WHERE id > ? AND ${vis.sql}`)
    .bind(mark, ...vis.args)
    .first<{ n: number }>();
  return { review: review?.n ?? 0, unread: unread?.n ?? 0 };
}

adminShell.get("/notifications", requireAdminSession, async (c) => {
  const me = c.get("admin");
  const perms = c.get("permissions");
  const vis = visibleClause(perms);
  const mark = await readMark(c.env.DB, me.id);
  const rows = await c.env.DB.prepare(
    `SELECT id, kind, title, body, href, created_at FROM admin_notifications
      WHERE ${vis.sql} ORDER BY id DESC LIMIT 30`,
  )
    .bind(...vis.args)
    .all<{
      id: number;
      kind: string;
      title: string;
      body: string;
      href: string | null;
      created_at: number;
    }>();
  const counts = await shellCounts(c.env.DB, me.id, perms);
  const body: AdminNotificationsResponse = {
    notifications: rows.results.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      href: r.href,
      createdAt: iso(r.created_at),
      read: r.id <= mark,
    })),
    unread: counts.unread,
  };
  return c.json(body);
});

adminShell.post("/notifications/read-all", requireAdminSession, async (c) => {
  await c.env.DB.prepare(
    `UPDATE admin_users
        SET notifications_read_id = COALESCE((SELECT MAX(id) FROM admin_notifications), 0)
      WHERE id = ?`,
  )
    .bind(c.get("admin").id)
    .run();
  return c.json({ ok: true, unread: 0 });
});

// --- search ----------------------------------------------------------------------------------
/**
 * Tables that may not exist yet (resources and paths arrive with migration 0014). Each source is
 * skipped when its table or one of its columns is missing, so adding or renaming one is a one-line
 * change in TABLE_SOURCES and nothing breaks before the migration is applied.
 */
type Source = {
  key: "resources" | "paths";
  area: "resources" | "paths";
  table: string;
  id: string;
  title: string;
  status: string;
};
const TABLE_SOURCES: Source[] = [
  {
    key: "resources",
    area: "resources",
    table: "resources",
    id: "id",
    title: "title",
    status: "status",
  },
  { key: "paths", area: "paths", table: "paths", id: "id", title: "title", status: "status" },
];

const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
const MAX_RESULTS = 5;

async function columnsOf(db: D1Database, table: string): Promise<Set<string>> {
  try {
    const r = await db
      .prepare("SELECT name FROM pragma_table_info(?)")
      .bind(table)
      .all<{ name: string }>();
    return new Set(r.results.map((x) => x.name));
  } catch {
    return new Set();
  }
}

async function searchTable(db: D1Database, s: Source, like: string) {
  const cols = await columnsOf(db, s.table);
  if (!cols.has(s.id) || !cols.has(s.title)) return [];
  const status = cols.has(s.status) ? `"${s.status}"` : "NULL";
  try {
    const r = await db
      .prepare(
        `SELECT "${s.id}" AS id, "${s.title}" AS title, ${status} AS status FROM "${s.table}"
          WHERE "${s.title}" LIKE ? ESCAPE '\\' ORDER BY "${s.title}" LIMIT ${MAX_RESULTS}`,
      )
      .bind(like)
      .all<{ id: string; title: string; status: string | null }>();
    return r.results.map((x) => ({ id: String(x.id), title: String(x.title), status: x.status }));
  } catch {
    return [];
  }
}

adminShell.get("/search", requireAdminSession, async (c: C) => {
  const me = c.get("admin");
  const perms = c.get("permissions");
  const q = (c.req.query("q") ?? "").trim().slice(0, 80);
  const out: AdminSearchResponse = { users: [], resources: [], paths: [], submissions: [] };
  if (q.length < 2) return c.json(out);
  const limited = await hit(c.env.DB, `adm:search:${me.id}`, LIMITS.adminSearch);
  if (!limited.allowed) {
    c.header("Retry-After", String(limited.retryAfterSec));
    return c.json(
      authError("rate_limited", "Slow down a little.", {
        retryAfterSeconds: limited.retryAfterSec,
      }),
      429,
    );
  }
  const like = likePattern(q);
  const db = c.env.DB;

  if (canAdmin(perms, "users_waitlist", "view")) {
    const r = await db
      .prepare(
        `SELECT id, name, email FROM user
          WHERE name LIKE ?1 ESCAPE '\\' OR email LIKE ?1 ESCAPE '\\' ORDER BY name LIMIT ${MAX_RESULTS}`,
      )
      .bind(like)
      .all<{ id: string; name: string; email: string }>();
    out.users = r.results;
  }
  if (canAdmin(perms, "review_queues", "view")) {
    const r = await db
      .prepare(
        `SELECT id, COALESCE(title, url) AS title, status FROM resource_submissions
          WHERE title LIKE ?1 ESCAPE '\\' OR url LIKE ?1 ESCAPE '\\' ORDER BY created_at DESC LIMIT ${MAX_RESULTS}`,
      )
      .bind(like)
      .all<{ id: string; title: string; status: string }>();
    out.submissions = r.results;
  }
  for (const s of TABLE_SOURCES) {
    if (canAdmin(perms, s.area, "view")) out[s.key] = await searchTable(db, s, like);
  }
  return c.json(out);
});
