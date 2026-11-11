import type { SupportMessage, SupportStatus, SupportTicket } from "@matr/types";

export const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const CLOSED: readonly SupportStatus[] = ["resolved", "fixed", "cant_reproduce"];

export type TicketRow = {
  id: string;
  user_id: string;
  kind: "support" | "report";
  category: string | null;
  subject: string;
  status: SupportStatus;
  created_at: number;
  updated_at: number;
  context_resource: string | null;
  context_where: string | null;
  context_link: string | null;
  message_count: number;
};
type MessageRow = { id: string; author: "user" | "staff"; body: string; created_at: number };

export const TICKET_SELECT = `SELECT t.id, t.user_id, t.kind, t.category, t.subject, t.status, t.created_at, t.updated_at,
  t.context_resource, t.context_where, t.context_link,
  (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) AS message_count
  FROM support_tickets t`;

const iso = (s: number) => new Date(s * 1000).toISOString();

export function toTicket(r: TicketRow, messages?: MessageRow[]): SupportTicket {
  const hasContext = r.context_resource || r.context_where || r.context_link;
  return {
    id: r.id,
    kind: r.kind,
    category: r.category,
    subject: r.subject,
    status: r.status,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    messageCount: r.message_count,
    context: hasContext
      ? { resource: r.context_resource, where: r.context_where, link: r.context_link }
      : null,
    ...(messages
      ? {
          messages: messages.map(
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
      "SELECT id, author, body, created_at FROM support_messages WHERE ticket_id = ? ORDER BY created_at, rowid",
    )
    .bind(id)
    .all<MessageRow>();
  return { row, ticket: toTicket(row, msgs.results) };
}
