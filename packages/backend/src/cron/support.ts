import { writeAudit } from "../auth/audit";
import type { Bindings } from "../env";
import { createNotification } from "../notifications/create";
import { enqueueAuthEmail } from "../queue/auth-email";
import { AUTO_RESOLVE_DAYS } from "../support/sla";

/**
 * Resolves requests that have waited on the learner for AUTO_RESOLVE_DAYS without a reply (a
 * learner reply moves the request back to "open" and clears waiting_since). One atomic UPDATE
 * claims at most 50 a run (indexed on status, waiting_since); the learner is told in the app and
 * by email. Runs on every 30-minute tick: with nothing due it is one index read.
 */
export async function autoResolveWaiting(env: Bindings, now = Math.floor(Date.now() / 1000)) {
  const due = await env.DB.prepare(
    `UPDATE support_tickets SET status = 'resolved', updated_at = ?1, closed_at = ?1, waiting_since = NULL
      WHERE id IN (SELECT id FROM support_tickets
                    WHERE status IN ('waiting_on_user', 'replied') AND waiting_since IS NOT NULL
                      AND waiting_since <= ?2 LIMIT 50)
        AND status IN ('waiting_on_user', 'replied')
      RETURNING id, user_id, subject, kind`,
  )
    .bind(now, now - AUTO_RESOLVE_DAYS * 86400)
    .all<{ id: string; user_id: string; subject: string; kind: string }>();
  for (const t of due.results) {
    await createNotification(env.DB, {
      userId: t.user_id,
      kind: "support-reply",
      title: "Your message was resolved",
      body: `${t.subject}: we closed it after 7 days without a reply. Write again any time.`,
      href: `/learn/help?ticket=${t.id}`,
    });
    const to = await env.DB.prepare("SELECT email FROM user WHERE id = ?")
      .bind(t.user_id)
      .first<{ email: string }>();
    if (to)
      await enqueueAuthEmail(env, {
        type: "support-closed",
        to: to.email,
        subject: t.subject,
        status: "resolved",
      });
    await writeAudit(env.DB, {
      action: "support.auto_resolved",
      target: t.id,
      meta: { kind: t.kind },
    });
  }
  return due.results.length;
}
