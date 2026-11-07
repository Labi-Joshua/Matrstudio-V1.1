import { truncateIp } from "./util";

// Append-only audit log (migration 0004: BEFORE UPDATE / DELETE triggers abort). Rows hold no
// emails, passwords or tokens: actors and targets are user ids or keyed email hashes, IPs are
// truncated, and meta is a small JSON object the caller keeps free of secrets.
export type AuditAction =
  | "signin.success"
  | "signin.failure"
  | "signup"
  | "magic_link.sent"
  | "magic_link.used"
  | "session.revoked"
  | "password_reset.requested"
  | "password_reset.completed"
  | "password.changed"
  | "email.verified"
  | "email.changed"
  | "invite.created"
  | "invite.accepted"
  | "rate_limit.hit"
  | "turnstile.failed"
  | "pwned_check.unavailable"
  | "email.dropped"
  | "account.deleted";

export type AuditEntry = {
  actor?: string | null;
  action: AuditAction;
  target?: string | null;
  ip?: string | null;
  ua?: string | null;
  meta?: Record<string, string | number | boolean | null>;
};

export async function writeAudit(db: D1Database, e: AuditEntry): Promise<void> {
  try {
    await db
      .prepare(
        "INSERT INTO audit_log (actor, action, target, ip, ua, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, unixepoch())",
      )
      .bind(
        e.actor ?? null,
        e.action,
        e.target ?? null,
        truncateIp(e.ip) || null,
        e.ua ? e.ua.slice(0, 200) : null,
        JSON.stringify(e.meta ?? {}),
      )
      .run();
  } catch (err) {
    // Never let logging break a request, and never log the entry itself.
    console.error("audit write failed", err instanceof Error ? err.name : "error");
  }
}
