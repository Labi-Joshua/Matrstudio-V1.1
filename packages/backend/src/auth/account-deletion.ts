import type { Bindings } from "../env";
import { emailRef } from "./util";

type Learner = { id: string; email: string; name?: string; emailVerified?: boolean };

/**
 * Deletes a learner and everything they own. Shared by the learner's own "delete my account"
 * (routes/account.ts, after re-authentication) and the admin delete (routes/admin-users.ts, Super
 * admin plus fresh auth). Rows in other tables go with the user (ON DELETE CASCADE); audit rows
 * keep their action and time but lose actor, target, IP and agent. The caller writes its own
 * audit entry afterwards and clears the cookie if there is one.
 */
export async function deleteLearnerAccount(env: Bindings, user: Learner): Promise<void> {
  const db = env.DB;
  const eref = await emailRef(env.BETTER_AUTH_SECRET, user.email);
  await db.batch([
    db.prepare("DELETE FROM session WHERE userId = ?").bind(user.id),
    db.prepare("DELETE FROM account WHERE userId = ?").bind(user.id),
    db.prepare("DELETE FROM passkey WHERE userId = ?").bind(user.id),
    db.prepare("DELETE FROM onboarding WHERE userId = ?").bind(user.id),
    db.prepare("DELETE FROM user_preferences WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM pending_email_changes WHERE user_id = ?").bind(user.id),
    db
      .prepare("DELETE FROM verification WHERE value = ?1 OR value LIKE ?2")
      .bind(user.id, `%"email":"${user.email.toLowerCase()}"%`), // magic-link records carry the address
    db.prepare("DELETE FROM invites WHERE email = ?").bind(user.email.toLowerCase()),
    db
      .prepare(
        "UPDATE audit_log SET actor = NULL, target = NULL, ip = NULL, ua = NULL WHERE actor = ?1 OR target = ?1 OR target = ?2",
      )
      .bind(user.id, `email:${eref}`),
    db.prepare("DELETE FROM user WHERE id = ?").bind(user.id),
  ]);
}

/** A copy of a learner's data. Never includes password hashes, tokens or session rows. */
export async function collectLearnerExport(db: D1Database, user: Learner) {
  const [onboarding, prefs, saved, submissions] = await Promise.all([
    db
      .prepare("SELECT goal, level, topics, completed_at FROM onboarding WHERE userId = ?")
      .bind(user.id)
      .first(),
    db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").bind(user.id).first(),
    db
      .prepare(
        "SELECT resource_id, created_at FROM saved_resources WHERE user_id = ? ORDER BY created_at DESC",
      )
      .bind(user.id)
      .all(),
    db
      .prepare(
        "SELECT id, url, title, note, topic, status, curator_note, created_at, updated_at FROM resource_submissions WHERE user_id = ? ORDER BY created_at DESC",
      )
      .bind(user.id)
      .all(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified },
    onboarding,
    preferences: prefs,
    saved: saved.results,
    submissions: submissions.results,
  };
}
