import {
  approveSubmissionSchema,
  assignSchema,
  declineSubmissionSchema,
  dismissReportSchema,
  hideProfileSchema,
  requestChangeSchema,
} from "@matr/types";
import { Hono } from "hono";
import { type AdminCtx, requireAdmin } from "../auth/admin-guard";
import { authError } from "../auth/guard";
import { hit, LIMITS } from "../auth/limits";
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
  iso,
  newId,
  notFound,
  nowSec,
  optionalBody,
} from "../content/common";
import { notifyMany, tellLearner } from "../content/notify";
import {
  ensureTags,
  findByUrl,
  latestChecks,
  RESOURCE_SELECT,
  type ResourceRow,
  reportGroups,
  resolveTopicLevel,
  setTagsStatements,
  usedIn,
} from "../content/resources";
import {
  adminNames,
  autoChecks,
  DECLINE_COPY,
  loadTargets,
  PROFILE_REASON,
  person,
  relativeDays,
  SUB_SELECT,
  type SubJoined,
  toSubmissionRow,
  validAssignee,
} from "../content/review";
import { suggestType } from "../content/safe-fetch";
import { loadTemplate, render } from "../content/templates";
import { createNotification } from "../notifications/create";

// Mounted by routes/admin.ts after requireAccess (lock 1); requireAdmin adds lock 2 and the role check.
export const adminReview = new Hono<AdminCtx>();

const alreadyReviewed = (c: C) =>
  conflict(c, "already_reviewed", "Someone already reviewed this one.");

/** "me", an admin id or null -> the id to store (null clears). undefined = invalid. */
async function resolveAssignee(c: C, v: string | null): Promise<string | null | undefined> {
  if (v === null) return null;
  const id = v === "me" ? c.get("admin").id : v;
  return (await validAssignee(c.env.DB, id)) ? id : undefined;
}

async function templated(db: D1Database, key: string, values: Record<string, string>) {
  const t = await loadTemplate(db, key);
  return t
    ? { subject: render(t.subject, values), message: render(t.body, values) }
    : { subject: "Matr Studio", message: "" };
}

const OPEN_LIKE = { open: ["open"], handled: ["dismissed", "fixed"] } as const;

/** The three queue sizes the screens show next to the tabs. */
async function queueCounts(db: D1Database) {
  const [subs, profiles, groups] = await Promise.all([
    db
      .prepare("SELECT COUNT(*) AS n FROM resource_submissions WHERE status = 'in_review'")
      .first<{ n: number }>(),
    db
      .prepare(
        "SELECT COUNT(DISTINCT profile_user_id) AS n FROM profile_reports WHERE status = 'open'",
      )
      .first<{ n: number }>(),
    reportGroups(db),
  ]);
  return { submissions: subs?.n ?? 0, linkReports: groups.size, profileReports: profiles?.n ?? 0 };
}

const olderThan = (raw: string | undefined) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? nowSec() - n * 86400 : null;
};

async function nextInReview(db: D1Database) {
  const r = await db
    .prepare(
      "SELECT id FROM resource_submissions WHERE status = 'in_review' ORDER BY created_at, id LIMIT 1",
    )
    .first<{ id: string }>();
  return r?.id ?? null;
}

const decided = async (db: D1Database, extra: Record<string, unknown>) => {
  const nextId = await nextInReview(db);
  return { ...extra, nextId, next: nextId };
};

// ---------------------------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------------------------
adminReview.get("/submissions", requireAdmin("review_queues", "view"), async (c) => {
  const db = c.env.DB;
  const q = c.req.query();
  const where: string[] = [];
  const binds: unknown[] = [];
  const status = q.status ?? "in_review";
  if (["in_review", "accepted", "declined", "needs_changes"].includes(status)) {
    where.push("s.status = ?");
    binds.push(status);
  } else if (status !== "all") return invalid(c);
  if (q.topic) {
    where.push(
      "(s.topic IN (SELECT slug FROM taxonomy WHERE kind = 'topic' AND (slug = lower(?) OR lower(name) = lower(?))) OR s.topic = lower(?))",
    );
    const t = q.topic.slice(0, 60);
    binds.push(t, t, t);
  }
  if (q.assignee === "none") where.push("s.assigned_to IS NULL");
  else if (q.assignee) {
    where.push("s.assigned_to = ?");
    binds.push(q.assignee === "me" ? c.get("admin").id : q.assignee.slice(0, 64));
  }
  const cutoff = olderThan(q.olderThanDays);
  if (cutoff !== null) {
    where.push("s.created_at < ?");
    binds.push(cutoff);
  }
  const cursor = decodeCursor(q.cursor);
  if (q.cursor && !cursor) return invalid(c);
  if (cursor) {
    where.push("(s.created_at > ? OR (s.created_at = ? AND s.id > ?))");
    binds.push(cursor.at, cursor.at, cursor.id);
  }
  const limit = clampLimit(q.limit);
  const rows = await db
    .prepare(
      `${SUB_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY s.created_at ASC, s.id ASC LIMIT ?`,
    )
    .bind(...binds, limit + 1)
    .all<SubJoined>();
  const page = rows.results.slice(0, limit);
  const [names, counts, targets] = await Promise.all([
    adminNames(
      db,
      page.map((r) => r.assigned_to),
    ),
    queueCounts(db),
    loadTargets(db),
  ]);
  const last = page[page.length - 1];
  return c.json({
    items: page.map((r) => ({
      ...toSubmissionRow(r, names),
      overdue: r.status === "in_review" && nowSec() - r.created_at > targets.submissionDays * 86400,
    })),
    nextCursor: rows.results.length > limit && last ? encodeCursor(last.created_at, last.id) : null,
    counts,
    targetDays: targets.submissionDays,
  });
});

adminReview.get("/submissions/:id", requireAdmin("review_queues", "view"), async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const r = id
    ? await db.prepare(`${SUB_SELECT} WHERE s.id = ?`).bind(id).first<SubJoined>()
    : null;
  if (!r) return notFound(c, "That submission");
  const duplicate = r.dup_id ? { id: r.dup_id, title: r.dup_title ?? "" } : null;
  // The page fetch is capped per admin; when capped the checks just stay "unknown" (shown as warn).
  const fetchOk =
    r.status === "in_review" &&
    (await hit(db, `admin-preview:${c.get("admin").id}`, LIMITS.adminPreview)).allowed;
  const { checks, meta } = await autoChecks(r.url, duplicate, fetchOk);
  const stats = await db
    .prepare(
      `SELECT COUNT(CASE WHEN status = 'declined' AND COALESCE(decline_reason, '') <> 'duplicate' THEN 1 END) AS declined
         FROM resource_submissions WHERE user_id = ?`,
    )
    .bind(r.user_id)
    .first<{ declined: number }>();
  const names = await adminNames(db, [r.assigned_to]);
  const dupFull = r.dup_id
    ? await db
        .prepare(
          `SELECT id, title, url, status,
                  (SELECT COUNT(DISTINCT path_id) FROM path_lessons WHERE resource_id = resources.id) AS used
             FROM resources WHERE id = ?`,
        )
        .bind(r.dup_id)
        .first<{ id: string; title: string; url: string; status: string; used: number }>()
    : null;
  const host = hostOf(r.url);
  const since = r.user_since ? new Date(r.user_since) : null;
  return c.json({
    id: r.id,
    title: r.title ?? meta.title ?? host,
    url: r.url,
    source: meta.siteName ?? host,
    type: suggestType(host),
    minutes: meta.durationMin,
    topic: r.topic,
    level: null,
    creator: null,
    note: r.note ?? "",
    ageDays: Math.floor((nowSec() - r.created_at) / 86400),
    submittedAt: iso(r.created_at),
    status: r.status,
    declineReason: r.decline_reason,
    curatorNote: r.curator_note,
    submitter: {
      id: r.user_id,
      name: r.user_name ?? "Former member",
      since:
        since && !Number.isNaN(since.getTime())
          ? since.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
          : null,
      submitted: r.sub_total,
      approved: r.sub_ok,
      declined: stats?.declined ?? 0,
    },
    // "unknown" is shown as a warning: the curator checks it by hand.
    autoChecks: checks.map((x) => ({
      key: x.key,
      label:
        x.key === "not_in_library" && x.detail
          ? x.detail
          : x.status !== "pass" && x.detail
            ? `${x.name}: ${x.detail}`
            : x.name,
      status: x.status === "unknown" ? ("warn" as const) : x.status,
    })),
    duplicateOf: dupFull
      ? {
          id: dupFull.id,
          title: dupFull.title,
          url: dupFull.url,
          status: dupFull.status === "live" ? "Live" : dupFull.status,
          usedInPaths: dupFull.used,
        }
      : null,
    assignedTo: person(r.assigned_to, names),
    // Pre-fill for the "Approve and publish" form; the curator confirms or edits every field.
    suggested: { durationMin: meta.durationMin, thumbnail: null },
  });
});

adminReview.post("/submissions/:id/approve", requireAdmin("review_queues", "manage"), async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const parsed = await body(c, approveSubmissionSchema);
  if (!parsed) return invalid(c);
  const { record: b, credit } = parsed;
  const sub = id
    ? await db.prepare(`${SUB_SELECT} WHERE s.id = ?`).bind(id).first<SubJoined>()
    : null;
  if (!id || !sub) return notFound(c, "That submission");
  if (sub.status !== "in_review") return alreadyReviewed(c);
  const tl = await resolveTopicLevel(db, b.topic, b.level);
  if (!tl.ok)
    return c.json(
      authError("unknown_taxonomy", "Pick a topic and level from the list.", {
        fieldErrors: tl.fieldErrors,
      }),
      400,
    );
  const dup = await findByUrl(db, sub.url_normalised);
  if (dup)
    return conflict(c, "duplicate", `Already in the library as “${dup.title}”.`, {
      existing: { id: dup.id, title: dup.title },
    });
  const now = nowSec();
  const admin = c.get("admin").id;
  // The atomic gate: only one reviewer moves it out of in_review.
  const claim = await db
    .prepare(
      `UPDATE resource_submissions SET status = 'accepted', curator_note = NULL, reviewed_by = ?2,
         reviewed_at = ?3, updated_at = ?3 WHERE id = ?1 AND status = 'in_review'`,
    )
    .bind(id, admin, now)
    .run();
  if (!claim.meta.changes) return alreadyReviewed(c);
  const rid = newId();
  const tags = await ensureTags(db, b.tags);
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO resources (id, url, url_normalised, title, source, type, creator, topic, level, license, rights,
             duration_min, intro, learning_goal, status, added_by, submitted_by, submission_id, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 'live', ?15, ?16, ?17, ?18, ?18)`,
        )
        .bind(
          rid,
          sub.url,
          sub.url_normalised,
          b.title,
          hostOf(sub.url),
          b.type,
          b.creator,
          tl.topic,
          tl.level,
          b.license,
          b.rights,
          b.durationMin ?? null,
          b.intro,
          b.learningGoal,
          admin,
          credit ? sub.user_id : null,
          id,
          now,
        ),
      ...setTagsStatements(db, rid, tags),
    ]);
  } catch {
    // Put it back so it can be reviewed again.
    await db
      .prepare(
        "UPDATE resource_submissions SET status = 'in_review', reviewed_by = NULL, reviewed_at = NULL WHERE id = ?",
      )
      .bind(id)
      .run();
    return conflict(c, "duplicate", "Already in the library.");
  }
  const copy = await templated(db, "submission-approved", {
    name: (sub.user_name ?? "").split(" ")[0] || "there",
    title: b.title,
  });
  await tellLearner(
    c.env,
    sub.user_id,
    {
      kind: "support-reply",
      title: "Your resource was approved",
      body: credit
        ? `“${b.title}” is in the library, credited to you.`
        : `“${b.title}” is in the library.`,
      href: "/learn/submit",
    },
    copy,
  );
  await audit(c, {
    action: "review.submission.approved",
    target: id,
    meta: { resource: rid, credited: credit, placement: b.placement },
  });
  return c.json(await decided(db, { submission: { id, status: "accepted" }, resourceId: rid }));
});

adminReview.post(
  "/submissions/:id/request-change",
  requireAdmin("review_queues", "manage"),
  async (c) => {
    const id = idParam(c);
    const db = c.env.DB;
    const b = await body(c, requestChangeSchema);
    if (!b) return invalid(c, { fieldErrors: { message: "Say what needs to change." } });
    const sub = id
      ? await db.prepare(`${SUB_SELECT} WHERE s.id = ?`).bind(id).first<SubJoined>()
      : null;
    if (!id || !sub) return notFound(c, "That submission");
    const now = nowSec();
    const claim = await db
      .prepare(
        `UPDATE resource_submissions SET status = 'needs_changes', curator_note = ?2, reviewed_by = ?3,
           reviewed_at = ?4, updated_at = ?4 WHERE id = ?1 AND status = 'in_review'`,
      )
      .bind(id, b.message, c.get("admin").id, now)
      .run();
    if (!claim.meta.changes) return alreadyReviewed(c);
    await tellLearner(
      c.env,
      sub.user_id,
      {
        kind: "support-reply",
        title: "A change was requested on your resource",
        body: b.message,
        href: "/learn/submit",
      },
      { subject: "A change was requested on your resource suggestion", message: b.message },
    );
    await audit(c, { action: "review.submission.change_requested", target: id });
    return c.json(await decided(db, { submission: { id, status: "needs_changes" } }));
  },
);

adminReview.post("/submissions/:id/decline", requireAdmin("review_queues", "manage"), async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const b = await body(c, declineSubmissionSchema);
  if (!b) return invalid(c, { fieldErrors: { reason: "Pick a reason." } });
  const sub = id
    ? await db.prepare(`${SUB_SELECT} WHERE s.id = ?`).bind(id).first<SubJoined>()
    : null;
  if (!id || !sub) return notFound(c, "That submission");
  if (b.duplicateOf) {
    const exists = await db
      .prepare("SELECT 1 AS x FROM resources WHERE id = ?")
      .bind(b.duplicateOf)
      .first();
    if (!exists) return invalid(c, { fieldErrors: { duplicateOf: "Unknown resource." } });
  }
  const now = nowSec();
  const reasonText = DECLINE_COPY[b.reason] as string;
  const note = b.note ? `${b.note}` : null;
  const claim = await db
    .prepare(
      `UPDATE resource_submissions SET status = 'declined', decline_reason = ?2, duplicate_of = ?3,
         curator_note = ?4, reviewed_by = ?5, reviewed_at = ?6, updated_at = ?6 WHERE id = ?1 AND status = 'in_review'`,
    )
    .bind(id, b.reason, b.duplicateOf ?? null, note ?? reasonText, c.get("admin").id, now)
    .run();
  if (!claim.meta.changes) return alreadyReviewed(c);
  const copy = await templated(db, "submission-declined", {
    name: (sub.user_name ?? "").split(" ")[0] || "there",
    title: sub.title ?? hostOf(sub.url),
    reason: note ? `${reasonText} ${note}` : reasonText,
  });
  await tellLearner(
    c.env,
    sub.user_id,
    {
      kind: "support-reply",
      title: "Your resource wasn’t added",
      body: note ?? `We didn’t add it: ${reasonText}`,
      href: "/learn/submit",
    },
    copy,
  );
  await audit(c, { action: "review.submission.declined", target: id, meta: { reason: b.reason } });
  return c.json(await decided(db, { submission: { id, status: "declined" } }));
});

adminReview.patch("/submissions/:id/assign", requireAdmin("review_queues", "manage"), async (c) => {
  const id = idParam(c);
  const b = await body(c, assignSchema);
  if (!id || !b) return invalid(c);
  const assignee = await resolveAssignee(c, b.assignee);
  if (assignee === undefined)
    return invalid(c, { fieldErrors: { assignee: "Pick an active reviewer." } });
  const sub = await c.env.DB.prepare("SELECT status FROM resource_submissions WHERE id = ?")
    .bind(id)
    .first<{ status: string }>();
  if (!sub) return notFound(c, "That submission");
  if (sub.status !== "in_review") return alreadyReviewed(c);
  await c.env.DB.prepare(
    "UPDATE resource_submissions SET assigned_to = ? WHERE id = ? AND status = 'in_review'",
  )
    .bind(assignee, id)
    .run();
  await audit(c, {
    action: "review.submission.assigned",
    target: id,
    meta: { cleared: assignee === null },
  });
  return c.json({ assignedTo: person(assignee, await adminNames(c.env.DB, [assignee])) });
});

// ---------------------------------------------------------------------------------------------
// Link reports: derived from "Report a problem" tickets (kind report, category "Broken link")
// ---------------------------------------------------------------------------------------------
adminReview.get("/link-reports", requireAdmin("review_queues", "view"), async (c) => {
  const db = c.env.DB;
  const q = c.req.query();
  const status =
    q.status === "handled" || q.status === "dismissed" || q.status === "fixed"
      ? "handled"
      : (q.status ?? "open");
  if (status !== "open" && status !== "handled") return invalid(c);
  type Item = { id: string; first: number; count: number; reports: string[] };
  let items: Item[];
  if (status === "open") {
    const groups = await reportGroups(db);
    items = [...groups.entries()].map(([rid, list]) => ({
      id: rid,
      first: Math.min(...list.map((r) => r.at)),
      count: list.length,
      reports: list.map((r) => r.text),
    }));
  } else {
    const rows = await db
      .prepare(
        "SELECT resource_id, handled_at FROM link_report_state WHERE status IN ('dismissed', 'fixed') ORDER BY handled_at DESC LIMIT 100",
      )
      .all<{ resource_id: string; handled_at: number }>();
    items = rows.results.map((r) => ({
      id: r.resource_id,
      first: r.handled_at,
      count: 0,
      reports: [],
    }));
  }
  items.sort((a, b) => a.first - b.first || (a.id < b.id ? -1 : 1));
  const cutoff = olderThan(q.olderThanDays);
  if (cutoff !== null) items = items.filter((i) => i.first < cutoff);
  const cursor = decodeCursor(q.cursor);
  if (q.cursor && !cursor) return invalid(c);
  if (cursor)
    items = items.filter((i) => i.first > cursor.at || (i.first === cursor.at && i.id > cursor.id));
  const assignedOf = new Map<string, string | null>();
  for (const i of items) {
    const s = await db
      .prepare("SELECT assigned_to FROM link_report_state WHERE resource_id = ?")
      .bind(i.id)
      .first<{ assigned_to: string | null }>();
    assignedOf.set(i.id, s?.assigned_to ?? null);
  }
  const want = q.assignee === "me" ? c.get("admin").id : q.assignee;
  if (want === "none") items = items.filter((i) => !assignedOf.get(i.id));
  else if (want) items = items.filter((i) => assignedOf.get(i.id) === want);
  const limit = clampLimit(q.limit);
  const page = items.slice(0, limit);
  const ids = page.map((i) => i.id);
  const [checks, names, counts] = await Promise.all([
    latestChecks(db, ids),
    adminNames(
      db,
      ids.map((i) => assignedOf.get(i) ?? null),
    ),
    queueCounts(db),
  ]);
  const out = [];
  for (const i of page) {
    const r = await db.prepare(`${RESOURCE_SELECT} WHERE r.id = ?`).bind(i.id).first<ResourceRow>();
    if (!r) continue;
    const used = await usedIn(db, i.id);
    const check = checks.get(i.id);
    out.push({
      id: i.id,
      title: r.title,
      source: r.source,
      usedInPaths: new Set(used.map((u) => u.pathId)).size,
      reportCount: i.count,
      reason:
        check && check.ok === 0 && check.reason
          ? check.reason
          : (i.reports[0] ?? "Reported by learners"),
      linkStatus: check && check.ok === 0 ? ("failed" as const) : ("ok" as const),
      ageDays: Math.floor((nowSec() - i.first) / 86400),
      assignedTo: person(assignedOf.get(i.id) ?? null, names),
    });
  }
  const last = page[page.length - 1];
  return c.json({
    items: out,
    nextCursor: items.length > limit && last ? encodeCursor(last.first, last.id) : null,
    counts,
  });
});

adminReview.get("/link-reports/:id", requireAdmin("review_queues", "view"), async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const r = id
    ? await db.prepare(`${RESOURCE_SELECT} WHERE r.id = ?`).bind(id).first<ResourceRow>()
    : null;
  if (!id || !r) return notFound(c, "That link report");
  const reports = ((await reportGroups(db, id)).get(id) ?? []).sort((a, b) => a.at - b.at);
  const state = await db
    .prepare("SELECT status, assigned_to, handled_at FROM link_report_state WHERE resource_id = ?")
    .bind(id)
    .first<{ status: string; assigned_to: string | null; handled_at: number | null }>();
  if (!reports.length && !state) return notFound(c, "That link report");
  const users = new Map<string, string>();
  for (const u of new Set(reports.map((x) => x.userId))) {
    const row = await db
      .prepare("SELECT name FROM user WHERE id = ?")
      .bind(u)
      .first<{ name: string }>();
    users.set(u, row?.name ?? "Former member");
  }
  const checks = await db
    .prepare(
      "SELECT checked_at, ok, http_status, reason FROM link_checks WHERE resource_id = ? ORDER BY checked_at DESC, rowid DESC LIMIT 5",
    )
    .bind(id)
    .all<{ checked_at: number; ok: number; http_status: number | null; reason: string | null }>();
  const now = await db
    .prepare(
      `SELECT COUNT(DISTINCT e.user_id) AS n FROM path_enrolments e
         JOIN paths p ON p.slug = e.path_slug JOIN path_lessons l ON l.path_id = p.id
        WHERE l.resource_id = ? AND p.status = 'live' AND e.started_at IS NOT NULL AND e.completed_at IS NULL`,
    )
    .bind(id)
    .first<{ n: number }>();
  const names = await adminNames(db, [state?.assigned_to ?? null]);
  const used = await usedIn(db, id);
  const last = checks.results[0];
  const first = reports[0];
  return c.json({
    id,
    resourceId: id,
    title: r.title,
    url: r.url,
    type: r.type,
    reportCount: reports.length,
    firstReportDays: first ? Math.floor((nowSec() - first.at) / 86400) : 0,
    linkStatus: last && last.ok === 0 ? "failed" : "ok",
    reports: reports.map((x) => ({
      name: users.get(x.userId) ?? "Former member",
      when: relativeDays(x.at),
      text: x.text,
    })),
    linkCheck: last
      ? {
          ok: last.ok === 1,
          reason: last.reason ?? (last.ok === 1 ? "The link opens." : "The link failed."),
          checkedText: `Checked ${relativeDays(last.checked_at)} at ${new Date(last.checked_at * 1000).toISOString().slice(11, 16)} UTC`,
        }
      : { ok: true, reason: "Not checked yet.", checkedText: "No link check has run yet" },
    usedIn: used.map((u) => `${u.pathTitle} · lesson ${u.lessonNumber}`),
    // Learners on a live path that uses it (not narrowed to the exact lesson).
    learnersNow: now?.n ?? 0,
    assignedTo: person(state?.assigned_to ?? null, names),
    resolved: reports.length === 0,
    status: reports.length ? "open" : (state?.status ?? "open"),
  });
});

adminReview.patch(
  "/link-reports/:id/assign",
  requireAdmin("review_queues", "manage"),
  async (c) => {
    const id = idParam(c);
    const b = await body(c, assignSchema);
    if (!id || !b) return invalid(c);
    const db = c.env.DB;
    const assignee = await resolveAssignee(c, b.assignee);
    if (assignee === undefined)
      return invalid(c, { fieldErrors: { assignee: "Pick an active reviewer." } });
    if (!(await db.prepare("SELECT 1 AS x FROM resources WHERE id = ?").bind(id).first()))
      return notFound(c, "That link report");
    await db
      .prepare(
        `INSERT INTO link_report_state (resource_id, assigned_to, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (resource_id) DO UPDATE SET assigned_to = ?2, updated_at = ?3`,
      )
      .bind(id, assignee, nowSec())
      .run();
    await audit(c, {
      action: "review.link_report.assigned",
      target: id,
      meta: { cleared: assignee === null },
    });
    return c.json({ assignedTo: person(assignee, await adminNames(db, [assignee])) });
  },
);

adminReview.post(
  "/link-reports/:id/dismiss",
  requireAdmin("review_queues", "manage"),
  async (c) => {
    const id = idParam(c);
    const db = c.env.DB;
    const b = await optionalBody(c, dismissReportSchema);
    if (!b) return invalid(c);
    const r = id
      ? await db
          .prepare("SELECT title FROM resources WHERE id = ?")
          .bind(id)
          .first<{ title: string }>()
      : null;
    if (!id || !r) return notFound(c, "That link report");
    const reports = (await reportGroups(db, id)).get(id) ?? [];
    if (!reports.length) return alreadyReviewed(c);
    const now = nowSec();
    await db
      .prepare(
        `INSERT INTO link_report_state (resource_id, status, handled_by, handled_at, updated_at)
       VALUES (?1, 'dismissed', ?2, ?3, ?3)
       ON CONFLICT (resource_id) DO UPDATE SET status = 'dismissed', handled_by = ?2, handled_at = ?3, updated_at = ?3`,
      )
      .bind(id, c.get("admin").id, now)
      .run();
    const seen = new Set<string>();
    for (const x of reports.slice(0, 200)) {
      await db
        .prepare(
          "UPDATE support_tickets SET status = 'cant_reproduce', updated_at = ?2 WHERE id = ?1 AND status NOT IN ('resolved', 'fixed', 'cant_reproduce')",
        )
        .bind(x.ticketId, now)
        .run();
      if (seen.has(x.userId)) continue;
      seen.add(x.userId);
      await createNotification(db, {
        userId: x.userId,
        kind: "report-cant-reproduce",
        title: "We checked the link you reported",
        body: b.note || `${r.title} opens for us. If it still fails, send a new report.`,
        href: `/learn/help?ticket=${x.ticketId}`,
      });
    }
    await audit(c, {
      action: "review.link_report.dismissed",
      target: id,
      meta: { reports: reports.length },
    });
    return c.json({ id, status: "dismissed", notified: seen.size });
  },
);

// ---------------------------------------------------------------------------------------------
// Profile reports
// ---------------------------------------------------------------------------------------------
adminReview.get("/profile-reports", requireAdmin("review_queues", "view"), async (c) => {
  const db = c.env.DB;
  const q = c.req.query();
  const status = q.status ?? "open";
  if (!(status in OPEN_LIKE)) return invalid(c);
  const states = OPEN_LIKE[status as keyof typeof OPEN_LIKE];
  const where = [`r.status IN (${states.map(() => "?").join(",")})`];
  const binds: unknown[] = [...states];
  if (q.assignee === "none") where.push("r.assigned_to IS NULL");
  else if (q.assignee) {
    where.push("r.assigned_to = ?");
    binds.push(q.assignee === "me" ? c.get("admin").id : q.assignee.slice(0, 64));
  }
  const having: string[] = [];
  const havingBinds: unknown[] = [];
  const cutoff = olderThan(q.olderThanDays);
  if (cutoff !== null) {
    having.push("MIN(r.created_at) < ?");
    havingBinds.push(cutoff);
  }
  const cursor = decodeCursor(q.cursor);
  if (q.cursor && !cursor) return invalid(c);
  if (cursor) {
    having.push("(MIN(r.created_at) > ? OR (MIN(r.created_at) = ? AND r.profile_user_id > ?))");
    havingBinds.push(cursor.at, cursor.at, cursor.id);
  }
  const limit = clampLimit(q.limit);
  const rows = await db
    .prepare(
      `SELECT r.profile_user_id AS id, COUNT(*) AS n, MIN(r.created_at) AS first,
              MAX(r.assigned_to) AS assigned_to, p.username, p.display_name,
              (SELECT x.reason FROM profile_reports x WHERE x.profile_user_id = r.profile_user_id
                ORDER BY x.created_at DESC LIMIT 1) AS reason
         FROM profile_reports r LEFT JOIN profiles p ON p.user_id = r.profile_user_id
        WHERE ${where.join(" AND ")} GROUP BY r.profile_user_id
        ${having.length ? `HAVING ${having.join(" AND ")}` : ""}
        ORDER BY first ASC, id ASC LIMIT ?`,
    )
    .bind(...binds, ...havingBinds, limit + 1)
    .all<{
      id: string;
      n: number;
      first: number;
      assigned_to: string | null;
      username: string | null;
      display_name: string | null;
      reason: string;
    }>();
  const page = rows.results.slice(0, limit);
  const [names, counts] = await Promise.all([
    adminNames(
      db,
      page.map((r) => r.assigned_to),
    ),
    queueCounts(db),
  ]);
  const last = page[page.length - 1];
  return c.json({
    items: page.map((r) => ({
      id: r.id,
      name: r.display_name || r.username || "Unknown",
      handle: r.username ? `@${r.username}` : "",
      // Photos are served on the learner API origin, which the admin CSP does not allow.
      avatarUrl: null,
      reason: PROFILE_REASON[r.reason] ?? r.reason,
      reportCount: r.n,
      ageDays: Math.floor((nowSec() - r.first) / 86400),
      assignedTo: person(r.assigned_to, names),
    })),
    nextCursor: rows.results.length > limit && last ? encodeCursor(last.first, last.id) : null,
    counts,
  });
});

adminReview.get("/profile-reports/:id", requireAdmin("review_queues", "view"), async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const p = id
    ? await db
        .prepare(
          `SELECT p.user_id, p.username, p.display_name, p.bio, p.hidden_at, u.createdAt AS joined
             FROM profiles p JOIN user u ON u.id = p.user_id WHERE p.user_id = ?`,
        )
        .bind(id)
        .first<{
          user_id: string;
          username: string;
          display_name: string;
          bio: string;
          hidden_at: number | null;
          joined: string;
        }>()
    : null;
  if (!id || !p) return notFound(c, "That profile report");
  const reports = await db
    .prepare(
      "SELECT id, reason, note, status, assigned_to, created_at FROM profile_reports WHERE profile_user_id = ? ORDER BY created_at DESC LIMIT 50",
    )
    .bind(id)
    .all<{
      id: string;
      reason: string;
      note: string | null;
      status: string;
      assigned_to: string | null;
      created_at: number;
    }>();
  if (!reports.results.length) return notFound(c, "That profile report");
  const facts = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM path_enrolments WHERE user_id = ?1 AND started_at IS NOT NULL) AS paths,
              (SELECT COUNT(*) FROM resource_submissions WHERE user_id = ?1) AS submissions,
              (SELECT COUNT(*) FROM profile_reports WHERE profile_user_id = ?1 AND status <> 'open') AS past`,
    )
    .bind(id)
    .first<{ paths: number; submissions: number; past: number }>();
  const open = reports.results.filter((r) => r.status === "open");
  const shown = open.length ? open : reports.results;
  const assigned = open.find((r) => r.assigned_to)?.assigned_to ?? null;
  const names = await adminNames(db, [assigned]);
  const first = Math.min(...shown.map((r) => r.created_at));
  const joined = new Date(p.joined);
  return c.json({
    id,
    name: p.display_name || p.username,
    handle: `@${p.username}`,
    avatarUrl: null,
    profileUrl: `${c.env.PUBLIC_WEB_URL}/u?name=${p.username}`,
    reason: PROFILE_REASON[shown[0]?.reason ?? ""] ?? "Reported",
    reportCount: shown.length,
    ageDays: Math.floor((nowSec() - first) / 86400),
    bio: p.bio,
    links: [],
    // Reporters stay anonymous to protect them; only the reasons and notes are shown.
    reports: shown.map((r) => ({
      name: "A learner",
      when: relativeDays(r.created_at),
      text: [PROFILE_REASON[r.reason] ?? r.reason, r.note].filter(Boolean).join(": "),
    })),
    facts: {
      joined: Number.isNaN(joined.getTime())
        ? "Unknown"
        : joined.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
      pathsStarted: facts?.paths ?? 0,
      submissions: facts?.submissions ?? 0,
      pastReports: facts?.past ?? 0,
    },
    assignedTo: person(assigned, names),
    resolved: open.length === 0,
    hidden: p.hidden_at !== null,
  });
});

adminReview.patch(
  "/profile-reports/:id/assign",
  requireAdmin("review_queues", "manage"),
  async (c) => {
    const id = idParam(c);
    const b = await body(c, assignSchema);
    if (!id || !b) return invalid(c);
    const assignee = await resolveAssignee(c, b.assignee);
    if (assignee === undefined)
      return invalid(c, { fieldErrors: { assignee: "Pick an active reviewer." } });
    const res = await c.env.DB.prepare(
      "UPDATE profile_reports SET assigned_to = ? WHERE profile_user_id = ? AND status = 'open'",
    )
      .bind(assignee, id)
      .run();
    if (!res.meta.changes) return alreadyReviewed(c);
    await audit(c, {
      action: "review.profile_report.assigned",
      target: id,
      meta: { cleared: assignee === null },
    });
    return c.json({ assignedTo: person(assignee, await adminNames(c.env.DB, [assignee])) });
  },
);

adminReview.post(
  "/profile-reports/:id/hide-profile",
  requireAdmin("review_queues", "manage"),
  async (c) => {
    const id = idParam(c);
    const db = c.env.DB;
    const b = await body(c, hideProfileSchema);
    if (!b) return invalid(c, { fieldErrors: { message: "Add a message for the owner." } });
    if (!id) return notFound(c, "That profile report");
    const now = nowSec();
    const reporters = await db
      .prepare(
        "SELECT reporter_id FROM profile_reports WHERE profile_user_id = ? AND status = 'open'",
      )
      .bind(id)
      .all<{ reporter_id: string }>();
    const res = await db
      .prepare(
        "UPDATE profile_reports SET status = 'hidden', handled_by = ?2, handled_at = ?3 WHERE profile_user_id = ?1 AND status = 'open'",
      )
      .bind(id, c.get("admin").id, now)
      .run();
    if (!res.meta.changes) {
      const any = await db
        .prepare("SELECT 1 AS x FROM profile_reports WHERE profile_user_id = ?")
        .bind(id)
        .first();
      return any ? alreadyReviewed(c) : notFound(c, "That profile report");
    }
    await db
      .prepare(
        "UPDATE profiles SET hidden_at = ?2, hidden_message = ?3, updated_at = ?2 WHERE user_id = ?1",
      )
      .bind(id, now, b.message)
      .run();
    await tellLearner(
      c.env,
      id,
      {
        kind: "support-reply",
        title: "Your public profile was hidden",
        body: b.message,
        href: "/learn/help",
      },
      { subject: "Your public profile was hidden", message: b.message },
    );
    if (b.notifyReporters)
      await notifyMany(
        db,
        reporters.results.map((r) => r.reporter_id),
        {
          kind: "report-fixed",
          title: "We took action on the profile you reported",
          body: "Thanks for letting us know.",
          href: "/learn/help",
        },
      );
    await audit(c, {
      action: "review.profile_report.hidden",
      target: id,
      meta: { reports: res.meta.changes, notifiedReporters: Boolean(b.notifyReporters) },
    });
    return c.json({ id, status: "hidden" });
  },
);

adminReview.post(
  "/profile-reports/:id/dismiss",
  requireAdmin("review_queues", "manage"),
  async (c) => {
    const id = idParam(c);
    const db = c.env.DB;
    const b = await optionalBody(c, dismissReportSchema);
    if (!b) return invalid(c);
    if (!id) return notFound(c, "That profile report");
    const res = await db
      .prepare(
        "UPDATE profile_reports SET status = 'dismissed', handled_by = ?2, handled_at = ?3 WHERE profile_user_id = ?1 AND status = 'open'",
      )
      .bind(id, c.get("admin").id, nowSec())
      .run();
    if (!res.meta.changes) {
      const any = await db
        .prepare("SELECT 1 AS x FROM profile_reports WHERE profile_user_id = ?")
        .bind(id)
        .first();
      return any ? alreadyReviewed(c) : notFound(c, "That profile report");
    }
    await audit(c, {
      action: "review.profile_report.dismissed",
      target: id,
      meta: { reports: res.meta.changes },
    });
    return c.json({ id, status: "dismissed" });
  },
);
