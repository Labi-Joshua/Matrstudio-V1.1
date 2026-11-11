import type { Bindings } from "../env";
import { type NewNotification, notificationStatement } from "../notifications/create";
import { enqueueAuthEmail } from "../queue/auth-email";
import { runChunked } from "./common";

export const NOTIFY_CAP = 5000;

/**
 * One in-app notification per learner (same row shape as createNotification), written in batches.
 * Returns how many were written; anything past NOTIFY_CAP is skipped and reported by the caller.
 */
export async function notifyMany(
  db: D1Database,
  userIds: string[],
  n: Omit<NewNotification, "userId">,
): Promise<number> {
  const ids = [...new Set(userIds)].slice(0, NOTIFY_CAP);
  await runChunked(
    db,
    ids.map((userId) => notificationStatement(db, { ...n, userId }).statement),
  );
  return ids.length;
}

export async function learnerEmail(db: D1Database, userId: string) {
  const row = await db
    .prepare("SELECT email, name FROM user WHERE id = ?")
    .bind(userId)
    .first<{ email: string; name: string }>();
  return row ?? null;
}

/** In-app notification plus a queued email for one learner (the email never blocks the request). */
export async function tellLearner(
  env: Bindings,
  userId: string,
  n: Omit<NewNotification, "userId">,
  email: { subject: string; message: string },
) {
  await notifyMany(env.DB, [userId], n);
  const to = await learnerEmail(env.DB, userId);
  if (to) await enqueueAuthEmail(env, { type: "staff-message", to: to.email, ...email });
}
