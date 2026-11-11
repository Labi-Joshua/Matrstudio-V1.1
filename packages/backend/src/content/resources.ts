import { checkSubmissionUrl } from "../auth/submission-url";
import { iso, qmarks, slugify } from "./common";

export type ResourceRow = {
  id: string;
  url: string;
  url_normalised: string;
  title: string;
  source: string;
  type: string;
  creator: string;
  topic: string;
  level: string;
  license: string;
  rights: string;
  duration_min: number | null;
  thumbnail: string | null;
  intro: string;
  learning_goal: string;
  status: string;
  added_by: string | null;
  submitted_by: string | null;
  submission_id: string | null;
  retired_at: number | null;
  created_at: number;
  updated_at: number;
  added_by_name?: string | null;
};

export const RESOURCE_SELECT = `SELECT r.*, a.name AS added_by_name FROM resources r
  LEFT JOIN admin_users a ON a.id = r.added_by`;

export type LinkCheckRow = {
  checked_at: number;
  ok: number;
  http_status: number | null;
  reason: string | null;
};
export const toLinkCheck = (r: LinkCheckRow | null | undefined) =>
  r ? { at: iso(r.checked_at), ok: r.ok === 1, status: r.http_status, reason: r.reason } : null;

export async function loadTags(db: D1Database, ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    if (!part.length) continue;
    const rows = await db
      .prepare(
        `SELECT resource_id, tag FROM resource_tags WHERE resource_id IN (${qmarks(part.length)}) ORDER BY tag`,
      )
      .bind(...part)
      .all<{ resource_id: string; tag: string }>();
    for (const r of rows.results)
      out.set(r.resource_id, [...(out.get(r.resource_id) ?? []), r.tag]);
  }
  return out;
}

export type TaxNames = { topic: Map<string, string>; level: Map<string, string> };
export async function taxNames(db: D1Database): Promise<TaxNames> {
  const rows = await db
    .prepare("SELECT kind, slug, name FROM taxonomy WHERE kind IN ('topic', 'level')")
    .all<{ kind: "topic" | "level"; slug: string; name: string }>();
  const out: TaxNames = { topic: new Map(), level: new Map() };
  for (const r of rows.results) out[r.kind].set(r.slug, r.name);
  return out;
}

/** A topic or level given as its slug or its name (any case) -> the slug, or null when unknown. */
export async function resolveTax(
  db: D1Database,
  kind: "topic" | "level",
  input: string,
): Promise<string | null> {
  const row = await db
    .prepare(
      "SELECT slug FROM taxonomy WHERE kind = ?1 AND (slug = lower(?2) OR lower(name) = lower(?2))",
    )
    .bind(kind, input.trim())
    .first<{ slug: string }>();
  return row?.slug ?? null;
}

export type OutCtx = {
  names: TaxNames;
  tags: string[];
  usedInPaths?: number;
  problem?: string | null;
  thumbnail?: boolean;
};

/** The API shape of a resource (what the admin Resources screens read). Topic is shown by name, level by slug. */
export const toResource = (r: ResourceRow, ctx: OutCtx) => ({
  id: r.id,
  title: r.title,
  source: r.source,
  creator: r.creator,
  type: r.type,
  topic: ctx.names.topic.get(r.topic) ?? r.topic,
  topicSlug: r.topic,
  level: r.level,
  durationMin: r.duration_min,
  usedInPaths: ctx.usedInPaths ?? 0,
  status: r.status,
  problem: ctx.problem ?? null,
  url: r.url,
  license: r.license,
  rights: r.rights,
  intro: r.intro,
  learningGoal: r.learning_goal,
  tags: ctx.tags,
  thumbnail: ctx.thumbnail === false ? null : r.thumbnail,
  addedBy: r.added_by_name ?? "",
  creditedLearner: r.submitted_by !== null,
  addedAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
  retiredAt: iso(r.retired_at),
});

/** Distinct paths each resource is used in, and the reason of its last failed check. */
export async function rowExtras(db: D1Database, ids: string[]) {
  const used = new Map<string, number>();
  const problem = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    if (!part.length) continue;
    const u = await db
      .prepare(
        `SELECT resource_id, COUNT(DISTINCT path_id) AS n FROM path_lessons WHERE resource_id IN (${qmarks(part.length)}) GROUP BY resource_id`,
      )
      .bind(...part)
      .all<{ resource_id: string; n: number }>();
    for (const r of u.results) used.set(r.resource_id, r.n);
  }
  for (const [id, c] of await latestChecks(db, ids))
    if (c.ok === 0 && c.reason) problem.set(id, c.reason);
  return { used, problem };
}

/** Last check per resource id (one query, newest row wins). */
export async function latestChecks(db: D1Database, ids: string[]) {
  const out = new Map<string, LinkCheckRow>();
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    if (!part.length) continue;
    const rows = await db
      .prepare(
        `SELECT c.resource_id, c.checked_at, c.ok, c.http_status, c.reason FROM link_checks c
          WHERE c.resource_id IN (${qmarks(part.length)})
            AND c.checked_at = (SELECT MAX(checked_at) FROM link_checks WHERE resource_id = c.resource_id)`,
      )
      .bind(...part)
      .all<LinkCheckRow & { resource_id: string }>();
    for (const r of rows.results) out.set(r.resource_id, r);
  }
  return out;
}

export type Usage = {
  pathId: string;
  pathTitle: string;
  pathStatus: string;
  moduleId: string;
  moduleTitle: string;
  moduleNumber: number;
  lessonId: string;
  lessonNumber: number;
};

export async function usedIn(db: D1Database, resourceId: string): Promise<Usage[]> {
  const rows = await db
    .prepare(
      `SELECT p.id AS path_id, p.title AS path_title, p.status AS path_status,
              m.id AS module_id, m.title AS module_title,
              (SELECT COUNT(*) FROM path_modules m2 WHERE m2.path_id = m.path_id AND m2.position <= m.position) AS module_number,
              l.id AS lesson_id,
              (SELECT COUNT(*) FROM path_lessons l2 WHERE l2.module_id = l.module_id AND l2.position <= l.position) AS lesson_number
         FROM path_lessons l
         JOIN path_modules m ON m.id = l.module_id
         JOIN paths p ON p.id = l.path_id
        WHERE l.resource_id = ?
        ORDER BY p.title, m.position, l.position`,
    )
    .bind(resourceId)
    .all<{
      path_id: string;
      path_title: string;
      path_status: string;
      module_id: string;
      module_title: string;
      module_number: number;
      lesson_id: string;
      lesson_number: number;
    }>();
  return rows.results.map((r) => ({
    pathId: r.path_id,
    pathTitle: r.path_title,
    pathStatus: r.path_status,
    moduleId: r.module_id,
    moduleTitle: r.module_title,
    moduleNumber: r.module_number,
    lessonId: r.lesson_id,
    lessonNumber: r.lesson_number,
  }));
}

/** Tags arrive as names; each becomes (or reuses) a tag in the taxonomy. Returns the slugs. */
export async function ensureTags(db: D1Database, names: string[]): Promise<string[]> {
  const slugs: string[] = [];
  const stmts: D1PreparedStatement[] = [];
  for (const name of names) {
    const slug = slugify(name);
    if (!slug || slugs.includes(slug)) continue;
    slugs.push(slug);
    stmts.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO taxonomy (id, kind, slug, name, created_at) VALUES (?, 'tag', ?, ?, unixepoch())",
        )
        .bind(crypto.randomUUID(), slug, name.slice(0, 60)),
    );
  }
  if (stmts.length) await db.batch(stmts);
  return slugs;
}

export const setTagsStatements = (db: D1Database, resourceId: string, slugs: string[]) => [
  db.prepare("DELETE FROM resource_tags WHERE resource_id = ?").bind(resourceId),
  ...slugs.map((t) =>
    db
      .prepare("INSERT OR IGNORE INTO resource_tags (resource_id, tag) VALUES (?, ?)")
      .bind(resourceId, t),
  ),
];

export const normaliseUrl = (url: string): string | null => {
  const c = checkSubmissionUrl(url);
  return c.ok ? c.normalised : null;
};

/** The non-retired library resource at this normalised URL, if any. */
export async function findByUrl(db: D1Database, normalised: string, exceptId?: string) {
  return db
    .prepare(
      "SELECT id, title, status FROM resources WHERE url_normalised = ? AND status <> 'retired' AND id <> ?",
    )
    .bind(normalised, exceptId ?? "")
    .first<{ id: string; title: string; status: string }>();
}

export async function usedInLiveCount(db: D1Database, resourceId: string) {
  const r = await db
    .prepare(
      `SELECT COUNT(DISTINCT p.id) AS n FROM path_lessons l JOIN paths p ON p.id = l.path_id
        WHERE l.resource_id = ? AND p.status = 'live'`,
    )
    .bind(resourceId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

// --- link reports derived from support tickets ---------------------------------------------------
export type ReportItem = {
  ticketId: string;
  userId: string;
  at: number;
  text: string;
  status: string;
};
const CLOSED_SQL = "('resolved', 'fixed', 'cant_reproduce')";

/**
 * Open broken-link reports grouped by library resource. A report is a support ticket of kind
 * "report" and category "Broken link" (what the Report a problem form sends); it is matched to a
 * resource by its link (normalised) or, failing that, by the resource title it was filed from.
 * Reports older than the last time curators handled the resource (fixed or dismissed) are history.
 */
export async function reportGroups(db: D1Database, onlyResourceId?: string) {
  const tickets = await db
    .prepare(
      `SELECT t.id, t.user_id, t.created_at, t.status, t.context_resource, t.context_link,
              (SELECT body FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at, m.rowid LIMIT 1) AS body
         FROM support_tickets t
        WHERE t.kind = 'report' AND lower(t.category) = 'broken link' AND t.status NOT IN ${CLOSED_SQL}
        ORDER BY t.created_at DESC, t.rowid DESC LIMIT 1000`,
    )
    .all<{
      id: string;
      user_id: string;
      created_at: number;
      status: string;
      context_resource: string | null;
      context_link: string | null;
      body: string | null;
    }>();
  const links = new Set<string>();
  const titles = new Set<string>();
  for (const t of tickets.results) {
    const n = t.context_link ? normaliseUrl(t.context_link) : null;
    if (n) links.add(n);
    if (t.context_resource) titles.add(t.context_resource.trim().toLowerCase());
  }
  const byLink = new Map<string, string>();
  const byTitle = new Map<string, string>();
  const lookup = async (
    col: "url_normalised" | "lower(title)",
    vals: string[],
    into: Map<string, string>,
  ) => {
    for (let i = 0; i < vals.length; i += 40) {
      const part = vals.slice(i, i + 40);
      if (!part.length) continue;
      const rows = await db
        .prepare(
          `SELECT id, url_normalised, lower(title) AS lt FROM resources WHERE status <> 'retired' AND ${col} IN (${qmarks(part.length)})`,
        )
        .bind(...part)
        .all<{ id: string; url_normalised: string; lt: string }>();
      for (const r of rows.results)
        into.set(col === "url_normalised" ? r.url_normalised : r.lt, r.id);
    }
  };
  await lookup("url_normalised", [...links], byLink);
  await lookup("lower(title)", [...titles], byTitle);

  const states = await db
    .prepare("SELECT resource_id, handled_at FROM link_report_state WHERE handled_at IS NOT NULL")
    .all<{ resource_id: string; handled_at: number }>();
  const handled = new Map(states.results.map((s) => [s.resource_id, s.handled_at]));

  const groups = new Map<string, ReportItem[]>();
  for (const t of tickets.results) {
    const n = t.context_link ? normaliseUrl(t.context_link) : null;
    const rid =
      (n ? byLink.get(n) : undefined) ??
      (t.context_resource ? byTitle.get(t.context_resource.trim().toLowerCase()) : undefined);
    if (!rid || (onlyResourceId && rid !== onlyResourceId)) continue;
    if (t.created_at <= (handled.get(rid) ?? 0)) continue;
    const list = groups.get(rid) ?? [];
    list.push({
      ticketId: t.id,
      userId: t.user_id,
      at: t.created_at,
      text: (t.body ?? "").slice(0, 500),
      status: t.status,
    });
    groups.set(rid, list);
  }
  return groups;
}

export async function resolveTopicLevel(db: D1Database, topic?: string, level?: string) {
  const fieldErrors: Record<string, string> = {};
  let t: string | undefined;
  let l: string | undefined;
  if (topic !== undefined) {
    const r = await resolveTax(db, "topic", topic);
    if (r) t = r;
    else fieldErrors.topic = "Unknown topic. Add it in Settings first.";
  }
  if (level !== undefined) {
    const r = await resolveTax(db, "level", level);
    if (r) l = r;
    else fieldErrors.level = "Unknown level.";
  }
  return Object.keys(fieldErrors).length
    ? ({ ok: false, fieldErrors } as const)
    : ({ ok: true, topic: t, level: l } as const);
}

/** Number of failed checks in a row, newest first (0 when the last one passed or there are none). */
export async function consecutiveFailures(db: D1Database, resourceId: string): Promise<number> {
  const rows = await db
    .prepare(
      "SELECT ok FROM link_checks WHERE resource_id = ? ORDER BY checked_at DESC, rowid DESC LIMIT 20",
    )
    .bind(resourceId)
    .all<{ ok: number }>();
  let n = 0;
  for (const r of rows.results) {
    if (r.ok === 1) break;
    n++;
  }
  return n;
}
