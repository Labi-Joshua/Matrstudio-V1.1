import { SAVED_LIMIT, type SavedErrorBody, savedResourceIdSchema } from "@matr/types";
import { type Context, Hono } from "hono";
import { writeAudit } from "../auth/audit";
import { type AuthedEnv, authError, can } from "../auth/guard";
import { hit, LIMITS } from "../auth/limits";
import { clientIp } from "../auth/util";

// Mounted by routes/me.ts, so requireSession (and requireAuthSecret on /api/me/*) already ran.
export const saved = new Hono<AuthedEnv>();

const err = (code: SavedErrorBody["code"], message: string, extra = {}) =>
  authError(code, message, extra);

type Row = { resource_id: string; created_at: number };
const toSaved = (r: Row) => ({ resourceId: r.resource_id, savedAt: r.created_at });

// Own rows only: the user id comes from the session, never from the request.
saved.get("/", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "view")) return c.json(err("unauthorized", "Not allowed."), 403);
  const rows = await c.env.DB.prepare(
    `SELECT resource_id, created_at FROM saved_resources WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ${SAVED_LIMIT}`,
  )
    .bind(user.id)
    .all<Row>();
  return c.json({ saved: rows.results.map(toSaved) });
});

async function limited(c: Context<AuthedEnv>) {
  const user = c.get("user");
  const h = c.req.raw.headers;
  const r = await hit(c.env.DB, `saved:user:${user.id}`, LIMITS.savedUser);
  if (r.allowed) return null;
  await writeAudit(c.env.DB, {
    actor: user.id,
    action: "rate_limit.hit",
    ip: clientIp(h),
    ua: h.get("user-agent"),
    meta: { scope: "saved_user" },
  });
  c.header("Retry-After", String(r.retryAfterSec));
  return c.json(
    err("rate_limited", "You're saving a lot. Try again later.", {
      retryAfterSeconds: r.retryAfterSec,
    }),
    429,
  );
}

saved.put("/:resourceId", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "manage")) return c.json(err("unauthorized", "Not allowed."), 403);
  const id = savedResourceIdSchema.safeParse(c.req.param("resourceId"));
  if (!id.success) return c.json(err("invalid_request", "That resource id isn't valid."), 400);
  const blocked = await limited(c);
  if (blocked) return blocked;

  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);
  // Atomic: inserts only below the cap; an existing row is left alone (idempotent).
  const inserted = await db
    .prepare(
      `INSERT INTO saved_resources (user_id, resource_id, created_at)
       SELECT ?1, ?2, ?3 WHERE (SELECT COUNT(*) FROM saved_resources WHERE user_id = ?1) < ?4
       ON CONFLICT(user_id, resource_id) DO NOTHING RETURNING resource_id`,
    )
    .bind(user.id, id.data, now, SAVED_LIMIT)
    .first();
  const row = await db
    .prepare(
      "SELECT resource_id, created_at FROM saved_resources WHERE user_id = ? AND resource_id = ?",
    )
    .bind(user.id, id.data)
    .first<Row>();
  if (!row) return c.json(err("saved_limit", `You can save up to ${SAVED_LIMIT} resources.`), 409);
  if (inserted)
    await writeAudit(db, {
      actor: user.id,
      action: "saved.added",
      target: id.data,
      ip: clientIp(c.req.raw.headers),
      ua: c.req.raw.headers.get("user-agent"),
    });
  return c.json({ saved: toSaved(row) });
});

saved.delete("/:resourceId", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "manage")) return c.json(err("unauthorized", "Not allowed."), 403);
  const id = savedResourceIdSchema.safeParse(c.req.param("resourceId"));
  if (!id.success) return c.json(err("invalid_request", "That resource id isn't valid."), 400);
  const blocked = await limited(c);
  if (blocked) return blocked;

  const res = await c.env.DB.prepare(
    "DELETE FROM saved_resources WHERE user_id = ? AND resource_id = ?",
  )
    .bind(user.id, id.data)
    .run();
  if (res.meta.changes > 0)
    await writeAudit(c.env.DB, {
      actor: user.id,
      action: "saved.removed",
      target: id.data,
      ip: clientIp(c.req.raw.headers),
      ua: c.req.raw.headers.get("user-agent"),
    });
  return c.json({ removed: true });
});
