import {
  type AppNotification,
  markNotificationsReadSchema,
  NOTIFICATIONS_LIMIT,
  type NotificationKind,
} from "@matr/types";
import { Hono } from "hono";
import { writeAudit } from "../auth/audit";
import { type AuthedEnv, authError, can } from "../auth/guard";
import { hit, LIMITS } from "../auth/limits";
import { clientIp } from "../auth/util";

// Mounted by routes/me.ts, so requireSession (and requireAuthSecret on /api/me/*) already ran.
export const notifications = new Hono<AuthedEnv>();

type Row = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  created_at: number;
  read_at: number | null;
};
const iso = (s: number) => new Date(s * 1000).toISOString();
const toNotification = (r: Row): AppNotification => ({
  id: r.id,
  kind: r.kind as NotificationKind,
  title: r.title,
  body: r.body,
  href: r.href,
  createdAt: iso(r.created_at),
  readAt: r.read_at === null ? null : iso(r.read_at),
});

// Own rows only: the user id comes from the session, never from the request.
notifications.get("/", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "view"))
    return c.json(authError("unauthorized", "Not allowed."), 403);
  const rows = await c.env.DB.prepare(
    `SELECT id, kind, title, body, href, created_at, read_at FROM notifications
      WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ${NOTIFICATIONS_LIMIT}`,
  )
    .bind(user.id)
    .all<Row>();
  return c.json({ notifications: rows.results.map(toNotification) });
});

notifications.post("/read", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "manage"))
    return c.json(authError("unauthorized", "Not allowed."), 403);
  const raw = await c.req.text();
  const parsed = markNotificationsReadSchema.safeParse(raw.trim() === "" ? {} : safeJson(raw));
  if (!parsed.success)
    return c.json(authError("invalid_request", "Check the details you entered."), 400);

  const db = c.env.DB;
  const r = await hit(db, `notifications:user:${user.id}`, LIMITS.notificationsUser);
  if (!r.allowed) {
    await writeAudit(db, {
      actor: user.id,
      action: "rate_limit.hit",
      ip: clientIp(c.req.raw.headers),
      ua: c.req.raw.headers.get("user-agent"),
      meta: { scope: "notifications_user" },
    });
    c.header("Retry-After", String(r.retryAfterSec));
    return c.json(
      authError("rate_limited", "Slow down a little and try again.", {
        retryAfterSeconds: r.retryAfterSec,
      }),
      429,
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const ids = parsed.data.ids;
  if (ids && ids.length === 0) return c.json({ updated: 0 });
  const where = ids ? ` AND id IN (${ids.map(() => "?").join(", ")})` : "";
  const res = await db
    .prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL${where}`)
    .bind(now, user.id, ...(ids ?? []))
    .run();
  return c.json({ updated: res.meta.changes ?? 0 });
});

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
