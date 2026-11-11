import {
  lessonDoneSchema,
  PATH_LIMIT,
  type PathErrorBody,
  type PathProgress,
  pathIdSchema,
} from "@matr/types";
import { type Context, Hono } from "hono";
import { type AuditAction, writeAudit } from "../auth/audit";
import { type AuthedEnv, authError, can } from "../auth/guard";
import { hit, LIMITS } from "../auth/limits";
import { clientIp } from "../auth/util";

// Mounted by routes/me.ts, so requireSession (and requireAuthSecret on /api/me/*) already ran.
export const paths = new Hono<AuthedEnv>();

type Ctx = Context<AuthedEnv>;
const err = (code: PathErrorBody["code"], message: string, extra = {}) =>
  authError(code, message, extra);

type Row = {
  path_slug: string;
  started_at: string | null;
  last_activity_at: string | null;
  completed_at: string | null;
  starred_at: string | null;
};
type DoneRow = { path_slug: string; lesson_id: string };

const COLUMNS = "path_slug, started_at, last_activity_at, completed_at, starred_at";

const toPath = (r: Row, done: string[]): PathProgress => ({
  slug: r.path_slug,
  startedAt: r.started_at,
  lastActivityAt: r.last_activity_at,
  completedAt: r.completed_at,
  starredAt: r.starred_at,
  completedLessonIds: done,
});

// Own rows only: the user id comes from the session, never from the request.
paths.get("/", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "view")) return c.json(err("unauthorized", "Not allowed."), 403);
  const db = c.env.DB;
  const rows = await db
    .prepare(
      `SELECT ${COLUMNS} FROM path_enrolments WHERE user_id = ?
       ORDER BY COALESCE(last_activity_at, starred_at) DESC, path_slug LIMIT ${PATH_LIMIT}`,
    )
    .bind(user.id)
    .all<Row>();
  const done = await db
    .prepare(
      "SELECT path_slug, lesson_id FROM path_lessons_done WHERE user_id = ? ORDER BY completed_at, lesson_id",
    )
    .bind(user.id)
    .all<DoneRow>();
  const byPath = new Map<string, string[]>();
  for (const d of done.results) {
    const list = byPath.get(d.path_slug) ?? [];
    list.push(d.lesson_id);
    byPath.set(d.path_slug, list);
  }
  return c.json({
    paths: rows.results.map((r) => toPath(r, byPath.get(r.path_slug) ?? [])),
  });
});

async function load(c: Ctx, slug: string): Promise<PathProgress> {
  const db = c.env.DB;
  const id = c.get("user").id;
  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM path_enrolments WHERE user_id = ? AND path_slug = ?`)
    .bind(id, slug)
    .first<Row>();
  const done = await db
    .prepare(
      "SELECT lesson_id FROM path_lessons_done WHERE user_id = ? AND path_slug = ? ORDER BY completed_at, lesson_id",
    )
    .bind(id, slug)
    .all<{ lesson_id: string }>();
  const ids = done.results.map((d) => d.lesson_id);
  return row
    ? toPath(row, ids)
    : {
        slug,
        startedAt: null,
        lastActivityAt: null,
        completedAt: null,
        starredAt: null,
        completedLessonIds: ids,
      };
}

async function limited(c: Ctx) {
  const user = c.get("user");
  const h = c.req.raw.headers;
  const r = await hit(c.env.DB, `paths:user:${user.id}`, LIMITS.pathsUser);
  if (r.allowed) return null;
  await writeAudit(c.env.DB, {
    actor: user.id,
    action: "rate_limit.hit",
    ip: clientIp(h),
    ua: h.get("user-agent"),
    meta: { scope: "paths_user" },
  });
  c.header("Retry-After", String(r.retryAfterSec));
  return c.json(
    err("rate_limited", "You're making a lot of changes. Try again later.", {
      retryAfterSeconds: r.retryAfterSec,
    }),
    429,
  );
}

const audit = (c: Ctx, action: AuditAction, target: string) =>
  writeAudit(c.env.DB, {
    actor: c.get("user").id,
    action,
    target,
    ip: clientIp(c.req.raw.headers),
    ua: c.req.raw.headers.get("user-agent"),
  });

// Atomic: creates the row only below the cap; an existing row is left alone. False means the cap.
async function ensure(c: Ctx, slug: string): Promise<boolean> {
  const db = c.env.DB;
  const id = c.get("user").id;
  await db
    .prepare(
      `INSERT INTO path_enrolments (user_id, path_slug) SELECT ?1, ?2
       WHERE (SELECT COUNT(*) FROM path_enrolments WHERE user_id = ?1) < ?3
       ON CONFLICT(user_id, path_slug) DO NOTHING`,
    )
    .bind(id, slug, PATH_LIMIT)
    .run();
  const row = await db
    .prepare("SELECT 1 AS ok FROM path_enrolments WHERE user_id = ? AND path_slug = ?")
    .bind(id, slug)
    .first();
  return Boolean(row);
}

const full = (c: Ctx) =>
  c.json(err("path_limit", `You can follow up to ${PATH_LIMIT} paths.`), 409);

// Marks the path started (keeping the original time) and bumps the activity time.
const touch = (c: Ctx, slug: string, now: string) =>
  c.env.DB.prepare(
    `UPDATE path_enrolments SET started_at = COALESCE(started_at, ?3), last_activity_at = ?3
     WHERE user_id = ?1 AND path_slug = ?2`,
  )
    .bind(c.get("user").id, slug, now)
    .run();

async function guarded(c: Ctx, ...ids: string[]): Promise<Response | { ids: string[] }> {
  const user = c.get("user");
  if (!can(user, "learner.self", "manage")) return c.json(err("unauthorized", "Not allowed."), 403);
  const parsed = ids.map((i) => pathIdSchema.safeParse(i));
  if (parsed.some((p) => !p.success))
    return c.json(err("invalid_request", "That path or lesson id isn't valid."), 400);
  return { ids };
}

paths.post("/:slug/start", async (c) => {
  const g = await guarded(c, c.req.param("slug"));
  if (g instanceof Response) return g;
  const [slug] = g.ids as [string];
  const blocked = await limited(c);
  if (blocked) return blocked;
  if (!(await ensure(c, slug))) return full(c);
  const before = await load(c, slug);
  await touch(c, slug, new Date().toISOString());
  if (!before.startedAt) await audit(c, "path.started", slug);
  return c.json({ path: await load(c, slug) });
});

paths.put("/:slug/lessons/:lessonId", async (c) => {
  const g = await guarded(c, c.req.param("slug"), c.req.param("lessonId"));
  if (g instanceof Response) return g;
  const [slug, lessonId] = g.ids as [string, string];
  const body = lessonDoneSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json(err("invalid_request", "Send the number of lessons."), 400);
  const blocked = await limited(c);
  if (blocked) return blocked;
  if (!(await ensure(c, slug))) return full(c);

  const db = c.env.DB;
  const uid = c.get("user").id;
  const now = new Date().toISOString();
  const before = await load(c, slug);
  const inserted = await db
    .prepare(
      `INSERT INTO path_lessons_done (user_id, path_slug, lesson_id, completed_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, path_slug, lesson_id) DO NOTHING RETURNING lesson_id`,
    )
    .bind(uid, slug, lessonId, now)
    .first();
  await touch(c, slug, now);
  // Completion is set once and kept: a repeat call never moves the time.
  await db
    .prepare(
      `UPDATE path_enrolments SET completed_at = ?3
       WHERE user_id = ?1 AND path_slug = ?2 AND completed_at IS NULL
         AND (SELECT COUNT(*) FROM path_lessons_done WHERE user_id = ?1 AND path_slug = ?2) >= ?4`,
    )
    .bind(uid, slug, now, body.data.total)
    .run();
  const path = await load(c, slug);
  if (!before.startedAt) await audit(c, "path.started", slug);
  if (inserted) await audit(c, "path.lesson_done", `${slug}/${lessonId}`);
  if (path.completedAt && !before.completedAt) await audit(c, "path.completed", slug);
  return c.json({ path });
});

paths.delete("/:slug/lessons/:lessonId", async (c) => {
  const g = await guarded(c, c.req.param("slug"), c.req.param("lessonId"));
  if (g instanceof Response) return g;
  const [slug, lessonId] = g.ids as [string, string];
  const blocked = await limited(c);
  if (blocked) return blocked;

  const db = c.env.DB;
  const uid = c.get("user").id;
  const res = await db
    .prepare("DELETE FROM path_lessons_done WHERE user_id = ? AND path_slug = ? AND lesson_id = ?")
    .bind(uid, slug, lessonId)
    .run();
  if (res.meta.changes > 0) {
    // Undo reopens the path; only an existing enrolment is touched, none is created.
    await db
      .prepare(
        `UPDATE path_enrolments SET completed_at = NULL, last_activity_at = ?3
         WHERE user_id = ?1 AND path_slug = ?2`,
      )
      .bind(uid, slug, new Date().toISOString())
      .run();
    await audit(c, "path.lesson_undone", `${slug}/${lessonId}`);
  }
  return c.json({ path: await load(c, slug) });
});

paths.put("/:slug/star", async (c) => {
  const g = await guarded(c, c.req.param("slug"));
  if (g instanceof Response) return g;
  const [slug] = g.ids as [string];
  const blocked = await limited(c);
  if (blocked) return blocked;
  if (!(await ensure(c, slug))) return full(c);
  const before = await load(c, slug);
  await c.env.DB.prepare(
    "UPDATE path_enrolments SET starred_at = COALESCE(starred_at, ?3) WHERE user_id = ?1 AND path_slug = ?2",
  )
    .bind(c.get("user").id, slug, new Date().toISOString())
    .run();
  if (!before.starredAt) await audit(c, "path.starred", slug);
  return c.json({ path: await load(c, slug) });
});

paths.delete("/:slug/star", async (c) => {
  const g = await guarded(c, c.req.param("slug"));
  if (g instanceof Response) return g;
  const [slug] = g.ids as [string];
  const blocked = await limited(c);
  if (blocked) return blocked;

  const db = c.env.DB;
  const uid = c.get("user").id;
  const before = await load(c, slug);
  await db
    .prepare("UPDATE path_enrolments SET starred_at = NULL WHERE user_id = ? AND path_slug = ?")
    .bind(uid, slug)
    .run();
  // A row that was only ever starred holds nothing else: drop it so it frees a slot.
  await db
    .prepare(
      "DELETE FROM path_enrolments WHERE user_id = ? AND path_slug = ? AND started_at IS NULL AND starred_at IS NULL",
    )
    .bind(uid, slug)
    .run();
  if (before.starredAt) await audit(c, "path.unstarred", slug);
  return c.json({ path: await load(c, slug) });
});
