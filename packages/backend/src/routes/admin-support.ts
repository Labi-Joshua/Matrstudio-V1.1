import { adminSupportStatusSchema, supportFollowUpSchema } from "@matr/types";
import { type Context, Hono } from "hono";
import { type AdminCtx, requireAdmin } from "../auth/admin-guard";
import { writeAudit } from "../auth/audit";
import { authError } from "../auth/guard";
import { clientIp } from "../auth/util";
import { createNotification } from "../notifications/create";
import { enqueueAuthEmail } from "../queue/auth-email";
import { CLOSED, ID_PATTERN, loadTicket, type TicketRow } from "../support/tickets";

// Mounted by routes/admin.ts after requireAccess (lock 1); requireAdmin adds lock 2 and the role check.
export const adminSupport = new Hono<AdminCtx>();

type C = Context<AdminCtx>;
const href = (id: string) => `/learn/help?ticket=${id}`;
const invalid = (c: C) =>
  c.json(authError("invalid_request", "Check the details you entered."), 400);
const closed = (c: C) => c.json(authError("ticket_closed", "This ticket is already closed."), 409);

async function target(
  c: C,
): Promise<{ res: Response } | { res?: undefined; id: string; row: TicketRow }> {
  const id = c.req.param("id") ?? "";
  if (!ID_PATTERN.test(id))
    return { res: c.json(authError("invalid_request", "That ticket id isn't valid."), 400) };
  const found = await loadTicket(c.env.DB, id);
  if (!found) return { res: c.json(authError("not_found", "Ticket not found."), 404) };
  if (CLOSED.includes(found.row.status)) return { res: closed(c) };
  return { id, row: found.row };
}

const learnerEmail = (c: C, userId: string) =>
  c.env.DB.prepare("SELECT email FROM user WHERE id = ?").bind(userId).first<{ email: string }>();

const audit = (
  c: C,
  action: "support.replied" | "support.status_changed",
  id: string,
  meta: Record<string, string>,
) =>
  writeAudit(c.env.DB, {
    actor: c.get("admin").id,
    action,
    target: id,
    ip: clientIp(c.req.raw.headers),
    ua: c.req.header("user-agent"),
    meta,
  });

adminSupport.post("/:id/reply", requireAdmin("support_inbox", "manage"), async (c) => {
  const t = await target(c);
  if (t.res) return t.res;
  const parsed = supportFollowUpSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalid(c);
  const { message } = parsed.data;
  const now = Math.floor(Date.now() / 1000);
  const db = c.env.DB;
  // Atomic: only a still-open ticket takes a reply.
  const changed = await db
    .prepare(
      "UPDATE support_tickets SET status = 'replied', updated_at = ?2 WHERE id = ?1 AND status IN ('open', 'replied')",
    )
    .bind(t.id, now)
    .run();
  if (!changed.meta.changes) return closed(c);
  await db
    .prepare(
      "INSERT INTO support_messages (id, ticket_id, author, body, created_at) VALUES (?, ?, 'staff', ?, ?)",
    )
    .bind(crypto.randomUUID(), t.id, message, now)
    .run();
  await createNotification(db, {
    userId: t.row.user_id,
    kind: "support-reply",
    title: "Support replied to you",
    body: message,
    href: href(t.id),
  });
  const to = await learnerEmail(c, t.row.user_id);
  if (to)
    await enqueueAuthEmail(c.env, {
      type: "support-reply",
      to: to.email,
      subject: t.row.subject,
      message,
    });
  await audit(c, "support.replied", t.id, { kind: t.row.kind, status: "replied" });
  return c.json({ ticket: (await loadTicket(db, t.id))?.ticket });
});

adminSupport.post("/:id/status", requireAdmin("support_inbox", "manage"), async (c) => {
  const t = await target(c);
  if (t.res) return t.res;
  const parsed = adminSupportStatusSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalid(c);
  const { status } = parsed.data;
  // "fixed" and "can't reproduce" are outcomes of a bug report only.
  if (t.row.kind === "support" && status !== "resolved") return invalid(c);
  const db = c.env.DB;
  const changed = await db
    .prepare(
      "UPDATE support_tickets SET status = ?2, updated_at = ?3 WHERE id = ?1 AND status IN ('open', 'replied')",
    )
    .bind(t.id, status, Math.floor(Date.now() / 1000))
    .run();
  if (!changed.meta.changes) return closed(c);
  const copy = {
    resolved: ["support-reply", "Your message was resolved"],
    fixed: ["report-fixed", "We fixed what you reported"],
    cant_reproduce: ["report-cant-reproduce", "We couldn’t reproduce your report"],
  } as const;
  const [kind, title] = copy[status];
  await createNotification(db, {
    userId: t.row.user_id,
    kind,
    title,
    body: t.row.subject,
    href: href(t.id),
  });
  const to = await learnerEmail(c, t.row.user_id);
  if (to)
    await enqueueAuthEmail(c.env, {
      type: "support-closed",
      to: to.email,
      subject: t.row.subject,
      status,
    });
  await audit(c, "support.status_changed", t.id, {
    kind: t.row.kind,
    before: t.row.status,
    status,
  });
  return c.json({ ticket: (await loadTicket(db, t.id))?.ticket });
});
