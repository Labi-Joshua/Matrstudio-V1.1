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
  | "account.deleted"
  // Settings: no personal data in meta (never an address or a password).
  | "email.change_requested"
  | "email.change_cancelled"
  | "password.set"
  | "account.google_unlinked"
  | "prefs.updated"
  | "account.exported"
  // Resource submissions: target is the submission id, meta holds ids and status only.
  | "submission.created"
  | "submission.edited"
  | "submission.reviewed"
  // Support tickets: target is the ticket id, meta holds kind and status only (never the text).
  | "support.created"
  | "support.message"
  | "support.replied"
  | "support.status_changed"
  // Saved resources: target is the catalogue id, no meta.
  | "saved.added"
  | "saved.removed"
  // Profiles: meta holds field names and the public flag, never the values.
  | "profile.updated"
  | "profile.visibility"
  | "profile.avatar.set"
  | "profile.avatar.removed"
  // Path progress: target is "<path slug>" or "<path slug>/<lesson id>", no meta.
  | "path.started"
  | "path.lesson_done"
  | "path.lesson_undone"
  | "path.completed"
  | "path.starred"
  | "path.unstarred"
  // Admin portal (ADMIN-AUTH.md). Targets are admin ids or "email:<keyed hash>"; before/after in meta.
  | "admin.signin.success"
  | "admin.signin.failure"
  | "admin.signin.access_mismatch"
  | "admin.signin.paused"
  | "admin.mfa.success"
  | "admin.mfa.failure"
  | "admin.backup_code.used"
  | "admin.mfa.enrolled"
  | "admin.mfa.reset"
  | "admin.reauth.success"
  | "admin.reauth.failure"
  | "admin.signout"
  | "admin.session.revoked"
  | "admin.invite.created"
  | "admin.invite.cancelled"
  | "admin.invite.accepted"
  | "admin.invite.invalid"
  | "admin.password.set"
  | "admin.role.created"
  | "admin.role.assigned"
  | "admin.suspended"
  | "admin.unlocked"
  | "admin.removed"
  | "admin.bootstrap"
  // Admin portal, people side (ADMIN-PEOPLE.md). Targets are learner ids, ticket ids or batch ids;
  // meta holds counts, ids and category codes only, never addresses or free text.
  | "admin.user.reset_link"
  | "admin.user.suspended"
  | "admin.user.restored"
  | "admin.user.exported"
  | "admin.user.deleted"
  | "admin.waitlist.invited"
  | "admin.waitlist.reminded"
  | "admin.support.note"
  | "admin.support.assigned"
  | "admin.support.issue_logged"
  | "admin.metrics.exported"
  | "support.auto_resolved";

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
