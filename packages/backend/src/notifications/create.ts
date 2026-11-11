import { NOTIFICATION_KINDS, type NotificationKind } from "@matr/types";

export type NewNotification = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** A path on the website (starts with "/"), or null. */
  href?: string | null;
};

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * Creates one in-app notification for a learner and returns its id. Used by the support routes and
 * by the reminder job later. Titles and bodies are plain text; the web renders them as text.
 */
export function notificationStatement(
  db: D1Database,
  n: NewNotification,
): { id: string; statement: D1PreparedStatement } {
  if (!(NOTIFICATION_KINDS as readonly string[]).includes(n.kind))
    throw new Error("unknown notification kind");
  if (n.href != null && !(n.href.startsWith("/") && !n.href.startsWith("//")))
    throw new Error("notification href must be a site path");
  const id = crypto.randomUUID();
  const statement = db
    .prepare(
      "INSERT INTO notifications (id, user_id, kind, title, body, href, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      n.userId,
      n.kind,
      clip(n.title, 120),
      clip(n.body, 300),
      n.href ?? null,
      Math.floor(Date.now() / 1000),
    );
  return { id, statement };
}

export async function createNotification(db: D1Database, n: NewNotification): Promise<string> {
  const { id, statement } = notificationStatement(db, n);
  await statement.run();
  return id;
}
