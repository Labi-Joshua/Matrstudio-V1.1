import type { Bindings } from "../env";

/**
 * Unconfirmed sign-ups are deleted after this many days (stated in the Privacy Policy,
 * "How long we keep it"). Counted from updated_at, i.e. the last confirmation link sent, so
 * someone who asked for a fresh link recently is not removed.
 */
export const UNCONFIRMED_RETENTION_DAYS = 30;

/** Runs once a day (the 03:00 UTC tick of the 30-minute cron) so the scan stays cheap. */
export function isCleanupTick(scheduledTime: number): boolean {
  const at = new Date(scheduledTime);
  return at.getUTCHours() === 3 && at.getUTCMinutes() < 30;
}

export async function deleteStaleUnconfirmed(env: Bindings): Promise<number> {
  const res = await env.DB.prepare(
    `DELETE FROM waitlist_subscribers
      WHERE status = 'pending' AND updated_at < unixepoch() - ?1`,
  )
    .bind(UNCONFIRMED_RETENTION_DAYS * 24 * 3600)
    .run();
  const removed = res.meta.changes ?? 0;
  if (removed > 0) {
    // Keep the public "N people joined" counter in step with the table.
    await env.DB.prepare("UPDATE waitlist_stats SET total = MAX(total - ?1, 0) WHERE id = 1")
      .bind(removed)
      .run();
  }
  return removed;
}
