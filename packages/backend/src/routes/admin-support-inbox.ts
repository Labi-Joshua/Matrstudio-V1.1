import {
  type AdminTicketStatus,
  adminAssignSchema,
  adminLogIssueSchema,
  adminNoteSchema,
  INBOX_TABS,
  SUPPORT_KINDS,
} from "@matr/types";
import { Hono } from "hono";
import { audit, type C, clampLimit, invalid, limited, notFound, parseBody } from "../admin/common";
import { iso, isoOrNull } from "../admin/range";
import { type AdminCtx, requireAdmin } from "../auth/admin-guard";
import { authError } from "../auth/guard";
import { LIMITS } from "../auth/limits";
import { AUTO_RESOLVE_DAYS } from "../support/sla";
import { CLOSED, ID_PATTERN, TICKET_SELECT, type TicketRow } from "../support/tickets";

// Mounted by routes/admin.ts at /support next to adminSupport (reply and status stay in
// admin-support.ts). requireAdmin runs lock 2 and the role check on every route.
export const adminSupportInbox = new Hono<AdminCtx>();

const DAY = 86400;
const WAITING_SQL = "('waiting_on_user', 'replied')";
const CLOSED_SQL = "('resolved', 'fixed', 'cant_reproduce')";
const OVERDUE_SQL =
  "(t.status = 'open' AND t.first_reply_at IS NULL AND t.due_at IS NOT NULL AND t.due_at < ?1)";

/** The admin API calls both "waiting" statuses waiting_on_user. */
const adminStatus = (s: TicketRow["status"]): AdminTicketStatus =>
  s === "replied" ? "waiting_on_user" : s;

type ListRow = TicketRow & {
  overdue: number;
  name: string;
  email: string;
  snippet: string | null;
  logged: number;
};

const sla = (r: TicketRow, now: number) => {
  const closed = (CLOSED as readonly string[]).includes(r.status);
  const overdue =
    !closed &&
    r.status === "open" &&
    r.first_reply_at === null &&
    r.due_at !== null &&
    r.due_at < now;
  return {
    dueAt: isoOrNull(r.due_at),
    firstReplyAt: isoOrNull(r.first_reply_at),
    overdue,
    // met: answered inside the target; late: answered after it; due: still waiting for a first reply
    state: closed
      ? "closed"
      : r.first_reply_at !== null
        ? r.due_at !== null && r.first_reply_at > r.due_at
          ? "late"
          : "met"
        : overdue
          ? "overdue"
          : "due",
    secondsLeft: r.first_reply_at === null && r.due_at !== null && !closed ? r.due_at - now : null,
  };
};

const summary = (r: ListRow, now: number, me: string) => ({
  snippet: r.snippet ?? "",
  requester: { name: r.name, email: r.email },
  isNew: r.status === "open" && r.first_reply_at === null,
  logged: !!r.logged,
  assignedToMe: r.assigned_to === me,
  id: r.id,
  kind: r.kind,
  category: r.category,
  subject: r.subject,
  status: adminStatus(r.status),
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
  from: { id: r.user_id, name: r.name, email: r.email },
  ...sla(r, now),
  resolvesAt:
    adminStatus(r.status) === "waiting_on_user" && r.waiting_since !== null
      ? iso(r.waiting_since + AUTO_RESOLVE_DAYS * DAY)
      : null,
});

// GET /support?tab=open|waiting|resolved&kind&category&status&overdue=1&cursor&limit
// Open and waiting: overdue first, then oldest first. Resolved: newest closed first.
adminSupportInbox.get("/", requireAdmin("support_inbox", "view"), async (c) => {
  const q = c.req.query();
  if (q.tab && !(INBOX_TABS as readonly string[]).includes(q.tab)) return invalid(c);
  if (q.kind && !(SUPPORT_KINDS as readonly string[]).includes(q.kind)) return invalid(c);
  const statuses = ["open", "waiting_on_user", "resolved", "fixed", "cant_reproduce"];
  if (q.status && !statuses.includes(q.status)) return invalid(c);
  const now = Math.floor(Date.now() / 1000);
  const limit = clampLimit(q.limit);
  const args: unknown[] = [now];
  const arg = (v: unknown) => `?${args.push(v)}`;
  const where: string[] = [];
  if (q.tab === "open") where.push("t.status = 'open'");
  if (q.tab === "waiting") where.push(`t.status IN ${WAITING_SQL}`);
  if (q.tab === "resolved") where.push(`t.status IN ${CLOSED_SQL}`);
  if (q.status === "waiting_on_user") where.push(`t.status IN ${WAITING_SQL}`);
  else if (q.status) where.push(`t.status = ${arg(q.status)}`);
  if (q.kind) where.push(`t.kind = ${arg(q.kind)}`);
  if (q.assigned === "me") where.push(`t.assigned_to = ${arg(c.get("admin").id)}`);
  if (q.category) where.push(`t.category = ${arg(q.category.slice(0, 60))}`);
  if (q.overdue === "1" || q.overdue === "true") where.push(OVERDUE_SQL);

  const resolvedView = q.tab === "resolved";
  let order = `${OVERDUE_SQL} DESC, t.created_at, t.id`;
  if (resolvedView) order = "t.closed_at DESC, t.id DESC";
  if (q.cursor) {
    const [a, b, id] = q.cursor.split("|");
    if (!a || !b || (!resolvedView && !id) || !/^\d+$/.test(a) || !/^\d+$/.test(b))
      return invalid(c);
    if (resolvedView) {
      where.push(
        `(t.closed_at < ${arg(Number(a))} OR (t.closed_at = ${a} AND t.id < ${arg(id ?? b)}))`,
      );
    } else {
      // a = overdue flag, b = created_at, id = ticket id
      where.push(
        `(${OVERDUE_SQL} < ${arg(Number(a))} OR (${OVERDUE_SQL} = ${a} AND (t.created_at > ${arg(Number(b))} OR (t.created_at = ${b} AND t.id > ${arg(id)}))))`,
      );
    }
  }
  const rows = await c.env.DB.prepare(
    `SELECT t.id, t.user_id, t.kind, t.category, t.subject, t.status, t.created_at, t.updated_at,
       t.context_resource, t.context_where, t.context_link, t.due_at, t.first_reply_at,
       t.waiting_since, t.closed_at, t.assigned_to, 0 AS message_count, ${OVERDUE_SQL} AS overdue, u.name, u.email,
       (SELECT substr(m.body, 1, 140) FROM support_messages m WHERE m.ticket_id = t.id AND m.author = 'user'
         ORDER BY m.created_at, m.rowid LIMIT 1) AS snippet,
       EXISTS (SELECT 1 FROM support_issues i WHERE i.ticket_id = t.id) AS logged
     FROM support_tickets t JOIN user u ON u.id = t.user_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY ${order} LIMIT ${limit + 1}`,
  )
    .bind(...args)
    .all<ListRow>();
  const page = rows.results.slice(0, limit);
  const last = page.at(-1);
  const more = rows.results.length > limit && last;
  const counts = await c.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM support_tickets WHERE status = 'open') AS open,
       (SELECT COUNT(*) FROM support_tickets WHERE status IN ${WAITING_SQL}) AS waiting,
       (SELECT COUNT(*) FROM support_tickets WHERE closed_at >= ?2) AS resolved,
       (SELECT COUNT(*) FROM support_tickets t WHERE ${OVERDUE_SQL}) AS overdue`,
  )
    .bind(now, now - 30 * DAY)
    .first<{ open: number; waiting: number; resolved: number; overdue: number }>();
  return c.json({
    tickets: page.map((r) => summary(r, now, c.get("admin").id)),
    nextCursor: more
      ? resolvedView
        ? `${last.closed_at ?? 0}|${last.id}|${last.id}`
        : `${last.overdue}|${last.created_at}|${last.id}`
      : null,
    // resolved counts the last 30 days; the resolved tab itself lists everything
    counts: {
      open: counts?.open ?? 0,
      waiting: counts?.waiting ?? 0,
      resolved: counts?.resolved ?? 0,
      resolvedLast30d: counts?.resolved ?? 0,
      overdue: counts?.overdue ?? 0,
    },
  });
});

async function target(c: C): Promise<{ res: Response } | { res?: undefined; row: TicketRow }> {
  const id = c.req.param("id") ?? "";
  if (!ID_PATTERN.test(id))
    return { res: c.json(authError("invalid_request", "That ticket id isn’t valid."), 400) };
  const row = await c.env.DB.prepare(`${TICKET_SELECT} WHERE t.id = ?`).bind(id).first<TicketRow>();
  return row ? { row } : { res: notFound(c, "That request") };
}

adminSupportInbox.get("/:id", requireAdmin("support_inbox", "view"), async (c) => {
  const t = await target(c);
  if (t.res) return t.res;
  const { row } = t;
  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);
  const [requester, past, messages, issue, assignee] = await Promise.all([
    db
      .prepare(
        `SELECT u.id, u.name, u.email, u.createdAt,
           (SELECT COUNT(*) FROM path_enrolments e WHERE e.user_id = u.id AND e.started_at IS NOT NULL) AS paths
         FROM user u WHERE u.id = ?`,
      )
      .bind(row.user_id)
      .first<{ id: string; name: string; email: string; createdAt: string; paths: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(closed_at IS NOT NULL), 0) AS resolved
           FROM support_tickets WHERE user_id = ? AND id <> ?`,
      )
      .bind(row.user_id, row.id)
      .first<{ n: number; resolved: number }>(),
    db
      .prepare(
        `SELECT m.id, m.author, m.body, m.created_at, a.name AS admin_name
           FROM support_messages m LEFT JOIN admin_users a ON a.id = m.admin_id
          WHERE m.ticket_id = ? ORDER BY m.created_at, m.rowid`,
      )
      .bind(row.id)
      .all<{
        id: string;
        author: "user" | "staff" | "note";
        body: string;
        created_at: number;
        admin_name: string | null;
      }>(),
    db
      .prepare(
        "SELECT id, title, severity, link_report_id, created_at FROM support_issues WHERE ticket_id = ?",
      )
      .bind(row.id)
      .first<{
        id: number;
        title: string;
        severity: string;
        link_report_id: string | null;
        created_at: number;
      }>(),
    row.assigned_to
      ? db
          .prepare("SELECT id, name FROM admin_users WHERE id = ?")
          .bind(row.assigned_to)
          .first<{ id: string; name: string }>()
      : null,
  ]);
  const status = adminStatus(row.status);
  const me = c.get("admin").id;
  const requesterOut = requester
    ? {
        id: requester.id,
        name: requester.name,
        email: requester.email,
        joinedAt: requester.createdAt,
        pathsCount: requester.paths,
        pastRequests: past?.n ?? 0,
        // names the portal reads
        paths: `${requester.paths} started`,
        pastTotal: past?.n ?? 0,
        pastResolved: past?.resolved ?? 0,
      }
    : null;
  return c.json({
    ticket: {
      id: row.id,
      kind: row.kind,
      category: row.category,
      subject: row.subject,
      status,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      closedAt: isoOrNull(row.closed_at),
      context:
        row.context_resource || row.context_where || row.context_link
          ? { resource: row.context_resource, where: row.context_where, link: row.context_link }
          : null,
      sla: sla(row, now),
      resolvesAt:
        status === "waiting_on_user" && row.waiting_since !== null
          ? iso(row.waiting_since + AUTO_RESOLVE_DAYS * DAY)
          : null,
      isNew: status === "open" && row.first_reply_at === null,
      dueAt: isoOrNull(row.due_at),
      overdue: sla(row, now).overdue,
      assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
      assignedToMe: row.assigned_to === me,
      autoResolveDays: status === "waiting_on_user" ? AUTO_RESOLVE_DAYS : null,
      attached: [
        row.context_resource && `Resource: ${row.context_resource}`,
        row.context_where && `Where: ${row.context_where}`,
        row.context_link && `Page link: ${row.context_link}`,
      ].filter((x): x is string => !!x),
      issue: issue ? { id: issue.id, title: issue.title, severity: issue.severity } : null,
      // Link reports (review queues) are not built yet: only the reference is known.
      linkReport: issue?.link_report_id
        ? { id: issue.link_report_id, title: "Link report", reports: 1 }
        : null,
      requester: requesterOut,
      messages: messages.results.map((m) => ({
        id: m.id,
        name: (m.author === "user" ? requester?.name : m.admin_name) ?? "Support",
        channel: m.author === "staff" ? "Sent by email and in the app" : null,
        author: m.author === "user" ? "learner" : m.author,
        authorName: m.author === "user" ? (requester?.name ?? null) : m.admin_name,
        body: m.body,
        at: iso(m.created_at),
      })),
      linkedIssue: issue
        ? {
            id: issue.id,
            title: issue.title,
            severity: issue.severity,
            linkReportId: issue.link_report_id,
            createdAt: iso(issue.created_at),
          }
        : null,
    },
    requester: requesterOut,
  });
});

// POST /support/:id/note {body}: internal, never shown to the learner, no status change.
adminSupportInbox.post("/:id/note", requireAdmin("support_inbox", "manage"), async (c) => {
  const t = await target(c);
  if (t.res) return t.res;
  const body = await parseBody(c, adminNoteSchema);
  if (!body) return invalid(c);
  const blocked = await limited(
    c,
    `admin-support:admin:${c.get("admin").id}`,
    LIMITS.adminSupportWrite,
    "admin_support_write",
  );
  if (blocked) return blocked;
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    "INSERT INTO support_messages (id, ticket_id, author, body, created_at, admin_id) VALUES (?, ?, 'note', ?, ?, ?)",
  )
    .bind(id, t.row.id, body.body, now, c.get("admin").id)
    .run();
  await audit(c, "admin.support.note", t.row.id, { kind: t.row.kind });
  return c.json(
    {
      note: {
        id,
        author: "note",
        authorName: c.get("admin").name,
        body: body.body,
        at: iso(now),
      },
    },
    201,
  );
});

// POST /support/:id/log {title, severity, linkReportId?}: report tickets only; the request stays open.
adminSupportInbox.post("/:id/log", requireAdmin("support_inbox", "manage"), async (c) => {
  const t = await target(c);
  if (t.res) return t.res;
  const body = await parseBody(c, adminLogIssueSchema);
  if (!body) return invalid(c);
  if (t.row.kind !== "report")
    return c.json(authError("not_a_report", "Only problem reports can be logged."), 409);
  if ((CLOSED as readonly string[]).includes(t.row.status))
    return c.json(authError("ticket_closed", "This ticket is already closed."), 409);
  const now = Math.floor(Date.now() / 1000);
  const made = await c.env.DB.prepare(
    `INSERT INTO support_issues (ticket_id, title, severity, link_report_id, created_by, created_at,
       description, area, notify_requester)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (ticket_id) DO NOTHING RETURNING id`,
  )
    .bind(
      t.row.id,
      body.title,
      body.severity,
      body.linkReportId ?? null,
      c.get("admin").id,
      now,
      body.description ?? null,
      body.area ?? null,
      body.notifyRequester === false ? 0 : 1,
    )
    .first<{ id: number }>();
  if (!made) return c.json(authError("already_logged", "This request is already logged."), 409);
  await audit(c, "admin.support.issue_logged", t.row.id, {
    issueId: made.id,
    severity: body.severity,
  });
  return c.json(
    {
      issueId: made.id,
      issue: {
        id: made.id,
        title: body.title,
        severity: body.severity,
        linkReportId: body.linkReportId ?? null,
        createdAt: iso(now),
      },
    },
    201,
  );
});

// POST /support/:id/assign {to: "me" | "nobody"}
adminSupportInbox.post("/:id/assign", requireAdmin("support_inbox", "manage"), async (c) => {
  const t = await target(c);
  if (t.res) return t.res;
  const body = await parseBody(c, adminAssignSchema);
  if (!body) return invalid(c);
  const to = body.to === "me" ? c.get("admin").id : null;
  await c.env.DB.prepare("UPDATE support_tickets SET assigned_to = ? WHERE id = ?")
    .bind(to, t.row.id)
    .run();
  await audit(c, "admin.support.assigned", t.row.id, { to: body.to });
  return c.json({ assigned: body.to });
});
