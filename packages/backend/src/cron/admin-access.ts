import { revokeAdminSessions } from "../auth/admin-perms";
import { writeAudit } from "../auth/audit";
import type { Bindings } from "../env";
import { createAdminNotification } from "../notifications/admin";

const REMIND_BEFORE_SECONDS = 3 * 86400;
const KEEP_NOTIFICATIONS_SECONDS = 90 * 86400;
const BATCH = 50;

/**
 * Temporary access (migration 0013). The hard stop is in loadAdminSession and sign-in, which refuse an
 * admin past `access_expires_at` on every request. This tick adds the housekeeping: a bell notice
 * 3 days before the end, and at the end the sessions are deleted and an audit row is written.
 * `access_notice` makes each step happen once per expiry date. Returns how many were handled.
 */
export async function runAdminAccessTick(
  env: Bindings,
  now = Math.floor(Date.now() / 1000),
): Promise<{ reminded: number; expired: number }> {
  const db = env.DB;
  const result = { reminded: 0, expired: 0 };

  const ending = await db
    .prepare(
      `SELECT id, name FROM admin_users
        WHERE status = 'active' AND access_notice = 0 AND access_expires_at > ? AND access_expires_at <= ?
        LIMIT ${BATCH}`,
    )
    .bind(now, now + REMIND_BEFORE_SECONDS)
    .all<{ id: string; name: string }>();
  for (const a of ending.results) {
    const claimed = await db
      .prepare("UPDATE admin_users SET access_notice = 1 WHERE id = ? AND access_notice = 0")
      .bind(a.id)
      .run();
    if (!claimed.meta.changes) continue;
    await createAdminNotification(db, {
      kind: "access-ending",
      title: `${a.name}’s temporary access ends in 3 days`,
      body: "Set a new end date or make their access permanent if they should stay.",
      href: `/team/detail?id=${a.id}`,
      area: "admin_team",
    });
    result.reminded++;
  }

  const ended = await db
    .prepare(
      `SELECT id, name FROM admin_users
        WHERE status = 'active' AND access_notice < 2 AND access_expires_at IS NOT NULL AND access_expires_at <= ?
        LIMIT ${BATCH}`,
    )
    .bind(now)
    .all<{ id: string; name: string }>();
  for (const a of ended.results) {
    const claimed = await db
      .prepare("UPDATE admin_users SET access_notice = 2 WHERE id = ? AND access_notice < 2")
      .bind(a.id)
      .run();
    if (!claimed.meta.changes) continue;
    await revokeAdminSessions(env, a.id, { reason: "access_expired" });
    await writeAudit(db, { action: "admin.access.expired", target: a.id });
    await createAdminNotification(db, {
      kind: "access-ended",
      title: `${a.name}’s temporary access has ended`,
      body: "They are signed out. Set a new end date to let them back in.",
      href: `/team/detail?id=${a.id}`,
      area: "admin_team",
    });
    result.expired++;
  }

  await db
    .prepare("DELETE FROM admin_notifications WHERE created_at < ?")
    .bind(now - KEEP_NOTIFICATIONS_SECONDS)
    .run();
  return result;
}
