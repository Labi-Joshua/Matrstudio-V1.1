import { iso, type Period, sevenBuckets } from "./range";

// Aggregates over one bounded period. Every query is served by an index added in migration 0015
// (or an existing one) and reads only the period's rows. ISO text columns compare as strings.

const first = async <T>(db: D1Database, sql: string, ...args: unknown[]) =>
  db
    .prepare(sql)
    .bind(...args)
    .first<T>();
const n = async (db: D1Database, sql: string, ...args: unknown[]) =>
  (await first<{ n: number }>(db, sql, ...args))?.n ?? 0;

const iv = (p: Period) => [iso(p.start), iso(p.end)] as const;

export const newLearners = (db: D1Database, p: Period) =>
  n(db, "SELECT COUNT(*) AS n FROM user WHERE createdAt >= ?1 AND createdAt < ?2", ...iv(p));

export const pathCompletions = (db: D1Database, p: Period) =>
  n(
    db,
    "SELECT COUNT(*) AS n FROM path_enrolments WHERE completed_at >= ?1 AND completed_at < ?2",
    ...iv(p),
  );

// "Active" = a learner who refreshed a session, finished a lesson or touched a path in the period.
const ACTIVITY = `SELECT userId AS uid, updatedAt AS ts FROM session WHERE updatedAt >= ?1 AND updatedAt < ?2
  UNION ALL SELECT user_id, completed_at FROM path_lessons_done WHERE completed_at >= ?1 AND completed_at < ?2
  UNION ALL SELECT user_id, last_activity_at FROM path_enrolments WHERE last_activity_at >= ?1 AND last_activity_at < ?2`;

export const activeLearners = (db: D1Database, p: Period) =>
  n(db, `SELECT COUNT(DISTINCT uid) AS n FROM (${ACTIVITY})`, ...iv(p));

export async function activeSeries(db: D1Database, p: Period, bucket: number) {
  const rows = await db
    .prepare(
      `SELECT CAST((unixepoch(ts) - ?3) / ?4 AS INTEGER) AS b, COUNT(DISTINCT uid) AS n
         FROM (${ACTIVITY}) GROUP BY b`,
    )
    .bind(...iv(p), p.start, bucket)
    .all<{ b: number; n: number }>();
  return sevenBuckets(rows.results);
}

export async function signupSeries(db: D1Database, p: Period, bucket: number) {
  const rows = await db
    .prepare(
      `SELECT CAST((unixepoch(createdAt) - ?3) / ?4 AS INTEGER) AS b, COUNT(*) AS n
         FROM user WHERE createdAt >= ?1 AND createdAt < ?2 GROUP BY b`,
    )
    .bind(...iv(p), p.start, bucket)
    .all<{ b: number; n: number }>();
  return sevenBuckets(rows.results);
}

export async function ticketSeries(
  db: D1Database,
  p: Period,
  bucket: number,
  col: "created_at" | "closed_at",
) {
  const rows = await db
    .prepare(
      `SELECT CAST((${col} - ?3) / ?4 AS INTEGER) AS b, COUNT(*) AS n
         FROM support_tickets WHERE ${col} >= ?1 AND ${col} < ?2 GROUP BY b`,
    )
    .bind(p.start, p.end, p.start, bucket)
    .all<{ b: number; n: number }>();
  return sevenBuckets(rows.results);
}

export type SupportAgg = {
  opened: number;
  resolved: number;
  avgFirstReplyHours: number | null;
  repliedWithinTargetPct: number | null;
};

export async function supportAgg(db: D1Database, p: Period): Promise<SupportAgg> {
  const r = await first<{
    opened: number;
    replied: number;
    within: number;
    avg_s: number | null;
  }>(
    db,
    `SELECT COUNT(*) AS opened, COUNT(first_reply_at) AS replied,
            COALESCE(SUM(first_reply_at <= due_at), 0) AS within,
            AVG(first_reply_at - created_at) AS avg_s
       FROM support_tickets WHERE created_at >= ?1 AND created_at < ?2`,
    p.start,
    p.end,
  );
  const resolved = await n(
    db,
    "SELECT COUNT(*) AS n FROM support_tickets WHERE closed_at >= ?1 AND closed_at < ?2",
    p.start,
    p.end,
  );
  return {
    opened: r?.opened ?? 0,
    resolved,
    avgFirstReplyHours: r?.avg_s == null ? null : Math.round((r.avg_s / 3600) * 10) / 10,
    repliedWithinTargetPct: r?.replied ? Math.round(((r.within ?? 0) / r.replied) * 100) : null,
  };
}

export const openRequests = (db: D1Database) =>
  n(
    db,
    "SELECT COUNT(*) AS n FROM support_tickets WHERE status IN ('open', 'replied', 'waiting_on_user')",
  );

export const overdueRequests = (db: D1Database, now: number) =>
  n(
    db,
    `SELECT COUNT(*) AS n FROM support_tickets
      WHERE status = 'open' AND first_reply_at IS NULL AND due_at IS NOT NULL AND due_at < ?1`,
    now,
  );

export const submissionsWaiting = (db: D1Database) =>
  n(db, "SELECT COUNT(*) AS n FROM resource_submissions WHERE status = 'in_review'");

export const submissionsWaitingOver = (db: D1Database, cutoff: number) =>
  n(
    db,
    "SELECT COUNT(*) AS n FROM resource_submissions WHERE status = 'in_review' AND created_at < ?1",
    cutoff,
  );

/** Counts from tables another builder owns (resources, paths); null when the table is not there. */
export async function optionalCount(db: D1Database, sql: string): Promise<number | null> {
  try {
    return await n(db, sql);
  } catch {
    return null;
  }
}
