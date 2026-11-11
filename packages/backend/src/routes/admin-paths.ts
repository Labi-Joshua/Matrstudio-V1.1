import {
  addLessonsSchema,
  createPathSchema,
  patchLessonSchema,
  patchPathSchema,
  publishPathSchema,
  removeLessonSchema,
} from "@matr/types";
import { Hono } from "hono";
import { type AdminCtx, requireAdmin } from "../auth/admin-guard";
import { authError } from "../auth/guard";
import {
  audit,
  body,
  type C,
  conflict,
  idParam,
  invalid,
  newId,
  notFound,
  nowSec,
  optionalBody,
  qmarks,
} from "../content/common";
import { notifyMany } from "../content/notify";
import {
  lessonCount,
  loadTree,
  MAX_LESSONS_PER_PATH,
  type Module,
  notifyAudience,
  type PathRow,
  pathDoc,
  publishCheck,
  removalImpact,
  uniqueSlug,
} from "../content/paths";
import { resolveTopicLevel, taxNames } from "../content/resources";

// Mounted by routes/admin.ts after requireAccess (lock 1); requireAdmin adds lock 2 and the role check.
export const adminPaths = new Hono<AdminCtx>();

const loadPath = (c: C, id: string) =>
  c.env.DB.prepare("SELECT * FROM paths WHERE id = ?").bind(id).first<PathRow>();

const doc = async (c: C, id: string) => pathDoc(c.env.DB, (await loadPath(c, id)) as PathRow);

const unknownTaxonomy = (c: C, fieldErrors: Record<string, string>) =>
  c.json(
    authError("unknown_taxonomy", "Pick a topic and level from the list.", { fieldErrors }),
    400,
  );

adminPaths.get("/", requireAdmin("paths", "view"), async (c) => {
  const db = c.env.DB;
  const rawStatus = c.req.query("status");
  // "published" is the picker's word for live.
  const status = rawStatus === "published" ? "live" : rawStatus;
  const where =
    status && ["draft", "live", "unpublished"].includes(status) ? "WHERE p.status = ?" : "";
  const rows = await db
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM path_modules m WHERE m.path_id = p.id) AS modules,
              (SELECT COUNT(*) FROM path_lessons l WHERE l.path_id = p.id) AS lessons,
              (SELECT COUNT(*) FROM path_enrolments e WHERE e.path_slug = p.slug AND e.started_at IS NOT NULL) AS learners,
              (SELECT COUNT(*) FROM path_enrolments e WHERE e.path_slug = p.slug AND e.completed_at IS NOT NULL) AS completed
         FROM paths p ${where} ORDER BY p.updated_at DESC, p.id DESC LIMIT 200`,
    )
    .bind(...(where ? [status] : []))
    .all<PathRow & { modules: number; lessons: number; learners: number; completed: number }>();
  const names = await taxNames(db);
  const totals = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM paths) AS total,
              (SELECT COUNT(*) FROM paths WHERE status = 'live') AS live,
              (SELECT COUNT(*) FROM paths WHERE status = 'draft') AS draft,
              (SELECT COUNT(*) FROM paths WHERE status = 'unpublished') AS unpublished,
              (SELECT COUNT(*) FROM path_enrolments e JOIN paths p ON p.slug = e.path_slug
                WHERE p.status = 'live' AND e.started_at IS NOT NULL) AS enrolled`,
    )
    .first<Record<string, number>>();
  const items = rows.results.map((p) => ({
    id: p.id,
    title: p.title,
    topic: names.topic.get(p.topic) ?? p.topic,
    level: p.level,
    time: p.time,
    status: p.status,
    modules: p.modules,
    lessons: p.lessons,
    learners: p.learners,
    completionRate: p.learners > 0 ? Math.round((p.completed / p.learners) * 100) : null,
    updatedAt: new Date(p.updated_at * 1000).toISOString(),
  }));
  return c.json({
    items,
    counts: {
      all: totals?.total ?? 0,
      live: totals?.live ?? 0,
      draft: totals?.draft ?? 0,
      unpublished: totals?.unpublished ?? 0,
    },
    learnersEnrolled: totals?.enrolled ?? 0,
  });
});

adminPaths.post("/", requireAdmin("paths", "manage"), async (c) => {
  const db = c.env.DB;
  const b = await body(c, createPathSchema);
  if (!b) return invalid(c);
  const tl = await resolveTopicLevel(db, b.topic, b.level);
  if (!tl.ok) return unknownTaxonomy(c, tl.fieldErrors);
  const id = newId();
  const now = nowSec();
  await db
    .prepare(
      `INSERT INTO paths (id, slug, title, topic, level, time, description, status, created_by, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'draft', ?8, ?9, ?9)`,
    )
    .bind(
      id,
      await uniqueSlug(db, b.title),
      b.title,
      tl.topic,
      tl.level,
      b.time,
      b.description,
      c.get("admin").id,
      now,
    )
    .run();
  await audit(c, { action: "content.path.created", target: id, meta: { status: "draft" } });
  return c.json(await doc(c, id), 201);
});

adminPaths.get("/:id", requireAdmin("paths", "view"), async (c) => {
  const id = idParam(c);
  const p = id ? await loadPath(c, id) : null;
  return p ? c.json(await pathDoc(c.env.DB, p)) : notFound(c, "That path");
});

adminPaths.patch("/:id", requireAdmin("paths", "manage"), async (c) => {
  const id = idParam(c);
  const p = id ? await loadPath(c, id) : null;
  if (!id || !p) return notFound(c, "That path");
  const db = c.env.DB;
  const b = await body(c, patchPathSchema);
  if (!b) return invalid(c);
  const tl = await resolveTopicLevel(db, b.topic, b.level);
  if (!tl.ok) return unknownTaxonomy(c, tl.fieldErrors);
  const stmts: D1PreparedStatement[] = [];
  const now = nowSec();

  if (b.modules) {
    const tree = await loadTree(db, p);
    const existingMods = new Set(tree.map((m) => m.id));
    const existingLessons = new Set(tree.flatMap((m) => m.lessons.map((l) => l.id)));
    const seenLessons = new Set<string>();
    const seenMods = new Set<string>();
    for (const m of b.modules) {
      // An id the path doesn't know (the editor's "tmp-..." ids) is a new module.
      if (m.id && existingMods.has(m.id)) {
        if (seenMods.has(m.id)) return invalid(c);
        seenMods.add(m.id);
      }
      for (const l of m.lessonIds) {
        if (!existingLessons.has(l) || seenLessons.has(l)) return invalid(c);
        seenLessons.add(l);
      }
    }
    // Every lesson stays (removing one goes through DELETE .../lessons/:lid, which tells learners).
    if (seenLessons.size !== existingLessons.size)
      return conflict(c, "lessons_missing", "Remove lessons one at a time so learners are told.");
    const kept = new Set<string>();
    b.modules.forEach((m, i) => {
      const known = m.id !== undefined && existingMods.has(m.id);
      const mid = known ? (m.id as string) : newId();
      kept.add(mid);
      if (known)
        stmts.push(
          db
            .prepare("UPDATE path_modules SET title = ?, position = ? WHERE id = ?")
            .bind(m.title, i, mid),
        );
      else
        stmts.push(
          db
            .prepare("INSERT INTO path_modules (id, path_id, title, position) VALUES (?, ?, ?, ?)")
            .bind(mid, id, m.title, i),
        );
      for (const [j, lid] of m.lessonIds.entries())
        stmts.push(
          db
            .prepare("UPDATE path_lessons SET module_id = ?, position = ? WHERE id = ?")
            .bind(mid, j, lid),
        );
    });
    for (const old of existingMods)
      if (!kept.has(old)) stmts.push(db.prepare("DELETE FROM path_modules WHERE id = ?").bind(old));
  }

  const sets: string[] = [];
  const binds: unknown[] = [];
  const map: Record<string, unknown> = {
    title: b.title,
    topic: tl.topic,
    level: tl.level,
    time: b.time,
    description: b.description,
    show_in_explore: b.showInExplore === undefined ? undefined : Number(b.showInExplore),
    certificate: b.certificate === undefined ? undefined : Number(b.certificate),
    invite_only: b.inviteOnly === undefined ? undefined : Number(b.inviteOnly),
    outcomes: b.outcomes ? JSON.stringify(b.outcomes) : undefined,
    audience: b.audience ? JSON.stringify(b.audience) : undefined,
  };
  for (const [col, v] of Object.entries(map)) {
    if (v === undefined) continue;
    sets.push(`${col} = ?`);
    binds.push(v);
  }
  stmts.push(
    db
      .prepare(`UPDATE paths SET ${[...sets, "updated_at = ?"].join(", ")} WHERE id = ?`)
      .bind(...binds, now, id),
  );
  await db.batch(stmts);
  await audit(c, {
    action: "content.path.updated",
    target: id,
    meta: { fields: Object.keys(b).join(",") },
  });
  return c.json(await doc(c, id));
});

adminPaths.post("/:id/lessons", requireAdmin("paths", "manage"), async (c) => {
  const id = idParam(c);
  const p = id ? await loadPath(c, id) : null;
  if (!id || !p) return notFound(c, "That path");
  const db = c.env.DB;
  const b = await body(c, addLessonsSchema);
  if (!b) return invalid(c);
  const mod = await db
    .prepare("SELECT id FROM path_modules WHERE id = ? AND path_id = ?")
    .bind(b.moduleId, id)
    .first();
  if (!mod) return invalid(c, { fieldErrors: { moduleId: "Pick a module in this path." } });
  const wanted = [...new Set(b.resourceIds)];
  const found = await db
    .prepare(`SELECT id, status FROM resources WHERE id IN (${qmarks(wanted.length)})`)
    .bind(...wanted)
    .all<{ id: string; status: string }>();
  const usable = new Set(found.results.filter((r) => r.status !== "retired").map((r) => r.id));
  if (usable.size !== wanted.length)
    return invalid(c, { fieldErrors: { resourceIds: "Some resources can’t be added." } });
  const inPath = await db
    .prepare("SELECT resource_id FROM path_lessons WHERE path_id = ?")
    .bind(id)
    .all<{ resource_id: string }>();
  const have = new Set(inPath.results.map((r) => r.resource_id));
  const toAdd = wanted.filter((r) => !have.has(r));
  if ((await lessonCount(db, id)) + toAdd.length > MAX_LESSONS_PER_PATH)
    return conflict(c, "path_full", `A path can hold ${MAX_LESSONS_PER_PATH} lessons.`);
  const now = nowSec();
  const added = toAdd.map(() => newId());
  const start = await db
    .prepare("SELECT COALESCE(MAX(position) + 1, 0) AS n FROM path_lessons WHERE module_id = ?")
    .bind(b.moduleId)
    .first<{ n: number }>();
  await db.batch([
    ...toAdd.map((rid, i) =>
      db
        .prepare(
          `INSERT INTO path_lessons (id, path_id, module_id, resource_id, intro, position, created_at)
           VALUES (?, ?, ?, ?, '', ?, ?)`,
        )
        .bind(added[i], id, b.moduleId, rid, (start?.n ?? 0) + i, now),
    ),
    db.prepare("UPDATE paths SET updated_at = ? WHERE id = ?").bind(now, id),
  ]);
  if (added.length)
    await audit(c, {
      action: "content.path.lesson_added",
      target: id,
      meta: { count: added.length },
    });
  return c.json({ added, skipped: wanted.filter((r) => have.has(r)), ...(await doc(c, id)) }, 201);
});

adminPaths.patch("/:id/lessons/:lid", requireAdmin("paths", "manage"), async (c) => {
  const id = idParam(c);
  const lid = idParam(c, "lid");
  const p = id ? await loadPath(c, id) : null;
  if (!id || !lid || !p) return notFound(c, "That lesson");
  const b = await body(c, patchLessonSchema);
  if (!b) return invalid(c);
  const changed = await c.env.DB.prepare(
    "UPDATE path_lessons SET intro = ? WHERE id = ? AND path_id = ?",
  )
    .bind(b.intro, lid, id)
    .run();
  if (!changed.meta.changes) return notFound(c, "That lesson");
  await c.env.DB.prepare("UPDATE paths SET updated_at = ? WHERE id = ?").bind(nowSec(), id).run();
  await audit(c, { action: "content.path.updated", target: id, meta: { fields: "lesson_intro" } });
  return c.json(await doc(c, id));
});

adminPaths.get("/:id/publish-check", requireAdmin("paths", "view"), async (c) => {
  const id = idParam(c);
  const p = id ? await loadPath(c, id) : null;
  if (!p) return notFound(c, "That path");
  return c.json(await publishCheck(c.env.DB, p, await loadTree(c.env.DB, p)));
});

adminPaths.post("/:id/publish", requireAdmin("paths", "manage"), async (c) => {
  const id = idParam(c);
  const p = id ? await loadPath(c, id) : null;
  if (!id || !p) return notFound(c, "That path");
  const b = await optionalBody(c, publishPathSchema);
  if (!b) return invalid(c);
  if (p.status === "live") return conflict(c, "already_live", "This path is already live.");
  const check = await publishCheck(c.env.DB, p, await loadTree(c.env.DB, p));
  if (!check.canPublish)
    return conflict(c, "publish_blocked", "Fix the items in the checklist first.", check);
  const now = nowSec();
  const explore =
    b.featureTopOfExplore === undefined ? p.show_in_explore : Number(b.featureTopOfExplore);
  const changed = await c.env.DB.prepare(
    "UPDATE paths SET status = 'live', show_in_explore = ?3, published_at = ?2, updated_at = ?2 WHERE id = ?1 AND status <> 'live'",
  )
    .bind(id, now, explore)
    .run();
  if (!changed.meta.changes) return conflict(c, "already_live", "This path is already live.");
  await audit(c, { action: "content.path.published", target: id, meta: { before: p.status } });
  return c.json({ ...(await doc(c, id)), warnings: check.warnings });
});

adminPaths.post("/:id/unpublish", requireAdmin("paths", "manage"), async (c) => {
  const id = idParam(c);
  const p = id ? await loadPath(c, id) : null;
  if (!id || !p) return notFound(c, "That path");
  const changed = await c.env.DB.prepare(
    "UPDATE paths SET status = 'unpublished', updated_at = ?2 WHERE id = ?1 AND status = 'live'",
  )
    .bind(id, nowSec())
    .run();
  if (!changed.meta.changes) return conflict(c, "not_live", "This path isn’t live.");
  await audit(c, { action: "content.path.unpublished", target: id });
  // Enrolled learners keep the lessons they finished; the counts are what the confirm modal shows.
  return c.json(await doc(c, id));
});

adminPaths.get("/:id/lessons/:lid/removal-impact", requireAdmin("paths", "view"), async (c) => {
  const id = idParam(c);
  const lid = idParam(c, "lid");
  const p = id ? await loadPath(c, id) : null;
  if (!lid || !p) return notFound(c, "That lesson");
  const impact = await removalImpact(c.env.DB, p, await loadTree(c.env.DB, p), lid);
  return impact ? c.json(impact) : notFound(c, "That lesson");
});

adminPaths.delete("/:id/lessons/:lid", requireAdmin("paths", "manage"), async (c) => {
  const id = idParam(c);
  const lid = idParam(c, "lid");
  const p = id ? await loadPath(c, id) : null;
  if (!id || !lid || !p) return notFound(c, "That lesson");
  const db = c.env.DB;
  const b = await optionalBody(c, removeLessonSchema);
  if (!b) return invalid(c);
  const tree = await loadTree(db, p);
  const impact = await removalImpact(db, p, tree, lid);
  if (!impact) return notFound(c, "That lesson");
  const total = tree.reduce((n, m) => n + m.lessons.length, 0);
  if (p.status === "live" && total <= 1)
    return conflict(c, "last_lesson", "Unpublish the path before removing its last lesson.");
  const audience =
    p.status === "live" ? await notifyAudience(db, p.slug, lid, null) : { count: 0, userIds: [] };
  const now = nowSec();
  const mod = tree.find((m) => m.lessons.some((l) => l.id === lid)) as Module;
  await db.batch([
    db
      .prepare("DELETE FROM path_lessons_done WHERE path_slug = ? AND lesson_id = ?")
      .bind(p.slug, lid),
    db.prepare("DELETE FROM path_lessons WHERE id = ? AND path_id = ?").bind(lid, id),
    // Close the gap in the module's order.
    ...mod.lessons
      .filter((l) => l.id !== lid)
      .map((l, i) => db.prepare("UPDATE path_lessons SET position = ? WHERE id = ?").bind(i, l.id)),
    // Progress is recalculated: someone whose remaining lessons are all done has now finished
    // (people who already finished keep their completion).
    db
      .prepare(
        `UPDATE path_enrolments SET completed_at = ?2, last_activity_at = ?2
          WHERE path_slug = ?1 AND started_at IS NOT NULL AND completed_at IS NULL
            AND (SELECT COUNT(*) FROM path_lessons WHERE path_id = ?3) > 0
            AND (SELECT COUNT(*) FROM path_lessons_done d JOIN path_lessons l ON l.id = d.lesson_id
                  WHERE d.user_id = path_enrolments.user_id AND d.path_slug = ?1 AND l.path_id = ?3)
                >= (SELECT COUNT(*) FROM path_lessons WHERE path_id = ?3)`,
      )
      .bind(p.slug, new Date(now * 1000).toISOString(), id),
    db.prepare("UPDATE paths SET updated_at = ? WHERE id = ?").bind(now, id),
  ]);
  const message = b.message || impact.defaultMessage;
  const notified = audience.userIds.length
    ? await notifyMany(db, audience.userIds, {
        kind: "new-lesson",
        title: `A lesson changed in ${p.title}`,
        body: message,
        href: `/learn/paths/${p.topic}/${p.slug}`,
      })
    : 0;
  await audit(c, {
    action: "content.path.lesson_removed",
    target: id,
    meta: { notified, truncated: audience.count > notified },
  });
  return c.json({ ...(await doc(c, id)), notified });
});

adminPaths.get("/:id/preview", requireAdmin("paths", "view"), async (c) => {
  const id = idParam(c);
  const p = id ? await loadPath(c, id) : null;
  if (!p) return notFound(c, "That path");
  return c.json({
    ...(await pathDoc(c.env.DB, p)),
    banner: `Viewing ${p.title} as a learner. Nothing you do here saves progress or counts in metrics.`,
  });
});
