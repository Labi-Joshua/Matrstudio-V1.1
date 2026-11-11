import type { AdminAuditEntry, AdminAuditListResponse } from "@matr/types";
import { type Context, Hono } from "hono";
import { type AdminCtx, requireAdmin } from "../auth/admin-guard";
import { writeAudit } from "../auth/audit";
import { authError } from "../auth/guard";
import { hit, LIMITS } from "../auth/limits";
import { clientIp, describeDevice } from "../auth/util";

// Audit log, read only (ADMIN-TEAM.md). Mounted at /api/admin/audit after requireAccess (lock 1);
// every route needs audit_log:view. There is no route that writes, edits or deletes an entry, and
// the table itself refuses UPDATE and DELETE (triggers in 0004). Exporting is the one thing that
// adds a row (admin.audit.exported), so exports are themselves on the record.
export const adminAudit = new Hono<AdminCtx>();
type C = Context<AdminCtx>;

const PAGE = 50;
const MAX_PAGE = 100;
const EXPORT_MAX = 5000;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const iso = (sec: number) => new Date(sec * 1000).toISOString();

type Row = {
  id: number;
  actor: string | null;
  action: string;
  target: string | null;
  ip: string | null;
  ua: string | null;
  meta: string;
  created_at: number;
  actor_name: string | null;
  actor_role: string | null;
  target_label: string | null;
};

// The log is shared with learner events. The admin view shows admin events only: the `admin.*`
// actions and anything done by a signed-in admin (support replies, reviews, ...).
const BASE = `(a.action LIKE 'admin.%' OR act.id IS NOT NULL)`;
const FROM = `FROM audit_log a
  LEFT JOIN admin_users act ON act.id = a.actor
  LEFT JOIN admin_roles ar ON ar.id = act.role_id
  LEFT JOIN admin_users tu ON tu.id = a.target
  LEFT JOIN admin_roles tr ON tr.id = a.target`;
const COLS = `a.id, a.actor, a.action, a.target, a.ip, a.ua, a.meta, a.created_at,
  act.name AS actor_name, ar.name AS actor_role, COALESCE(tu.name, tr.name) AS target_label`;

const like = (s: string) => `%${s.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

/** A date ("2026-11-04") or date-time, as unix seconds. A bare `to` date covers that whole day. */
function parseWhen(v: string | undefined, endOfDay: boolean): number | null | "bad" {
  if (!v) return null;
  const bare = /^\d{4}-\d{2}-\d{2}$/.test(v);
  const ms = Date.parse(bare ? `${v}T${endOfDay ? "23:59:59" : "00:00:00"}Z` : v);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : "bad";
}

function filters(c: C): { where: string; args: (string | number)[] } | null {
  const q = (c.req.query("q") ?? "").trim().slice(0, 80);
  const actor = c.req.query("actor");
  const action = (c.req.query("action") ?? "").trim().slice(0, 64);
  const from = parseWhen(c.req.query("from"), false);
  const to = parseWhen(c.req.query("to"), true);
  if (from === "bad" || to === "bad") return null;
  if (actor && !ID_RE.test(actor)) return null;
  const where = [BASE];
  const args: (string | number)[] = [];
  if (q) {
    where.push(
      `(a.action LIKE ? ESCAPE '\\' OR a.target LIKE ? ESCAPE '\\' OR act.name LIKE ? ESCAPE '\\' OR COALESCE(tu.name, tr.name) LIKE ? ESCAPE '\\')`,
    );
    args.push(like(q), like(q), like(q), like(q));
  }
  if (actor) {
    where.push("a.actor = ?");
    args.push(actor);
  }
  if (action) {
    // "admin.role" matches admin.role.created, admin.role.updated, ...
    where.push("(a.action = ? OR a.action LIKE ? ESCAPE '\\')");
    args.push(action, `${like(action).slice(1, -1)}.%`);
  }
  if (from !== null) {
    where.push("a.created_at >= ?");
    args.push(from);
  }
  if (to !== null) {
    where.push("a.created_at <= ?");
    args.push(to);
  }
  return { where: where.join(" AND "), args };
}

function parseMeta(raw: string): Record<string, string | number | boolean | null> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function toEntry(r: Row): AdminAuditEntry {
  const meta = parseMeta(r.meta);
  const { before, after, confirmed, ...detail } = meta;
  return {
    id: r.id,
    at: iso(r.created_at),
    actor: r.actor ? { id: r.actor, name: r.actor_name, role: r.actor_role } : null,
    action: r.action,
    target: r.target,
    targetLabel: r.target_label,
    before: before === undefined || before === null ? null : String(before),
    after: after === undefined || after === null ? null : String(after),
    confirmedWith: confirmed === "password_2step" ? "password_2step" : null,
    device: r.ua ? describeDevice(r.ua) : null,
    ip: r.ip,
    detail,
  };
}

const bad = (c: C) => c.json(authError("invalid_request", "Check the filters you entered."), 400);

adminAudit.get("/", requireAdmin("audit_log", "view"), async (c) => {
  const f = filters(c);
  if (!f) return bad(c);
  const cursor = c.req.query("cursor");
  if (cursor !== undefined && !/^\d{1,15}$/.test(cursor)) return bad(c);
  const limit = Math.min(MAX_PAGE, Math.max(1, Number(c.req.query("limit")) || PAGE));
  const rows = await c.env.DB.prepare(
    `SELECT ${COLS} ${FROM} WHERE ${f.where} ${cursor ? "AND a.id < ?" : ""}
      ORDER BY a.id DESC LIMIT ${limit + 1}`,
  )
    .bind(...f.args, ...(cursor ? [Number(cursor)] : []))
    .all<Row>();
  const page = rows.results.slice(0, limit);
  const body: AdminAuditListResponse = {
    entries: page.map(toEntry),
    nextCursor: rows.results.length > limit ? String(page[page.length - 1]?.id) : null,
  };
  return c.json(body);
});

// CSV export of the filtered log (same filters as the list), newest first, at most 5000 rows.
adminAudit.get("/export", requireAdmin("audit_log", "view"), async (c) => {
  const f = filters(c);
  if (!f) return bad(c);
  const actor = c.get("admin");
  const limited = await hit(c.env.DB, `adm:auditx:${actor.id}`, LIMITS.adminAuditExport);
  if (!limited.allowed) {
    c.header("Retry-After", String(limited.retryAfterSec));
    return c.json(
      authError("rate_limited", "Too many exports. Try again later.", {
        retryAfterSeconds: limited.retryAfterSec,
      }),
      429,
    );
  }
  const rows = await c.env.DB.prepare(
    `SELECT ${COLS} ${FROM} WHERE ${f.where} ORDER BY a.id DESC LIMIT ${EXPORT_MAX}`,
  )
    .bind(...f.args)
    .all<Row>();
  await writeAudit(c.env.DB, {
    actor: actor.id,
    action: "admin.audit.exported",
    ip: clientIp(c.req.raw.headers),
    ua: c.req.header("user-agent"),
    meta: { rows: rows.results.length },
  });
  // Cells that start with = + - @ are prefixed so a spreadsheet never runs them as a formula.
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = [
    "id,at,actor,actor_role,action,target,before,after,confirmed_with,device,ip",
    ...rows.results.map((r) => {
      const e = toEntry(r);
      return [
        e.id,
        e.at,
        e.actor?.name ?? e.actor?.id ?? "",
        e.actor?.role ?? "",
        e.action,
        e.targetLabel ?? e.target ?? "",
        e.before,
        e.after,
        e.confirmedWith,
        e.device,
        e.ip,
      ]
        .map(cell)
        .join(",");
    }),
  ];
  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});

adminAudit.get("/:id", requireAdmin("audit_log", "view"), async (c) => {
  const id = c.req.param("id");
  if (!/^\d{1,15}$/.test(id)) return c.json(authError("not_found", "Entry not found."), 404);
  const row = await c.env.DB.prepare(`SELECT ${COLS} ${FROM} WHERE a.id = ? AND ${BASE}`)
    .bind(Number(id))
    .first<Row>();
  if (!row) return c.json(authError("not_found", "Entry not found."), 404);
  return c.json({ entry: toEntry(row) });
});
