import { newId } from "../content/common";
import { safeFetch } from "../content/safe-fetch";
import type { Bindings } from "../env";

/** Resources checked per 30-minute tick, so one run stays far below the subrequest limit. */
export const LINK_CHECKS_PER_RUN = 20;
/** A resource is due again after this long. */
export const LINK_CHECK_EVERY_SECONDS = 23 * 3600;
const KEEP_DAYS = 90;
/** A link is marked "needs fix" after this many failed checks in a row. */
export const FAILS_BEFORE_NEEDS_FIX = 2;

type Due = { id: string; url: string; status: string };

/**
 * Scheduled link check (index.ts runs it on every tick). Checks live and needs-fix resources that
 * have not been checked for a day, oldest first, and writes one link_checks row each. Two failed
 * checks in a row move a live resource to needs_fix; a pass moves a needs_fix one back to live.
 * Every fetch goes through safeFetch (https only, no private hosts, capped time, no body kept).
 */
export async function runLinkChecks(
  env: Pick<Bindings, "DB">,
  opts: { limit?: number; now?: number } = {},
): Promise<{ checked: number; failed: number }> {
  const db = env.DB;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const due = await db
    .prepare(
      `SELECT r.id, r.url, r.status FROM resources r
        WHERE r.status IN ('live', 'needs_fix')
          AND COALESCE((SELECT MAX(checked_at) FROM link_checks c WHERE c.resource_id = r.id), 0) < ?1
        ORDER BY COALESCE((SELECT MAX(checked_at) FROM link_checks c WHERE c.resource_id = r.id), 0), r.id
        LIMIT ?2`,
    )
    .bind(now - LINK_CHECK_EVERY_SECONDS, opts.limit ?? LINK_CHECKS_PER_RUN)
    .all<Due>();

  let failed = 0;
  for (const r of due.results) {
    const res = await safeFetch(r.url);
    await db
      .prepare(
        "INSERT INTO link_checks (id, resource_id, checked_at, ok, http_status, reason) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(newId(), r.id, now, res.ok ? 1 : 0, res.status, res.reason)
      .run();
    if (!res.ok) failed++;
    if (res.ok && r.status === "needs_fix") {
      await db
        .prepare(
          "UPDATE resources SET status = 'live', updated_at = ?2 WHERE id = ?1 AND status = 'needs_fix'",
        )
        .bind(r.id, now)
        .run();
    } else if (!res.ok && r.status === "live") {
      const recent = await db
        .prepare(
          "SELECT ok FROM link_checks WHERE resource_id = ? ORDER BY checked_at DESC, rowid DESC LIMIT ?",
        )
        .bind(r.id, FAILS_BEFORE_NEEDS_FIX)
        .all<{ ok: number }>();
      if (
        recent.results.length >= FAILS_BEFORE_NEEDS_FIX &&
        recent.results.every((c) => c.ok === 0)
      )
        await db
          .prepare(
            "UPDATE resources SET status = 'needs_fix', updated_at = ?2 WHERE id = ?1 AND status = 'live'",
          )
          .bind(r.id, now)
          .run();
    }
  }
  await db
    .prepare("DELETE FROM link_checks WHERE checked_at < ?")
    .bind(now - KEEP_DAYS * 86400)
    .run();
  return { checked: due.results.length, failed };
}
