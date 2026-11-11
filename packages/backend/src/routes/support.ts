import {
  createSupportTicketSchema,
  type SupportErrorBody,
  supportFollowUpSchema,
} from "@matr/types";
import { Hono } from "hono";
import type { z } from "zod";
import { writeAudit } from "../auth/audit";
import { type AuthedEnv, authError, can } from "../auth/guard";
import { hit, LIMITS } from "../auth/limits";
import { verifyTurnstile } from "../auth/turnstile";
import { clientIp, truncateIp } from "../auth/util";
import { enqueueAuthEmail } from "../queue/auth-email";
import { addWorkingDays, FIRST_REPLY_WORKING_DAYS } from "../support/sla";
import {
  ID_PATTERN,
  loadTicket,
  TICKET_SELECT,
  type TicketRow,
  toTicket,
} from "../support/tickets";

// Mounted by routes/me.ts, so requireSession (and requireAuthSecret on /api/me/*) already ran.
export const support = new Hono<AuthedEnv>();

const err = (code: SupportErrorBody["code"], message: string, extra = {}) =>
  authError(code, message, extra);

const FIELDS = ["kind", "category", "subject", "message", "context"];
function invalidRequest(error: z.ZodError) {
  const fe: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (FIELDS.includes(key) && !fe[key]) fe[key] = "Check this field.";
  }
  return err(
    "invalid_request",
    "Check the details you entered.",
    Object.keys(fe).length ? { fieldErrors: fe } : {},
  );
}

// Own rows only: the user id comes from the session, never from the request.
support.get("/", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "view")) return c.json(err("unauthorized", "Not allowed."), 403);
  const rows = await c.env.DB.prepare(
    `${TICKET_SELECT} WHERE t.user_id = ? ORDER BY t.created_at DESC, t.rowid DESC LIMIT 100`,
  )
    .bind(user.id)
    .all<TicketRow>();
  return c.json({ tickets: rows.results.map((r) => toTicket(r)) });
});

support.get("/:id", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "view")) return c.json(err("unauthorized", "Not allowed."), 403);
  const id = c.req.param("id");
  if (!ID_PATTERN.test(id))
    return c.json(err("invalid_request", "That ticket id isn't valid."), 400);
  const found = await loadTicket(c.env.DB, id, user.id);
  if (!found) return c.json(err("not_found", "We couldn't find that message."), 404);
  return c.json({ ticket: found.ticket });
});

support.post("/", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "manage")) return c.json(err("unauthorized", "Not allowed."), 403);
  const parsed = createSupportTicketSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(invalidRequest(parsed.error), 400);
  const { kind, category, message, context } = parsed.data;
  const subject = parsed.data.subject ?? (kind === "report" ? "Report" : message.slice(0, 60));

  const h = c.req.raw.headers;
  const ip = clientIp(h);
  const ua = h.get("user-agent");
  const db = c.env.DB;
  for (const [key, rule, scope] of [
    [`support:user:${user.id}`, LIMITS.supportUser, "support_user"],
    [`support:ip:${truncateIp(ip) || "unknown"}`, LIMITS.supportIp, "support_ip"],
  ] as const) {
    const r = await hit(db, key, rule);
    if (!r.allowed) {
      await writeAudit(db, { actor: user.id, action: "rate_limit.hit", ip, ua, meta: { scope } });
      c.header("Retry-After", String(r.retryAfterSec));
      return c.json(
        err("rate_limited", "You've sent a lot of messages. Try again later.", {
          retryAfterSeconds: r.retryAfterSec,
        }),
        429,
      );
    }
  }

  const token = h.get("x-captcha-response");
  const captcha = await verifyTurnstile(c.env, token, ip);
  if (captcha === "unavailable")
    return c.json(
      err("captcha_unavailable", "We couldn't check that you're human. Try again shortly."),
      503,
    );
  if (captcha === "failed") {
    await writeAudit(db, {
      actor: user.id,
      action: "turnstile.failed",
      ip,
      ua,
      meta: { missing: !token },
    });
    return c.json(
      err(
        token ? "captcha_failed" : "captcha_required",
        token ? "Captcha failed. Try again." : "Complete the captcha to continue.",
      ),
      400,
    );
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await db.batch([
    db
      .prepare(
        `INSERT INTO support_tickets (id, user_id, kind, category, subject, status, created_at, updated_at,
           context_resource, context_where, context_link, due_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'open', ?6, ?6, ?7, ?8, ?9, ?10)`,
      )
      .bind(
        id,
        user.id,
        kind,
        category ?? null,
        subject,
        now,
        context?.resource ?? null,
        context?.where ?? null,
        context?.link ?? null,
        addWorkingDays(now, FIRST_REPLY_WORKING_DAYS),
      ),
    db
      .prepare(
        "INSERT INTO support_messages (id, ticket_id, author, body, created_at) VALUES (?, ?, 'user', ?, ?)",
      )
      .bind(crypto.randomUUID(), id, message, now),
  ]);
  await writeAudit(db, {
    actor: user.id,
    action: "support.created",
    target: id,
    ip,
    ua,
    meta: { kind, status: "open" },
  });
  await enqueueAuthEmail(c.env, { type: "support-received", to: user.email, subject, kind });
  const found = await loadTicket(db, id, user.id);
  if (!found) throw new Error("ticket insert returned no row");
  return c.json({ ticket: found.ticket }, 201);
});

support.post("/:id/messages", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "manage")) return c.json(err("unauthorized", "Not allowed."), 403);
  const id = c.req.param("id");
  if (!ID_PATTERN.test(id))
    return c.json(err("invalid_request", "That ticket id isn't valid."), 400);
  const parsed = supportFollowUpSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(invalidRequest(parsed.error), 400);

  const db = c.env.DB;
  const ip = clientIp(c.req.raw.headers);
  const ua = c.req.raw.headers.get("user-agent");
  const r = await hit(db, `support-message:user:${user.id}`, LIMITS.supportMessageUser);
  if (!r.allowed) {
    await writeAudit(db, {
      actor: user.id,
      action: "rate_limit.hit",
      ip,
      ua,
      meta: { scope: "support_message_user" },
    });
    c.header("Retry-After", String(r.retryAfterSec));
    return c.json(
      err("rate_limited", "You've sent a lot of messages. Try again later.", {
        retryAfterSeconds: r.retryAfterSec,
      }),
      429,
    );
  }

  const now = Math.floor(Date.now() / 1000);
  // One atomic statement, scoped to the caller and to a ticket that is still open.
  const reopened = await db
    .prepare(
      `UPDATE support_tickets SET status = 'open', waiting_since = NULL, updated_at = ?3
        WHERE id = ?1 AND user_id = ?2 AND status IN ('open', 'replied', 'waiting_on_user') RETURNING kind`,
    )
    .bind(id, user.id, now)
    .first<{ kind: string }>();
  if (!reopened) {
    const own = await db
      .prepare("SELECT status FROM support_tickets WHERE id = ? AND user_id = ?")
      .bind(id, user.id)
      .first<{ status: string }>();
    if (!own) return c.json(err("not_found", "We couldn't find that message."), 404);
    return c.json(err("ticket_closed", "This message is closed. Send a new one instead."), 409);
  }
  await db
    .prepare(
      "INSERT INTO support_messages (id, ticket_id, author, body, created_at) VALUES (?, ?, 'user', ?, ?)",
    )
    .bind(crypto.randomUUID(), id, parsed.data.message, now)
    .run();
  await writeAudit(db, {
    actor: user.id,
    action: "support.message",
    target: id,
    ip,
    ua,
    meta: { kind: reopened.kind, status: "open" },
  });
  const found = await loadTicket(db, id, user.id);
  if (!found) throw new Error("ticket vanished");
  return c.json({ ticket: found.ticket }, 201);
});
