import { iso, newId, nowSec, qmarks, slugify } from "./common";
import { taxNames } from "./resources";

export const MAX_LESSONS_PER_PATH = 90;

export type PathRow = {
  id: string;
  slug: string;
  title: string;
  topic: string;
  level: string;
  time: string;
  show_in_explore: number;
  certificate: number;
  invite_only: number;
  description: string;
  cover: string | null;
  outcomes: string;
  audience: string;
  status: string;
  created_by: string | null;
  published_at: number | null;
  created_at: number;
  updated_at: number;
};

type LessonJoin = {
  id: string;
  module_id: string;
  resource_id: string;
  intro: string;
  position: number;
  r_title: string;
  r_source: string;
  r_type: string;
  r_duration: number | null;
  r_status: string;
  r_topic: string;
};

export type Lesson = {
  id: string;
  resourceId: string;
  intro: string;
  order: number;
  resource: {
    title: string;
    source: string;
    type: string;
    durationMin: number | null;
    status: string;
  };
};
export type Module = { id: string; title: string; lessons: Lesson[] };

const parseList = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export async function loadTree(db: D1Database, path: PathRow): Promise<Module[]> {
  const [mods, lessons] = await Promise.all([
    db
      .prepare("SELECT id, title FROM path_modules WHERE path_id = ? ORDER BY position, rowid")
      .bind(path.id)
      .all<{ id: string; title: string }>(),
    db
      .prepare(
        `SELECT l.id, l.module_id, l.resource_id, l.intro, l.position,
                r.title AS r_title, r.source AS r_source, r.type AS r_type,
                r.duration_min AS r_duration, r.status AS r_status, r.topic AS r_topic
           FROM path_lessons l JOIN resources r ON r.id = l.resource_id
          WHERE l.path_id = ? ORDER BY l.position, l.rowid`,
      )
      .bind(path.id)
      .all<LessonJoin>(),
  ]);
  return mods.results.map((m) => ({
    id: m.id,
    title: m.title,
    lessons: lessons.results
      .filter((l) => l.module_id === m.id)
      .map((l) => ({
        id: l.id,
        resourceId: l.resource_id,
        intro: l.intro,
        order: l.position,
        resource: {
          title: l.r_title,
          source: l.r_source,
          type: l.r_type,
          durationMin: l.r_duration,
          status: l.r_status,
        },
      })),
  }));
}

export async function learnerStats(db: D1Database, slug: string) {
  const r = await db
    .prepare(
      `SELECT COUNT(CASE WHEN started_at IS NOT NULL THEN 1 END) AS enrolled,
              COUNT(CASE WHEN started_at IS NOT NULL AND completed_at IS NULL THEN 1 END) AS in_progress,
              COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) AS completed
         FROM path_enrolments WHERE path_slug = ?`,
    )
    .bind(slug)
    .first<{ enrolled: number; in_progress: number; completed: number }>();
  return {
    enrolled: r?.enrolled ?? 0,
    inProgress: r?.in_progress ?? 0,
    certificatesIssued: r?.completed ?? 0,
  };
}

/** The path document the admin Paths screens read (flat lessons, topic by name, level by slug). */
export async function pathDoc(db: D1Database, p: PathRow) {
  const [modules, stats, names] = await Promise.all([
    loadTree(db, p),
    learnerStats(db, p.slug),
    taxNames(db),
  ]);
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    status: p.status,
    level: p.level,
    topic: names.topic.get(p.topic) ?? p.topic,
    topicSlug: p.topic,
    time: p.time,
    showInExplore: p.show_in_explore === 1,
    certificate: p.certificate === 1,
    inviteOnly: p.invite_only === 1,
    // Only a same-origin image can show under the admin CSP; a cover URL is not supported yet.
    coverUrl: p.cover?.startsWith("/") ? p.cover : null,
    learners: stats.enrolled,
    inProgress: stats.inProgress,
    certificatesIssued: stats.certificatesIssued,
    publishedAt: iso(p.published_at),
    lastSavedAt: iso(p.updated_at),
    outcomes: parseList(p.outcomes),
    audience: parseList(p.audience),
    modules: modules.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        resourceId: l.resourceId,
        title: l.resource.title,
        source: l.resource.source,
        type: l.resource.type,
        durationMin: l.resource.durationMin,
        intro: l.intro,
        // A retired or broken resource shows as an empty lesson to learners.
        unavailable: l.resource.status === "retired" || l.resource.status === "needs_fix",
      })),
    })),
  };
}

export async function uniqueSlug(db: D1Database, title: string): Promise<string> {
  const base = slugify(title) || "path";
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base.slice(0, 54)}-${i + 1}`;
    const hit = await db.prepare("SELECT 1 AS x FROM paths WHERE slug = ?").bind(slug).first();
    if (!hit) return slug;
  }
  return `${base.slice(0, 50)}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function lessonCount(db: D1Database, pathId: string) {
  const r = await db
    .prepare("SELECT COUNT(*) AS n FROM path_lessons WHERE path_id = ?")
    .bind(pathId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

/**
 * Appends a lesson for the resource to each given path (last module; "Module 1" is created for an
 * empty path). Skips unknown paths, paths that already hold it and paths at the lesson cap.
 * Returns the ids of the paths it was added to.
 */
export async function attachToPaths(
  db: D1Database,
  resourceId: string,
  targets: Array<{ pathId: string; moduleId?: string }>,
) {
  const done: string[] = [];
  const seenPaths = new Set<string>();
  for (const { pathId, moduleId: wanted } of targets) {
    if (seenPaths.has(pathId)) continue;
    seenPaths.add(pathId);
    const p = await db.prepare("SELECT id FROM paths WHERE id = ?").bind(pathId).first();
    if (!p) continue;
    const has = await db
      .prepare("SELECT 1 AS x FROM path_lessons WHERE path_id = ? AND resource_id = ?")
      .bind(pathId, resourceId)
      .first();
    if (has || (await lessonCount(db, pathId)) >= MAX_LESSONS_PER_PATH) continue;
    const stmts: D1PreparedStatement[] = [];
    let moduleId = wanted
      ? (
          await db
            .prepare("SELECT id FROM path_modules WHERE id = ? AND path_id = ?")
            .bind(wanted, pathId)
            .first<{ id: string }>()
        )?.id
      : undefined;
    moduleId ??= (
      await db
        .prepare(
          "SELECT id FROM path_modules WHERE path_id = ? ORDER BY position DESC, rowid DESC LIMIT 1",
        )
        .bind(pathId)
        .first<{ id: string }>()
    )?.id;
    if (!moduleId) {
      moduleId = newId();
      stmts.push(
        db
          .prepare(
            "INSERT INTO path_modules (id, path_id, title, position) VALUES (?, ?, 'Module 1', 0)",
          )
          .bind(moduleId, pathId),
      );
    }
    stmts.push(
      db
        .prepare(
          `INSERT INTO path_lessons (id, path_id, module_id, resource_id, intro, position, created_at)
           VALUES (?1, ?2, ?3, ?4, '', COALESCE((SELECT MAX(position) + 1 FROM path_lessons WHERE module_id = ?3), 0), ?5)`,
        )
        .bind(newId(), pathId, moduleId, resourceId, nowSec()),
      db.prepare("UPDATE paths SET updated_at = ? WHERE id = ?").bind(nowSec(), pathId),
    );
    await db.batch(stmts);
    done.push(pathId);
  }
  return done;
}

// --- publish check -----------------------------------------------------------------------------
export type Check = { key: string; label: string; ok: boolean; lessonIds?: string[] };

export async function publishCheck(db: D1Database, path: PathRow, modules: Module[]) {
  const lessons = modules.flatMap((m) => m.lessons);
  const ids = [...new Set(lessons.map((l) => l.resourceId))];
  const failing = new Set<string>();
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    const rows = await db
      .prepare(
        `SELECT c.resource_id FROM link_checks c
          WHERE c.resource_id IN (${qmarks(part.length)}) AND c.ok = 0
            AND c.checked_at = (SELECT MAX(checked_at) FROM link_checks WHERE resource_id = c.resource_id)`,
      )
      .bind(...part)
      .all<{ resource_id: string }>();
    for (const r of rows.results) failing.add(r.resource_id);
  }
  const noIntro = lessons.filter((l) => !l.intro.trim()).map((l) => l.id);
  const badLink = lessons
    .filter(
      (l) =>
        failing.has(l.resourceId) ||
        l.resource.status === "needs_fix" ||
        l.resource.status === "retired",
    )
    .map((l) => l.id);
  const notLive = lessons.filter((l) => l.resource.status === "draft").map((l) => l.id);
  const checks: Check[] = [
    {
      key: "content",
      label: `${modules.length} module${modules.length === 1 ? "" : "s"}, ${lessons.length} lesson${lessons.length === 1 ? "" : "s"}`,
      ok: modules.length > 0 && lessons.length > 0,
    },
    {
      key: "intros",
      label: "Every lesson has an intro",
      ok: noIntro.length === 0,
      lessonIds: noIntro,
    },
    {
      key: "links",
      label: "All links passed today’s check",
      ok: badLink.length === 0,
      lessonIds: badLink,
    },
    {
      key: "resources_live",
      label: "Every lesson’s resource is live",
      ok: notLive.length === 0,
      lessonIds: notLive,
    },
    {
      key: "details",
      label: "Level, topic and time are set",
      ok: Boolean(path.topic && path.level && path.time.trim()),
    },
  ];
  const warnings: string[] = [];
  if (!path.cover)
    warnings.push("No cover image yet. We’ll use the default pattern until you add one.");
  return { checks, warnings, canPublish: checks.every((c) => c.ok) };
}

// --- removal impact -----------------------------------------------------------------------------
export async function removalImpact(
  db: D1Database,
  path: PathRow,
  modules: Module[],
  lessonId: string,
) {
  const flat = modules.flatMap((m) => m.lessons);
  const idx = flat.findIndex((l) => l.id === lessonId);
  if (idx < 0) return null;
  const earlier = flat.slice(0, idx).map((l) => l.id);
  const slug = path.slug;
  const list = earlier.length ? earlier : [""];
  const inList = list.map((_, i) => `?${i + 3}`).join(",");
  const [took, onPath, onLesson, notify] = await Promise.all([
    db
      .prepare(
        "SELECT COUNT(DISTINCT user_id) AS n FROM path_lessons_done WHERE path_slug = ? AND lesson_id = ?",
      )
      .bind(slug, lessonId)
      .first<{ n: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM path_enrolments WHERE path_slug = ? AND started_at IS NOT NULL AND completed_at IS NULL",
      )
      .bind(slug)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM path_enrolments e
          WHERE e.path_slug = ?1 AND e.started_at IS NOT NULL AND e.completed_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM path_lessons_done d WHERE d.user_id = e.user_id AND d.path_slug = ?1 AND d.lesson_id = ?2)
            AND (SELECT COUNT(*) FROM path_lessons_done d WHERE d.user_id = e.user_id AND d.path_slug = ?1
                   AND d.lesson_id IN (${inList})) = ?${list.length + 3}`,
      )
      .bind(slug, lessonId, ...list, earlier.length)
      .first<{ n: number }>(),
    notifyAudience(db, slug, lessonId, 1),
  ]);
  const lesson = flat[idx] as Lesson;
  return {
    lesson: { id: lesson.id, title: lesson.resource.title },
    live: path.status === "live",
    tookLesson: took?.n ?? 0,
    onLesson: onLesson?.n ?? 0,
    onPath: onPath?.n ?? 0,
    notify: notify.count,
    defaultMessage: `“${lesson.resource.title}” was removed from ${path.title}. Your progress is safe.`,
  };
}

/** Learners to tell when a lesson goes: took it, or are still on the path. `cap` 1 = count only. */
export async function notifyAudience(
  db: D1Database,
  slug: string,
  lessonId: string,
  cap: number | null,
  limit = 5000,
) {
  const from = `FROM (
      SELECT user_id FROM path_lessons_done WHERE path_slug = ?1 AND lesson_id = ?2
      UNION
      SELECT user_id FROM path_enrolments WHERE path_slug = ?1 AND started_at IS NOT NULL AND completed_at IS NULL)`;
  if (cap === 1) {
    const r = await db
      .prepare(`SELECT COUNT(*) AS n ${from}`)
      .bind(slug, lessonId)
      .first<{ n: number }>();
    return { count: r?.n ?? 0, userIds: [] as string[] };
  }
  const rows = await db
    .prepare(`SELECT user_id ${from} LIMIT ${limit}`)
    .bind(slug, lessonId)
    .all<{ user_id: string }>();
  return { count: rows.results.length, userIds: rows.results.map((r) => r.user_id) };
}
