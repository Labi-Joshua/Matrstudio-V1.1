import {
  createResourceSchema,
  fixLinkSchema,
  patchResourceSchema,
  resourcePreviewSchema,
  retireSchema,
} from "@matr/types";
import { Hono } from "hono";
import { type AdminCtx, requireAdmin } from "../auth/admin-guard";
import { authError } from "../auth/guard";
import { hit, LIMITS } from "../auth/limits";
import { checkSubmissionUrl } from "../auth/submission-url";
import {
  audit,
  body,
  type C,
  clampLimit,
  conflict,
  decodeCursor,
  encodeCursor,
  hostOf,
  idParam,
  invalid,
  newId,
  notFound,
  nowSec,
} from "../content/common";
import { attachToPaths } from "../content/paths";
import {
  consecutiveFailures,
  ensureTags,
  findByUrl,
  latestChecks,
  loadTags,
  RESOURCE_SELECT,
  type ResourceRow,
  reportGroups,
  resolveTopicLevel,
  rowExtras,
  setTagsStatements,
  taxNames,
  toLinkCheck,
  toResource,
  usedIn,
} from "../content/resources";
import { fetchThumbnail, parseMeta, safeFetch, suggestType } from "../content/safe-fetch";
import { createNotification } from "../notifications/create";

// Mounted by routes/admin.ts after requireAccess (lock 1); requireAdmin adds lock 2 and the role check.
export const adminResources = new Hono<AdminCtx>();

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

const loadResource = (c: C, id: string) =>
  c.env.DB.prepare(`${RESOURCE_SELECT} WHERE r.id = ?`).bind(id).first<ResourceRow>();

/** One resource in its API shape (the single place the detail fields are put together). */
async function resourceOut(c: C, row: ResourceRow) {
  const db = c.env.DB;
  const [names, tags, extras] = await Promise.all([
    taxNames(db),
    loadTags(db, [row.id]),
    rowExtras(db, [row.id]),
  ]);
  return toResource(row, {
    names,
    tags: tags.get(row.id) ?? [],
    usedInPaths: extras.used.get(row.id) ?? 0,
    problem: extras.problem.get(row.id) ?? null,
  });
}

async function rateLimited(c: C) {
  const limit = await hit(c.env.DB, `admin-preview:${c.get("admin").id}`, LIMITS.adminPreview);
  if (limit.allowed) return null;
  c.header("Retry-After", String(limit.retryAfterSec));
  return c.json(
    authError("rate_limited", "You’ve checked a lot of links. Try again shortly.", {
      retryAfterSeconds: limit.retryAfterSec,
    }),
    429,
  );
}

adminResources.get("/", requireAdmin("resources", "view"), async (c) => {
  const db = c.env.DB;
  const q = c.req.query();
  const where: string[] = [];
  const binds: unknown[] = [];
  const status = q.tab === "needs_fix" ? "needs_fix" : q.status === "published" ? "live" : q.status;
  if (status && ["draft", "live", "retired", "needs_fix"].includes(status)) {
    where.push("r.status = ?");
    binds.push(status);
  } else if (status !== "all") where.push("r.status <> 'retired'");
  if (q.type) {
    where.push("r.type = ?");
    binds.push(q.type.slice(0, 40));
  }
  for (const [col, kind] of [
    ["topic", "topic"],
    ["level", "level"],
  ] as const) {
    const v = q[col];
    if (!v) continue;
    // A slug or a display name both work.
    where.push(
      `r.${col} IN (SELECT slug FROM taxonomy WHERE kind = '${kind}' AND (slug = lower(?) OR lower(name) = lower(?)))`,
    );
    binds.push(v.slice(0, 60), v.slice(0, 60));
  }
  if (q.q?.trim()) {
    const like = `%${likeEscape(q.q.trim().slice(0, 80))}%`;
    where.push(
      "(r.title LIKE ? ESCAPE '\\' OR r.source LIKE ? ESCAPE '\\' OR r.creator LIKE ? ESCAPE '\\' OR r.url LIKE ? ESCAPE '\\')",
    );
    binds.push(like, like, like, like);
  }
  const cursor = decodeCursor(q.cursor);
  if (q.cursor && !cursor) return invalid(c);
  if (cursor) {
    where.push("(r.created_at < ? OR (r.created_at = ? AND r.id < ?))");
    binds.push(cursor.at, cursor.at, cursor.id);
  }
  const limit = clampLimit(q.limit);
  const rows = await db
    .prepare(
      `${RESOURCE_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
    )
    .bind(...binds, limit + 1)
    .all<ResourceRow>();
  const page = rows.results.slice(0, limit);
  const ids = page.map((r) => r.id);
  const [names, tags, extras, checks, groups] = await Promise.all([
    taxNames(db),
    loadTags(db, ids),
    rowExtras(db, ids),
    latestChecks(db, ids),
    reportGroups(db),
  ]);
  const last = page[page.length - 1];
  const counts = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM resources WHERE status <> 'retired') AS total,
              (SELECT COUNT(*) FROM resources WHERE status = 'live') AS live,
              (SELECT COUNT(*) FROM resources WHERE status = 'draft') AS draft,
              (SELECT COUNT(*) FROM resources WHERE status = 'needs_fix') AS needs_fix,
              (SELECT COUNT(*) FROM resources WHERE status = 'retired') AS retired,
              (SELECT COUNT(*) FROM paths) AS paths`,
    )
    .first<Record<string, number>>();
  const items = page.map((r) => ({
    ...toResource(r, {
      names,
      tags: tags.get(r.id) ?? [],
      usedInPaths: extras.used.get(r.id) ?? 0,
      problem: extras.problem.get(r.id) ?? null,
      thumbnail: false,
    }),
    kind: r.type,
    linkCheck: toLinkCheck(checks.get(r.id)),
    reports: groups.get(r.id)?.length ?? 0,
  }));
  return c.json({
    items,
    nextCursor: rows.results.length > limit && last ? encodeCursor(last.created_at, last.id) : null,
    counts: {
      total: counts?.total ?? 0,
      live: counts?.live ?? 0,
      draft: counts?.draft ?? 0,
      needsFix: counts?.needs_fix ?? 0,
      retired: counts?.retired ?? 0,
      paths: counts?.paths ?? 0,
    },
  });
});

const LEVEL_WORDS: Array<[RegExp, string]> = [
  [/\b(beginner|beginners|intro|introduction|basics|getting started|101)\b/i, "beginner"],
  [/\b(advanced|expert|masterclass)\b/i, "advanced"],
  [/\b(intermediate)\b/i, "intermediate"],
];

adminResources.post("/preview", requireAdmin("resources", "manage"), async (c) => {
  const db = c.env.DB;
  const parsed = await body(c, resourcePreviewSchema);
  if (!parsed) return invalid(c, { fieldErrors: { url: "Paste a full https:// link." } });
  const limited = await rateLimited(c);
  if (limited) return limited;
  const checked = checkSubmissionUrl(parsed.url);
  if (!checked.ok)
    return c.json(
      authError("invalid_url", "That link can’t be added. Use a public https:// link.", {
        fieldErrors: { url: "Use a public https:// link." },
      }),
      400,
    );
  const dup = await findByUrl(db, checked.normalised);
  const page = await safeFetch(checked.normalised, { readBody: true });
  const meta = parseMeta(page.html, page.finalUrl ?? checked.normalised);
  const host = hostOf(checked.normalised);
  const names = await taxNames(db);
  const hay = (meta.title ?? "").toLowerCase();
  const topic =
    [...names.topic].find(
      ([slug, name]) => hay.includes(name.toLowerCase()) || hay.includes(slug),
    )?.[1] ?? "";
  const level = LEVEL_WORDS.find(([re]) => re.test(meta.title ?? ""))?.[1] ?? "";
  return c.json({
    url: checked.normalised,
    title: meta.title ?? "",
    source: meta.siteName ?? host,
    creator: "",
    durationMin: meta.durationMin,
    // A small data: image, because the admin CSP only allows same-origin and data: images.
    thumbnail: page.ok ? await fetchThumbnail(meta.thumbnail) : null,
    linkOk: page.ok,
    linkReason: page.reason,
    duplicateOf: dup ? { id: dup.id, title: dup.title } : null,
    suggested: {
      type: suggestType(host),
      topic,
      level: names.level.has(level) ? level : "",
      license: /(^|\.)(youtube\.com|youtu\.be)$/.test(host)
        ? "YouTube standard (link only)"
        : "Public web page (link only)",
    },
  });
});

adminResources.post("/", requireAdmin("resources", "manage"), async (c) => {
  const db = c.env.DB;
  const b = await body(c, createResourceSchema);
  if (!b) return invalid(c);
  const checked = checkSubmissionUrl(b.url);
  if (!checked.ok)
    return c.json(
      authError("invalid_url", "That link can’t be added. Use a public https:// link."),
      400,
    );
  const tl = await resolveTopicLevel(db, b.topic, b.level);
  if (!tl.ok)
    return c.json(
      authError("unknown_taxonomy", "Pick a topic and level from the list.", {
        fieldErrors: tl.fieldErrors,
      }),
      400,
    );
  const dup = await findByUrl(db, checked.normalised);
  if (dup)
    return conflict(c, "duplicate", `Already in the library as “${dup.title}”.`, {
      existing: { id: dup.id, title: dup.title },
    });
  // Best effort: the page's preview image, kept small and same-origin-safe (a data: URL).
  const page = await safeFetch(checked.normalised, { readBody: true });
  const meta = parseMeta(page.html, page.finalUrl ?? checked.normalised);
  const thumbnail = page.ok ? await fetchThumbnail(meta.thumbnail) : null;
  const id = newId();
  const now = nowSec();
  const tags = await ensureTags(db, b.tags);
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO resources (id, url, url_normalised, title, source, type, creator, topic, level, license, rights,
             duration_min, thumbnail, intro, learning_goal, status, added_by, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?18)`,
        )
        .bind(
          id,
          b.url,
          checked.normalised,
          b.title,
          meta.siteName ?? hostOf(checked.normalised),
          b.type,
          b.creator,
          tl.topic,
          tl.level,
          b.license,
          b.rights,
          b.durationMin ?? meta.durationMin ?? null,
          thumbnail,
          b.intro,
          b.learningGoal,
          b.status,
          c.get("admin").id,
          now,
        ),
      ...setTagsStatements(db, id, tags),
    ]);
  } catch {
    const again = await findByUrl(db, checked.normalised);
    if (again)
      return conflict(c, "duplicate", `Already in the library as “${again.title}”.`, {
        existing: { id: again.id, title: again.title },
      });
    throw new Error("resource insert failed");
  }
  const attached = b.paths?.length ? await attachToPaths(db, id, b.paths) : [];
  await audit(c, {
    action: "content.resource.created",
    target: id,
    meta: { status: b.status, type: b.type, paths: attached.length },
  });
  const row = (await loadResource(c, id)) as ResourceRow;
  return c.json({ id, resource: await resourceOut(c, row), attachedToPaths: attached }, 201);
});

adminResources.get("/:id", requireAdmin("resources", "view"), async (c) => {
  const id = idParam(c);
  if (!id) return notFound(c, "That resource");
  const db = c.env.DB;
  const row = await loadResource(c, id);
  if (!row) return notFound(c, "That resource");
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [out, used, checks, failures, saved, done, groups] = await Promise.all([
    resourceOut(c, row),
    usedIn(db, id),
    db
      .prepare(
        "SELECT checked_at, ok, http_status, reason FROM link_checks WHERE resource_id = ? ORDER BY checked_at DESC, rowid DESC LIMIT 5",
      )
      .bind(id)
      .all<{ checked_at: number; ok: number; http_status: number | null; reason: string | null }>(),
    consecutiveFailures(db, id),
    db
      .prepare("SELECT COUNT(*) AS n FROM saved_resources WHERE resource_id = ?")
      .bind(id)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM path_lessons_done d JOIN path_lessons l ON l.id = d.lesson_id
          WHERE l.resource_id = ? AND d.completed_at >= ?`,
      )
      .bind(id, since)
      .first<{ n: number }>(),
    reportGroups(db, id),
  ]);
  const reports = groups.get(id) ?? [];
  const latest = toLinkCheck(checks.results[0]);
  return c.json({
    ...out,
    // "opened" is not tracked yet (the learner app does not log opens), so it is null, not 0.
    stats30d: {
      opened: null,
      saved: saved?.n ?? 0,
      done: done?.n ?? 0,
      brokenReports: reports.length,
    },
    linkCheck: {
      at: latest?.at ?? null,
      ok: latest?.ok ?? true,
      reason: latest?.reason ?? null,
      failures,
    },
    linkChecks: checks.results.map((r) => toLinkCheck(r)),
    reporters: new Set(reports.map((r) => r.userId)).size,
    usedIn: used,
  });
});

adminResources.patch("/:id", requireAdmin("resources", "manage"), async (c) => {
  const id = idParam(c);
  if (!id) return notFound(c, "That resource");
  const db = c.env.DB;
  const b = await body(c, patchResourceSchema);
  if (!b) return invalid(c);
  const row = await loadResource(c, id);
  if (!row) return notFound(c, "That resource");
  if (row.status === "retired") return conflict(c, "retired", "This resource is retired.");
  const tl = await resolveTopicLevel(db, b.topic, b.level);
  if (!tl.ok)
    return c.json(
      authError("unknown_taxonomy", "Pick a topic and level from the list.", {
        fieldErrors: tl.fieldErrors,
      }),
      400,
    );
  const sets: string[] = [];
  const binds: unknown[] = [];
  const map: Record<string, unknown> = {
    title: b.title,
    creator: b.creator,
    type: b.type,
    topic: tl.topic,
    level: tl.level,
    license: b.license,
    rights: b.rights,
    duration_min: b.durationMin,
    intro: b.intro,
    learning_goal: b.learningGoal,
    status: b.status,
  };
  for (const [col, v] of Object.entries(map)) {
    if (v === undefined) continue;
    sets.push(`${col} = ?`);
    binds.push(v);
  }
  const stmts: D1PreparedStatement[] = [];
  if (sets.length)
    stmts.push(
      db
        .prepare(`UPDATE resources SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`)
        .bind(...binds, nowSec(), id),
    );
  if (b.tags) stmts.push(...setTagsStatements(db, id, await ensureTags(db, b.tags)));
  if (stmts.length) await db.batch(stmts);
  await audit(c, {
    action: "content.resource.updated",
    target: id,
    meta: { fields: Object.keys(b).join(","), ...(b.status ? { status: b.status } : {}) },
  });
  const live = await db
    .prepare(
      `SELECT COUNT(DISTINCT p.id) AS n FROM path_lessons l JOIN paths p ON p.id = l.path_id
        WHERE l.resource_id = ? AND p.status = 'live'`,
    )
    .bind(id)
    .first<{ n: number }>();
  return c.json({
    ...(await resourceOut(c, (await loadResource(c, id)) as ResourceRow)),
    usedInLivePaths: live?.n ?? 0,
  });
});

adminResources.post("/:id/fix-link", requireAdmin("resources", "manage"), async (c) => {
  const id = idParam(c);
  if (!id) return notFound(c, "That resource");
  const db = c.env.DB;
  const b = await body(c, fixLinkSchema);
  if (!b) return invalid(c, { fieldErrors: { url: "Paste a full https:// link." } });
  const row = await loadResource(c, id);
  if (!row) return notFound(c, "That resource");
  if (row.status === "retired") return conflict(c, "retired", "This resource is retired.");
  const checked = checkSubmissionUrl(b.url);
  if (!checked.ok)
    return c.json(
      authError("invalid_url", "That link can’t be used. Use a public https:// link."),
      400,
    );
  const dup = await findByUrl(db, checked.normalised, id);
  if (dup)
    return conflict(c, "duplicate", `Already in the library as “${dup.title}”.`, {
      existing: { id: dup.id, title: dup.title },
    });
  const limited = await rateLimited(c);
  if (limited) return limited;
  const page = await safeFetch(checked.normalised);
  if (!page.ok)
    return c.json(
      authError("link_not_working", "That link doesn’t open. Check it and try again.", {
        reason: page.reason,
      }),
      422,
    );
  const now = nowSec();
  const reports = (await reportGroups(db, id)).get(id) ?? [];
  await db.batch([
    db
      .prepare(
        `UPDATE resources SET url = ?2, url_normalised = ?3,
           status = CASE WHEN status = 'needs_fix' THEN 'live' ELSE status END, updated_at = ?4 WHERE id = ?1`,
      )
      .bind(id, b.url, checked.normalised, now),
    db
      .prepare(
        "INSERT INTO link_checks (id, resource_id, checked_at, ok, http_status, reason) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind(newId(), id, now, page.status, page.reason),
    db
      .prepare(
        `INSERT INTO link_report_state (resource_id, status, handled_by, handled_at, updated_at)
         VALUES (?1, 'fixed', ?2, ?3, ?3)
         ON CONFLICT (resource_id) DO UPDATE SET status = 'fixed', handled_by = ?2, handled_at = ?3, updated_at = ?3`,
      )
      .bind(id, c.get("admin").id, now),
  ]);
  let notified = 0;
  if (b.notifyReporters && reports.length) {
    const seen = new Set<string>();
    for (const r of reports.slice(0, 200)) {
      if (seen.has(r.userId)) continue;
      seen.add(r.userId);
      await createNotification(db, {
        userId: r.userId,
        kind: "report-fixed",
        title: "We fixed the link you reported",
        body: row.title,
        href: `/learn/help?ticket=${r.ticketId}`,
      });
      notified++;
    }
    for (const r of reports.slice(0, 200))
      await db
        .prepare(
          "UPDATE support_tickets SET status = 'fixed', updated_at = ?2 WHERE id = ?1 AND status NOT IN ('resolved', 'fixed', 'cant_reproduce')",
        )
        .bind(r.ticketId, now)
        .run();
  }
  await audit(c, {
    action: "content.resource.link_fixed",
    target: id,
    meta: { reports: reports.length, notified },
  });
  return c.json({
    ...(await resourceOut(c, (await loadResource(c, id)) as ResourceRow)),
    notified,
  });
});

adminResources.post("/:id/retire", requireAdmin("resources", "manage"), async (c) => {
  const id = idParam(c);
  if (!id) return notFound(c, "That resource");
  const db = c.env.DB;
  if (!(await body(c, retireSchema)))
    return invalid(c, { fieldErrors: { confirm: "Confirm to retire this resource." } });
  const now = nowSec();
  const changed = await db
    .prepare(
      "UPDATE resources SET status = 'retired', retired_at = ?2, updated_at = ?2 WHERE id = ?1 AND status <> 'retired'",
    )
    .bind(id, now)
    .run();
  if (!changed.meta.changes) {
    return (await loadResource(c, id))
      ? conflict(c, "retired", "This resource is already retired.")
      : notFound(c, "That resource");
  }
  // Lessons keep pointing at it and show as unavailable (publish-check and preview flag them).
  // `notifyOwners` is accepted and ignored: the admin notification feed is not part of this module.
  const flagged = await usedIn(db, id);
  await audit(c, {
    action: "content.resource.retired",
    target: id,
    meta: { lessons: flagged.length },
  });
  return c.json({
    ...(await resourceOut(c, (await loadResource(c, id)) as ResourceRow)),
    flaggedLessons: flagged,
  });
});
