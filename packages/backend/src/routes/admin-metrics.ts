import { METRIC_TABS, type MetricTab } from "@matr/types";
import { Hono } from "hono";
import { audit, type C, invalid, notFound, toCsv } from "../admin/common";
import { deltaPct, iso, type Period, pct, type ResolvedRange, resolveRange } from "../admin/range";
import { activeLearners, activeSeries, supportAgg } from "../admin/stats";
import { type AdminCtx, requireAdmin } from "../auth/admin-guard";

// GET /api/admin/metrics/{learners,paths,paths/:slug,library,emails,support}?range&from&to
// GET /api/admin/metrics/:tab/export  (CSV of the same numbers)       Guard: metrics:view
// Every figure is { value, previous, deltaPct } against the equally long period before. Counts come
// from the live tables; anything the platform does not record yet says `available: false`.
export const adminMetrics = new Hono<AdminCtx>();

const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;
type Metric = { value: number | null; previous: number | null; deltaPct: number | null };
const m = (value: number | null, previous: number | null): Metric => ({
  value,
  previous,
  deltaPct: deltaPct(value, previous),
});
const both = async <T>(r: ResolvedRange, f: (p: Period) => Promise<T>) =>
  Promise.all([f(r.current), f(r.previous)]);
const ivl = (p: Period) => [iso(p.start), iso(p.end)] as const;
const one = async (db: D1Database, sql: string, ...a: unknown[]) =>
  (
    await db
      .prepare(sql)
      .bind(...a)
      .first<{ n: number }>()
  )?.n ?? 0;
const rangeOut = (r: ResolvedRange) => ({
  key: r.key,
  from: iso(r.current.start),
  to: iso(r.current.end),
  previousFrom: iso(r.previous.start),
  previousTo: iso(r.previous.end),
});

async function learners(db: D1Database, r: ResolvedRange) {
  const monthly = (p: Period) => activeLearners(db, { start: p.end - 30 * 86400, end: p.end });
  const returning = async (p: Period) =>
    one(
      db,
      `SELECT COUNT(DISTINCT a.uid) AS n FROM (
         SELECT userId AS uid FROM session WHERE updatedAt >= ?1 AND updatedAt < ?2
         UNION SELECT user_id FROM path_lessons_done WHERE completed_at >= ?1 AND completed_at < ?2
         UNION SELECT user_id FROM path_enrolments WHERE last_activity_at >= ?1 AND last_activity_at < ?2) a
       JOIN user u ON u.id = a.uid WHERE u.createdAt < ?1`,
      ...ivl(p),
    );
  const lessons = (p: Period) =>
    one(
      db,
      "SELECT COUNT(*) AS n FROM path_lessons_done WHERE completed_at >= ?1 AND completed_at < ?2",
      ...ivl(p),
    );
  const funnel = async (p: Period) => ({
    invited: await one(
      db,
      "SELECT COUNT(*) AS n FROM waitlist_invites WHERE invited_at >= ?1 AND invited_at < ?2",
      p.start,
      p.end,
    ),
    created: await one(
      db,
      "SELECT COUNT(*) AS n FROM user WHERE createdAt >= ?1 AND createdAt < ?2",
      ...ivl(p),
    ),
    confirmed: await one(
      db,
      "SELECT COUNT(*) AS n FROM user WHERE createdAt >= ?1 AND createdAt < ?2 AND emailVerified = 1",
      ...ivl(p),
    ),
    onboarded: await one(
      db,
      "SELECT COUNT(*) AS n FROM onboarding WHERE completed_at >= ?1 AND completed_at < ?2",
      p.start,
      p.end,
    ),
  });
  const [[wa, wap], [ma, map], [ret, retP], [les, lesP], [f, fp], [sc, sp]] = await Promise.all([
    both(r, (p) => activeLearners(db, p)),
    both(r, monthly),
    both(r, returning),
    both(r, lessons),
    both(r, funnel),
    both(r, (p) => activeSeries(db, p, r.bucket)),
  ]);
  const per = (l: number, a: number) => (a > 0 ? Math.round((l / a) * 10) / 10 : null);
  return {
    stats: {
      weeklyActive: m(wa, wap),
      monthlyActive: m(ma, map),
      returningLearnersPct: m(pct(ret, wa), pct(retP, wap)),
      lessonsPerLearner: m(per(les, wa), per(lesP, wap)),
    },
    // Counts of events inside the period (not a cohort), so a stage can exceed the one before it.
    funnel: [
      { key: "invited", ...m(f.invited, fp.invited) },
      { key: "created_account", ...m(f.created, fp.created) },
      { key: "confirmed_email", ...m(f.confirmed, fp.confirmed) },
      { key: "finished_onboarding", ...m(f.onboarded, fp.onboarded) },
    ],
    series: { title: "Weekly active learners", current: sc, previous: sp },
  };
}

type PathAgg = { slug: string; started: number; completed: number; avgHours: number | null };
async function pathAgg(db: D1Database, p: Period): Promise<Map<string, PathAgg>> {
  const [a, b] = ivl(p);
  const started = await db
    .prepare(
      "SELECT path_slug AS slug, COUNT(*) AS n FROM path_enrolments WHERE started_at >= ?1 AND started_at < ?2 GROUP BY path_slug",
    )
    .bind(a, b)
    .all<{ slug: string; n: number }>();
  const done = await db
    .prepare(
      `SELECT path_slug AS slug, COUNT(*) AS n,
         AVG((julianday(completed_at) - julianday(started_at)) * 24) AS hrs
       FROM path_enrolments WHERE completed_at >= ?1 AND completed_at < ?2 AND started_at IS NOT NULL
       GROUP BY path_slug`,
    )
    .bind(a, b)
    .all<{ slug: string; n: number; hrs: number | null }>();
  const out = new Map<string, PathAgg>();
  const get = (slug: string) => {
    let v = out.get(slug);
    if (!v) {
      v = { slug, started: 0, completed: 0, avgHours: null };
      out.set(slug, v);
    }
    return v;
  };
  for (const s of started.results) get(s.slug).started = s.n;
  for (const d of done.results) {
    const v = get(d.slug);
    v.completed = d.n;
    v.avgHours = d.hrs == null ? null : Math.round(d.hrs * 10) / 10;
  }
  return out;
}

async function paths(db: D1Database, r: ResolvedRange) {
  const [cur, prev] = await both(r, (p) => pathAgg(db, p));
  const [a, b] = ivl(r.current);
  // Where unfinished learners stopped: the lesson most often done last, per path.
  const drops = await db
    .prepare(
      `WITH last AS (
         SELECT d.path_slug, d.lesson_id,
                ROW_NUMBER() OVER (PARTITION BY d.user_id, d.path_slug ORDER BY d.completed_at DESC) AS rn
           FROM path_lessons_done d
           JOIN path_enrolments e ON e.user_id = d.user_id AND e.path_slug = d.path_slug
          WHERE e.started_at >= ?1 AND e.started_at < ?2 AND e.completed_at IS NULL)
       SELECT path_slug, lesson_id, COUNT(*) AS n FROM last WHERE rn = 1 GROUP BY path_slug, lesson_id`,
    )
    .bind(a, b)
    .all<{ path_slug: string; lesson_id: string; n: number }>();
  const worst = new Map<string, { lessonId: string; learners: number }>();
  for (const d of drops.results) {
    const w = worst.get(d.path_slug);
    if (!w || d.n > w.learners) worst.set(d.path_slug, { lessonId: d.lesson_id, learners: d.n });
  }
  const rows = [...cur.values()]
    .sort((x, y) => y.started - x.started)
    .map((x) => {
      const p = prev.get(x.slug);
      return {
        slug: x.slug,
        started: m(x.started, p?.started ?? 0),
        completed: m(x.completed, p?.completed ?? 0),
        completionRatePct: m(pct(x.completed, x.started), p ? pct(p.completed, p.started) : null),
        avgHoursToFinish: m(x.avgHours, p?.avgHours ?? null),
        dropOffLesson: worst.get(x.slug) ?? null,
      };
    });
  return { paths: rows };
}

async function pathDetail(db: D1Database, r: ResolvedRange, slug: string) {
  const [cur, prev] = await both(r, (p) => pathAgg(db, p));
  const c = cur.get(slug);
  const p = prev.get(slug);
  const [a, b] = ivl(r.current);
  // The catalogue is not in D1, so lessons are ordered by when each was first completed.
  const lessons = await db
    .prepare(
      `SELECT d.lesson_id, COUNT(DISTINCT d.user_id) AS n, MIN(d.completed_at) AS first_at
         FROM path_lessons_done d
         JOIN path_enrolments e ON e.user_id = d.user_id AND e.path_slug = d.path_slug
        WHERE d.path_slug = ?1 AND e.started_at >= ?2 AND e.started_at < ?3
        GROUP BY d.lesson_id ORDER BY first_at, d.lesson_id`,
    )
    .bind(slug, a, b)
    .all<{ lesson_id: string; n: number }>();
  const started = c?.started ?? 0;
  const rows = lessons.results.map((l, i) => ({
    index: i + 1,
    lessonId: l.lesson_id,
    learners: l.n,
    pct: pct(l.n, started),
  }));
  let biggestDrop: { afterLessonIndex: number; afterLessonId: string; dropPct: number } | null =
    null;
  for (let i = 0; i + 1 < rows.length; i++) {
    const x = rows[i];
    const y = rows[i + 1];
    if (!x || !y || x.learners === 0) continue;
    const drop = Math.round(((x.learners - y.learners) / x.learners) * 100);
    if (drop > 0 && (!biggestDrop || drop > biggestDrop.dropPct))
      biggestDrop = { afterLessonIndex: x.index, afterLessonId: x.lessonId, dropPct: drop };
  }
  return {
    slug,
    stats: {
      started: m(started, p?.started ?? 0),
      completed: m(c?.completed ?? 0, p?.completed ?? 0),
      completionRatePct: m(
        c ? pct(c.completed, c.started) : null,
        p ? pct(p.completed, p.started) : null,
      ),
      avgHoursToFinish: m(c?.avgHours ?? null, p?.avgHours ?? null),
    },
    lessons: rows,
    biggestDrop,
  };
}

async function library(db: D1Database, r: ResolvedRange) {
  const top = await db
    .prepare(
      `SELECT resource_id, COUNT(*) AS n FROM saved_resources WHERE created_at >= ?1 AND created_at < ?2
        GROUP BY resource_id ORDER BY n DESC, resource_id LIMIT 4`,
    )
    .bind(r.current.start, r.current.end)
    .all<{ resource_id: string; n: number }>();
  const [s, sp] = await both(r, (p) =>
    one(
      db,
      "SELECT COUNT(*) AS n FROM saved_resources WHERE created_at >= ?1 AND created_at < ?2",
      p.start,
      p.end,
    ),
  );
  return {
    saves: m(s, sp),
    mostSaved: top.results.map((x) => ({ resourceId: x.resource_id, saves: x.n })),
    // The learner app does not record opens or searches yet: honest empties, not zeros.
    mostOpened: { available: false, items: [] },
    noResultSearches: { available: false, items: [] },
  };
}

async function emails(db: D1Database, r: ResolvedRange) {
  const day = (p: Period) => [iso(p.start).slice(0, 10), iso(p.end - 1).slice(0, 10)] as const;
  const [a, b] = day(r.current);
  const types = await db
    .prepare(
      "SELECT type, SUM(sent) AS sent, SUM(dropped) AS dropped FROM email_daily WHERE day >= ?1 AND day <= ?2 GROUP BY type ORDER BY sent DESC",
    )
    .bind(a, b)
    .all<{ type: string; sent: number; dropped: number }>();
  const [inv, invP] = await both(r, (p) =>
    db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(u.id IS NOT NULL), 0) AS joined
           FROM waitlist_invites wi JOIN waitlist_subscribers s ON s.id = wi.subscriber_id
           LEFT JOIN user u ON u.email = lower(s.email)
          WHERE wi.invited_at >= ?1 AND wi.invited_at < ?2`,
      )
      .bind(p.start, p.end)
      .first<{ n: number; joined: number }>(),
  );
  const [joins, joinsP] = await both(r, (p) =>
    one(
      db,
      "SELECT COUNT(*) AS n FROM waitlist_subscribers WHERE status = 'verified' AND created_at >= ?1 AND created_at < ?2",
      p.start,
      p.end,
    ),
  );
  const [unsub, unsubP] = await both(r, (p) =>
    one(
      db,
      "SELECT COUNT(*) AS n FROM waitlist_subscribers WHERE status = 'unsubscribed' AND updated_at >= ?1 AND updated_at < ?2",
      p.start,
      p.end,
    ),
  );
  return {
    stats: {
      inviteAcceptancePct: m(
        inv ? pct(inv.joined, inv.n) : null,
        invP ? pct(invP.joined, invP.n) : null,
      ),
      mailingListJoins: m(joins, joinsP),
      unsubscribes: m(unsub, unsubP),
      continueLearningReturns: { available: false },
    },
    // Sent and dropped are counted from the email queue since this shipped. Opens and clicks are
    // not tracked on purpose (a tracked link would send one-time tokens through a third party).
    templates: types.results.map((t) => ({
      type: t.type,
      sent: t.sent,
      dropped: t.dropped,
      opened: null,
      clicked: null,
    })),
  };
}

async function support(db: D1Database, r: ResolvedRange) {
  const [cur, prev] = await both(r, (p) => supportAgg(db, p));
  const groups = (kind: string) =>
    db
      .prepare(
        `SELECT COALESCE(category, 'Other') AS category, COUNT(*) AS n FROM support_tickets
          WHERE kind = ?1 AND created_at >= ?2 AND created_at < ?3 GROUP BY category ORDER BY n DESC LIMIT 12`,
      )
      .bind(kind, r.current.start, r.current.end)
      .all<{ category: string; n: number }>();
  const [topics, reports] = await Promise.all([groups("support"), groups("report")]);
  return {
    stats: {
      requestsOpened: m(cur.opened, prev.opened),
      avgFirstReplyHours: m(cur.avgFirstReplyHours, prev.avgFirstReplyHours),
      repliedWithinTargetPct: m(cur.repliedWithinTargetPct, prev.repliedWithinTargetPct),
      resolved: m(cur.resolved, prev.resolved),
    },
    requestsByTopic: topics.results.map((x) => ({ category: x.category, count: x.n })),
    problemReportsByType: reports.results.map((x) => ({ category: x.category, count: x.n })),
  };
}

function flatten(v: unknown, key: string, out: Array<[string, string | number | null]>) {
  if (v === null || typeof v !== "object") {
    out.push([key, v as string | number | null]);
  } else if (Array.isArray(v)) {
    for (const [i, x] of v.entries()) flatten(x, `${key}.${i + 1}`, out);
  } else {
    for (const [k, x] of Object.entries(v)) flatten(x, key ? `${key}.${k}` : k, out);
  }
}

async function compute(c: C, tab: MetricTab, r: ResolvedRange) {
  const db = c.env.DB;
  switch (tab) {
    case "learners":
      return learners(db, r);
    case "paths":
      return paths(db, r);
    case "library":
      return library(db, r);
    case "emails":
      return emails(db, r);
    case "support":
      return support(db, r);
  }
}

// Registered first so "export" is never read as a path id.
adminMetrics.get("/:tab/export", requireAdmin("metrics", "view"), async (c) => {
  const tab = c.req.param("tab") as MetricTab;
  const range = resolveRange(c.req.query());
  if (!(METRIC_TABS as readonly string[]).includes(tab) || !range) return invalid(c);
  const data = await compute(c, tab, range);
  const flat: Array<[string, string | number | null]> = [];
  flatten(data, "", flat);
  const rows: Array<Array<string | number | null>> = [
    ["metric", "value"],
    ["range_from", iso(range.current.start)],
    ["range_to", iso(range.current.end)],
    ...flat,
  ];
  await audit(c, "admin.metrics.exported", null, { tab, range: range.key });
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="matr-metrics-${tab}.csv"`);
  c.header("Cache-Control", "no-store");
  return c.body(toCsv(rows));
});

adminMetrics.get("/paths/:slug", requireAdmin("metrics", "view"), async (c) => {
  const slug = c.req.param("slug");
  const range = resolveRange(c.req.query());
  if (!SLUG.test(slug) || !range) return invalid(c);
  const seen = await c.env.DB.prepare(
    "SELECT 1 AS x FROM path_enrolments WHERE path_slug = ? LIMIT 1",
  )
    .bind(slug)
    .first();
  if (!seen) return notFound(c, "That path");
  return c.json({ range: rangeOut(range), ...(await pathDetail(c.env.DB, range, slug)) });
});

for (const tab of METRIC_TABS) {
  adminMetrics.get(`/${tab}`, requireAdmin("metrics", "view"), async (c) => {
    const range = resolveRange(c.req.query());
    if (!range) return invalid(c);
    return c.json({ tab, range: rangeOut(range), ...(await compute(c, tab, range)) });
  });
}
