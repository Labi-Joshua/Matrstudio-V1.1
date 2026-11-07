// D1-backed fixed-window counters (the Workers Rate Limiting binding only supports 10 s and 60 s
// windows). One row per key; the upsert is a single atomic statement. Keys never contain raw
// emails: callers pass keyed hashes (emailRef) and truncated IPs.
export type Limit = { limit: number; windowSec: number };

export const LIMITS = {
  signinEmail: { limit: 5, windowSec: 900 },
  signinIp: { limit: 20, windowSec: 900 },
  magicEmail: { limit: 5, windowSec: 900 },
  magicIp: { limit: 20, windowSec: 900 },
  resetEmail: { limit: 3, windowSec: 3600 },
  signupIp: { limit: 10, windowSec: 3600 },
  /** Read-only link state checks (GET /reset-password/check). */
  linkCheckIp: { limit: 30, windowSec: 900 },
  resendEmail: { limit: 3, windowSec: 3600 },
  /** Wrong-password counter: captcha is required from the 3rd failure. */
  signinFailures: { limit: 3, windowSec: 900 },
  /** One "too many attempts" notice email per window. */
  tooManyNotice: { limit: 1, windowSec: 900 },
} as const satisfies Record<string, Limit>;

export const CAPTCHA_AFTER_FAILURES = 3;

export type HitResult = { allowed: boolean; count: number; retryAfterSec: number };

export async function hit(
  db: D1Database,
  key: string,
  { limit, windowSec }: Limit,
  now = Math.floor(Date.now() / 1000),
): Promise<HitResult> {
  const cutoff = now - windowSec;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, count, window_start) VALUES (?1, 1, ?2)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN window_start <= ?3 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN window_start <= ?3 THEN ?2 ELSE window_start END
       RETURNING count, window_start`,
    )
    .bind(key, now, cutoff)
    .first<{ count: number; window_start: number }>();
  const count = row?.count ?? 1;
  const start = row?.window_start ?? now;
  return { allowed: count <= limit, count, retryAfterSec: Math.max(1, start + windowSec - now) };
}

/** Reads a counter without incrementing it. */
export async function peek(
  db: D1Database,
  key: string,
  { windowSec }: Limit,
  now = Math.floor(Date.now() / 1000),
): Promise<number> {
  const row = await db
    .prepare("SELECT count, window_start FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number; window_start: number }>();
  return row && row.window_start > now - windowSec ? row.count : 0;
}

export async function clear(db: D1Database, key: string): Promise<void> {
  await db.prepare("DELETE FROM rate_limits WHERE key = ?").bind(key).run();
}

/**
 * Housekeeping for the daily cron tick: drops stale counters, expired sessions and single-use
 * records, and invites that expired more than 30 days ago.
 */
export async function purgeStaleLimits(
  db: D1Database,
  now = Math.floor(Date.now() / 1000),
): Promise<void> {
  const iso = new Date(now * 1000).toISOString();
  await db.batch([
    db.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(now - 86400),
    db.prepare("DELETE FROM session WHERE expiresAt < ?").bind(iso),
    db
      .prepare("DELETE FROM verification WHERE expiresAt < ?")
      .bind(new Date((now - 86400) * 1000).toISOString()), // kept a day so expired links differ from unknown ones
    db.prepare("DELETE FROM invites WHERE expires_at < ?").bind(now - 30 * 86400),
  ]);
}
