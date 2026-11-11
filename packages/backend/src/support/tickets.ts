import type { SupportMessage, SupportStatus, SupportTicket } from "@matr/types";

export const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Statuses as stored. The learner API never shows waiting_on_user: it keeps saying "replied". */
export type TicketStatus = SupportStatus | "waiting_on_user";
export const CLOSED: readonly TicketStatus[] = ["resolved", "fixed", "cant_reproduce"];
/** Still open for staff and learner: a reply, note or status change applies. */
export const LIVE_SQL = "('open', 'replied', 'waiting_on_user')";

export type TicketRow = {
  id: string;
  user_id: string;
  kind: "support" | "report";
  category: string | null;
  subject: string;
  status: TicketStatus;
  created_at: number;
  updated_at: number;
  context_resource: string | null;
  context_where: string | null;
  context_link: string | null;
  message_count: number;
  due_at: number | null;
  first_reply_at: number | null;
  waiting_since: number | null;
  closed_at: number | null;
  assigned_to: string | null;
};
type MessageRow = {
  id: string;
  author: "user" | "staff" | "note";
  body: string;
  created_at: number;
};

// message_count leaves out internal notes: the learner must not learn they exist.
export const TICKET_SELECT = `SELECT t.id, t.user_id, t.kind, t.category, t.subject, t.status, t.created_at, t.updated_at,
  t.context_resource, t.context_where, t.context_link, t.due_at, t.first_reply_at, t.waiting_since, t.closed_at, t.assigned_to,
  (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id AND m.author <> 'note') AS message_count
  FROM support_tickets t`;

const iso = (s: number) => new Date(s * 1000).toISOString();

export function toTicket(r: TicketRow, messages?: MessageRow[]): SupportTicket {
  const hasContext = r.context_resource || r.context_where || r.context_link;
  return {
    id: r.id,
    kind: r.kind,
    category: r.category,
    subject: r.subject,
    status: r.status === "waiting_on_user" ? "replied" : r.status,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    messageCount: r.message_count,
    context: hasContext
      ? { resource: r.context_resource, where: r.context_where, link: r.context_link }
      : null,
    ...(messages
      ? {
          messages: messages
            .filter((m) => m.author !== "note")
            .map(
              (m): SupportMessage => ({
                id: m.id,
                author: m.author === "user" ? "you" : "support",
                body: m.body,
                createdAt: iso(m.created_at),
              }),
            ),
        }
      : {}),
  };
}

/** A ticket with its messages. `userId` scopes it to its owner (object-level check); omit for staff. */
export async function loadTicket(db: D1Database, id: string, userId?: string) {
  const row = await db
    .prepare(`${TICKET_SELECT} WHERE t.id = ?1 ${userId ? "AND t.user_id = ?2" : ""}`)
    .bind(...(userId ? [id, userId] : [id]))
    .first<TicketRow>();
  if (!row) return null;
  const msgs = await db
    .prepare(
      "SELECT id, author, body, created_at FROM support_messages WHERE ticket_id = ? AND author <> 'note' ORDER BY created_at, rowid",
    )
    .bind(id)
    .all<MessageRow>();
  return { row, ticket: toTicket(row, msgs.results) };
}
