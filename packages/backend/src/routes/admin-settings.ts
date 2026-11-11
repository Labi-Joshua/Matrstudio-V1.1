import {
  emailTemplateSchema,
  homeCurationSchema,
  nudgeRulesSchema,
  queueTargetsSchema,
  taxonomyCreateSchema,
  taxonomyDeleteSchema,
  taxonomyMergeSchema,
  taxonomyPatchSchema,
} from "@matr/types";
import { Hono } from "hono";
import { type AdminCtx, requireAdmin } from "../auth/admin-guard";
import { authError } from "../auth/guard";
import { hit, LIMITS } from "../auth/limits";
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
  qmarks,
  slugify,
} from "../content/common";
import { DEFAULT_TARGETS } from "../content/review";
import {
  loadTemplate,
  render,
  SAMPLE,
  TEMPLATES,
  templateByKey,
  unknownVariables,
} from "../content/templates";
import { enqueueAuthEmail } from "../queue/auth-email";

// Mounted by routes/admin.ts after requireAccess (lock 1); requireAdmin adds lock 2 and the role check.
// Everything needs settings (view to read, manage to write), except Home curation, which is guarded
// by resources (so a Curator can change it without getting the rest of Settings).
export const adminSettings = new Hono<AdminCtx>();

// --- key/value helpers -----------------------------------------------------------------------
async function getKv<T>(db: D1Database, key: string, fallback: T): Promise<T> {
  const row = await db
    .prepare("SELECT value FROM settings_kv WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}
const setKv = (c: C, key: string, value: unknown) =>
  c.env.DB.prepare(
    `INSERT INTO settings_kv (key, value, updated_by, updated_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (key) DO UPDATE SET value = ?2, updated_by = ?3, updated_at = ?4`,
  )
    .bind(key, JSON.stringify(value), c.get("admin").id, nowSec())
    .run();

// --- taxonomy ----------------------------------------------------------------------------------
type Tax = { id: string; kind: "topic" | "tag" | "level"; slug: string; name: string };

async function usage(db: D1Database, t: Tax) {
  if (t.kind === "tag") {
    const r = await db
      .prepare("SELECT COUNT(*) AS n FROM resource_tags WHERE tag = ?")
      .bind(t.slug)
      .first<{ n: number }>();
    return { resources: r?.n ?? 0, paths: 0 };
  }
  const col = t.kind;
  const [r, p] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS n FROM resources WHERE ${col} = ? AND status <> 'retired'`)
      .bind(t.slug)
      .first<{ n: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM paths WHERE ${col} = ?`)
      .bind(t.slug)
      .first<{ n: number }>(),
  ]);
  return { resources: r?.n ?? 0, paths: p?.n ?? 0 };
}

const loadTax = (c: C, id: string | null) =>
  id
    ? c.env.DB.prepare("SELECT id, kind, slug, name FROM taxonomy WHERE id = ?")
        .bind(id)
        .first<Tax>()
    : null;

/** Points every resource, path and tag row at `into` instead of `from`. */
function moveStatements(db: D1Database, from: Tax, into: Tax) {
  if (from.kind === "tag")
    return [
      db
        .prepare("UPDATE OR IGNORE resource_tags SET tag = ? WHERE tag = ?")
        .bind(into.slug, from.slug),
      db.prepare("DELETE FROM resource_tags WHERE tag = ?").bind(from.slug),
    ];
  const col = from.kind;
  return [
    db
      .prepare(`UPDATE resources SET ${col} = ?, updated_at = ? WHERE ${col} = ?`)
      .bind(into.slug, nowSec(), from.slug),
    db
      .prepare(`UPDATE paths SET ${col} = ?, updated_at = ? WHERE ${col} = ?`)
      .bind(into.slug, nowSec(), from.slug),
  ];
}

adminSettings.get("/taxonomy", requireAdmin("settings", "view"), async (c) => {
  const db = c.env.DB;
  const kind = c.req.query("kind");
  const rows = await db
    .prepare(
      `SELECT id, kind, slug, name FROM taxonomy ${kind ? "WHERE kind = ?" : ""} ORDER BY kind, name COLLATE NOCASE LIMIT 500`,
    )
    .bind(...(kind ? [kind] : []))
    .all<Tax>();
  const items = [];
  for (const t of rows.results) items.push({ ...t, ...(await usage(db, t)) });
  return c.json({ items });
});

adminSettings.post("/taxonomy", requireAdmin("settings", "manage"), async (c) => {
  const b = await body(c, taxonomyCreateSchema);
  if (!b) return invalid(c);
  const slug = slugify(b.name);
  if (!slug) return invalid(c, { fieldErrors: { name: "Use letters or numbers." } });
  const id = newId();
  const res = await c.env.DB.prepare(
    "INSERT OR IGNORE INTO taxonomy (id, kind, slug, name, created_at) VALUES (?, ?, ?, ?, unixepoch())",
  )
    .bind(id, b.kind, slug, b.name)
    .run();
  if (!res.meta.changes)
    return conflict(c, "name_taken", `There’s already a ${b.kind} called that.`);
  await audit(c, { action: "settings.taxonomy.created", target: id, meta: { kind: b.kind } });
  return c.json({ item: { id, kind: b.kind, slug, name: b.name, resources: 0, paths: 0 } }, 201);
});

adminSettings.patch("/taxonomy/:id", requireAdmin("settings", "manage"), async (c) => {
  const t = await loadTax(c, idParam(c));
  if (!t) return notFound(c, "That item");
  const b = await body(c, taxonomyPatchSchema);
  if (!b) return invalid(c);
  // The slug stays, so nothing that points at it changes; only the display name does.
  await c.env.DB.prepare("UPDATE taxonomy SET name = ? WHERE id = ?").bind(b.name, t.id).run();
  await audit(c, { action: "settings.taxonomy.renamed", target: t.id, meta: { kind: t.kind } });
  return c.json({ item: { ...t, name: b.name, ...(await usage(c.env.DB, t)) } });
});

adminSettings.get("/taxonomy/:id/usage", requireAdmin("settings", "view"), async (c) => {
  const t = await loadTax(c, idParam(c));
  return t ? c.json({ item: t, ...(await usage(c.env.DB, t)) }) : notFound(c, "That item");
});

adminSettings.post("/taxonomy/:id/merge", requireAdmin("settings", "manage"), async (c) => {
  const db = c.env.DB;
  const from = await loadTax(c, idParam(c));
  if (!from) return notFound(c, "That item");
  const b = await body(c, taxonomyMergeSchema);
  if (!b) return invalid(c);
  const into = await loadTax(c, b.into);
  if (!into || into.id === from.id || into.kind !== from.kind)
    return invalid(c, { fieldErrors: { into: "Pick another item of the same kind." } });
  const moved = await usage(db, from);
  await db.batch([
    ...moveStatements(db, from, into),
    db.prepare("DELETE FROM taxonomy WHERE id = ?").bind(from.id),
  ]);
  await audit(c, {
    action: "settings.taxonomy.merged",
    target: from.id,
    meta: { kind: from.kind, into: into.id, resources: moved.resources, paths: moved.paths },
  });
  return c.json({ merged: true, moved, into });
});

adminSettings.delete("/taxonomy/:id", requireAdmin("settings", "manage"), async (c) => {
  const db = c.env.DB;
  const t = await loadTax(c, idParam(c));
  if (!t) return notFound(c, "That item");
  const text = await c.req.text().catch(() => "");
  let raw: unknown = {};
  try {
    raw = text.trim() ? JSON.parse(text) : {};
  } catch {
    return invalid(c);
  }
  const parsed = taxonomyDeleteSchema.safeParse(raw);
  if (!parsed.success) return invalid(c);
  const used = await usage(db, t);
  const inUse = used.resources + used.paths > 0;
  const { mode, into } = parsed.data;
  if (inUse && !mode) return conflict(c, "in_use", "This is in use.", used);
  // A resource or path always has a topic and a level, so those can only be moved, not removed.
  if (inUse && mode === "remove" && t.kind !== "tag")
    return invalid(c, { fieldErrors: { mode: "Move these to another one instead." } });
  const stmts: D1PreparedStatement[] = [];
  if (inUse && mode === "move") {
    const target = into ? await loadTax(c, into) : null;
    if (!target || target.id === t.id || target.kind !== t.kind)
      return invalid(c, { fieldErrors: { into: "Pick another item of the same kind." } });
    stmts.push(...moveStatements(db, t, target));
  } else if (inUse) stmts.push(db.prepare("DELETE FROM resource_tags WHERE tag = ?").bind(t.slug));
  stmts.push(db.prepare("DELETE FROM taxonomy WHERE id = ?").bind(t.id));
  await db.batch(stmts);
  await audit(c, {
    action: "settings.taxonomy.deleted",
    target: t.id,
    meta: { kind: t.kind, mode: mode ?? "unused", resources: used.resources, paths: used.paths },
  });
  return c.json({ deleted: true, affected: used });
});

// --- home curation (resources:manage, so Curators can edit it) ---------------------------------
type Curation = {
  featuredPaths: string[];
  libraryPicks: string[];
  popularRules: {
    rankBy: string;
    window: string;
    hideReported: boolean;
    minLearners: number | null;
  };
};
const DEFAULT_CURATION: Curation = {
  featuredPaths: [],
  libraryPicks: [],
  popularRules: { rankBy: "opens", window: "30d", hideReported: true, minLearners: null },
};

async function curationView(db: D1Database) {
  const cur = { ...DEFAULT_CURATION, ...(await getKv<Partial<Curation>>(db, "home_curation", {})) };
  const featured = [];
  for (const id of cur.featuredPaths) {
    const p = await db
      .prepare(
        `SELECT p.id, p.title, p.level, p.status,
                (SELECT COUNT(*) FROM path_enrolments e WHERE e.path_slug = p.slug AND e.started_at IS NOT NULL) AS learners
           FROM paths p WHERE p.id = ?`,
      )
      .bind(id)
      .first<{ id: string; title: string; level: string; status: string; learners: number }>();
    if (p && p.status === "live")
      featured.push({ id: p.id, title: p.title, level: p.level, learners: p.learners });
  }
  const picks = [];
  for (const id of cur.libraryPicks) {
    const r = await db
      .prepare("SELECT id, title, type, duration_min, status FROM resources WHERE id = ?")
      .bind(id)
      .first<{
        id: string;
        title: string;
        type: string;
        duration_min: number | null;
        status: string;
      }>();
    if (r && r.status === "live")
      picks.push({ id: r.id, title: r.title, type: r.type, durationMin: r.duration_min });
  }
  return { featuredPaths: featured, libraryPicks: picks, popularRules: cur.popularRules };
}

adminSettings.get("/home-curation", requireAdmin("resources", "view"), async (c) =>
  c.json(await curationView(c.env.DB)),
);

adminSettings.put("/home-curation", requireAdmin("resources", "manage"), async (c) => {
  const db = c.env.DB;
  const b = await body(c, homeCurationSchema);
  if (
    !b ||
    new Set(b.featuredPaths).size !== b.featuredPaths.length ||
    new Set(b.libraryPicks).size !== b.libraryPicks.length
  )
    return invalid(c);
  const fp = b.featuredPaths.length
    ? await db
        .prepare(
          `SELECT COUNT(*) AS n FROM paths WHERE status = 'live' AND id IN (${qmarks(b.featuredPaths.length)})`,
        )
        .bind(...b.featuredPaths)
        .first<{ n: number }>()
    : { n: 0 };
  const lp = b.libraryPicks.length
    ? await db
        .prepare(
          `SELECT COUNT(*) AS n FROM resources WHERE status = 'live' AND id IN (${qmarks(b.libraryPicks.length)})`,
        )
        .bind(...b.libraryPicks)
        .first<{ n: number }>()
    : { n: 0 };
  if (fp?.n !== b.featuredPaths.length)
    return invalid(c, { fieldErrors: { featuredPaths: "Only live paths can be featured." } });
  if (lp?.n !== b.libraryPicks.length)
    return invalid(c, { fieldErrors: { libraryPicks: "Only live resources can be picked." } });
  await setKv(c, "home_curation", b);
  await audit(c, {
    action: "settings.home_curation.updated",
    target: "home_curation",
    meta: { featured: b.featuredPaths.length, picks: b.libraryPicks.length },
  });
  return c.json(await curationView(db));
});

// --- email templates -------------------------------------------------------------------------
const templateJson = (t: NonNullable<Awaited<ReturnType<typeof loadTemplate>>>) => ({
  key: t.def.key,
  name: t.def.label,
  when: t.def.usedBy,
  variables: t.def.variables,
  subject: t.subject,
  body: t.body,
  customised: t.customised,
  // false = the text is stored but the sending code does not read it yet.
  wired: t.def.wired,
  updatedAt: t.updatedAt ? new Date(t.updatedAt * 1000).toISOString() : null,
  preview: { subject: render(t.subject, SAMPLE), body: render(t.body, SAMPLE) },
});

adminSettings.get("/email-templates", requireAdmin("settings", "view"), async (c) => {
  const out = [];
  for (const d of TEMPLATES) {
    const t = await loadTemplate(c.env.DB, d.key);
    if (t) out.push(templateJson(t));
  }
  return c.json({ items: out, templates: out });
});

adminSettings.get("/email-templates/:key", requireAdmin("settings", "view"), async (c) => {
  const t = await loadTemplate(c.env.DB, c.req.param("key"));
  return t
    ? c.json({ ...templateJson(t), template: templateJson(t) })
    : notFound(c, "That template");
});

adminSettings.put("/email-templates/:key", requireAdmin("settings", "manage"), async (c) => {
  const def = templateByKey(c.req.param("key"));
  if (!def) return notFound(c, "That template");
  const b = await body(c, emailTemplateSchema);
  if (!b) return invalid(c);
  const bad = [
    ...unknownVariables(b.subject, def.variables),
    ...unknownVariables(b.body, def.variables),
  ];
  if (bad.length)
    return c.json(
      authError(
        "unknown_variable",
        `These can’t be used here: ${[...new Set(bad)].map((v) => `{{${v}}}`).join(", ")}`,
        {
          allowed: def.variables,
        },
      ),
      400,
    );
  if (b.subject === def.subject && b.body === def.body)
    await c.env.DB.prepare("DELETE FROM email_templates WHERE key = ?").bind(def.key).run();
  else
    await c.env.DB.prepare(
      `INSERT INTO email_templates (key, subject, body, updated_by, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (key) DO UPDATE SET subject = ?2, body = ?3, updated_by = ?4, updated_at = ?5`,
    )
      .bind(def.key, b.subject, b.body, c.get("admin").id, nowSec())
      .run();
  await audit(c, { action: "settings.email_template.updated", target: def.key });
  const fresh = templateJson(
    (await loadTemplate(c.env.DB, def.key)) as NonNullable<
      Awaited<ReturnType<typeof loadTemplate>>
    >,
  );
  return c.json({ ...fresh, template: fresh });
});

// Test sends go only to the signed-in admin's own address, never to an address in the request.
adminSettings.post("/email-templates/:key/test", requireAdmin("settings", "manage"), async (c) => {
  const t = await loadTemplate(c.env.DB, c.req.param("key"));
  if (!t) return notFound(c, "That template");
  const limit = await hit(c.env.DB, `admin-test-email:${c.get("admin").id}`, LIMITS.adminTestEmail);
  if (!limit.allowed) {
    c.header("Retry-After", String(limit.retryAfterSec));
    return c.json(
      authError("rate_limited", "You’ve sent a lot of test emails. Try again later.", {
        retryAfterSeconds: limit.retryAfterSec,
      }),
      429,
    );
  }
  await enqueueAuthEmail(c.env, {
    type: "staff-message",
    to: c.get("admin").email,
    subject: `[Test] ${render(t.subject, SAMPLE)}`,
    message: render(t.body, SAMPLE),
  });
  await audit(c, { action: "settings.email_template.test_sent", target: t.def.key });
  return c.json({ sent: true });
});

// --- nudge rules and queue targets -------------------------------------------------------------
const DEFAULT_NUDGE = { enabled: true, firstAfterDays: 3, secondAfterDays: 7, maxPerWeek: 2 };

adminSettings.get("/nudge-rules", requireAdmin("settings", "view"), async (c) =>
  c.json({
    ...DEFAULT_NUDGE,
    ...(await getKv(c.env.DB, "nudge_rules", {})),
    alwaysOn: true,
    template: "continue-learning",
    // The reminder sender is a later task; these are the rules it will read.
    wired: false,
  }),
);

adminSettings.put("/nudge-rules", requireAdmin("settings", "manage"), async (c) => {
  const b = await body(c, nudgeRulesSchema);
  if (!b) return invalid(c);
  await setKv(c, "nudge_rules", b);
  await audit(c, { action: "settings.nudge_rules.updated", target: "nudge_rules" });
  return c.json({ ...b, alwaysOn: true, template: "continue-learning", wired: false });
});

adminSettings.get("/queue-targets", requireAdmin("settings", "view"), async (c) =>
  c.json({ ...DEFAULT_TARGETS, ...(await getKv(c.env.DB, "queue_targets", {})) }),
);

adminSettings.put("/queue-targets", requireAdmin("settings", "manage"), async (c) => {
  const b = await body(c, queueTargetsSchema);
  if (!b) return invalid(c);
  await setKv(c, "queue_targets", b);
  await audit(c, {
    action: "settings.queue_targets.updated",
    target: "queue_targets",
    meta: {
      submissionDays: b.submissionDays,
      linkReportDays: b.linkReportDays,
      firstReplyDays: b.firstReplyDays,
      autoResolveDays: b.autoResolveDays,
      workingDays: b.workingDays.join(","),
    },
  });
  return c.json(b);
});
