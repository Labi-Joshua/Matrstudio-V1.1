import { Hono } from "hono";
import { type C, invalid } from "../admin/common";
import { bucketStarts, iso, resolveRange } from "../admin/range";
import {
  activeLearners,
  activeSeries,
  newLearners,
  openRequests,
  optionalCount,
  overdueRequests,
  pathCompletions,
  signupSeries,
  submissionsWaiting,
  submissionsWaitingOver,
  supportAgg,
  ticketSeries,
} from "../admin/stats";
import { type AdminCtx, requireAdmin } from "../auth/admin-guard";
import { canAdmin, SUPER_ADMIN_ROLE } from "../auth/admin-perms";

// GET /api/admin/dashboard?range=today|7d|30d|90d|custom&from&to  (dashboard:view)
// The payload is shaped by what the admin may open, not by the role name: a section is left out
// (not emptied) when the admin lacks the area behind it.
export const adminDashboard = new Hono<AdminCtx>();

const DAY = 86400;
const ACTIVITY_LABEL: Record<string, string> = {
  "admin.role.created": "Created a role",
  "admin.role.assigned": "Changed a team member’s role",
  "admin.suspended": "Suspended a team member",
  "admin.removed": "Removed a team member",
  "admin.invite.created": "Invited a team member",
  "admin.user.reset_link": "Sent a password reset link",
  "admin.user.suspended": "Suspended a learner",
  "admin.user.restored": "Restored a learner",
  "admin.user.exported": "Exported a learner’s data",
  "admin.user.deleted": "Deleted a learner’s account",
  "admin.waitlist.invited": "Invited people from the waitlist",
  "admin.waitlist.reminded": "Reminded waitlist invitees",
  "admin.support.note": "Added an internal note",
  "admin.support.issue_logged": "Logged an issue for the team",
  "support.replied": "Replied to a help request",
  "support.status_changed": "Closed a help request",
  "submission.reviewed": "Reviewed a submission",
};
const ACTIVITY_ACTIONS = Object.keys(ACTIVITY_LABEL);

type Variant = "admin" | "curator" | "support";
function variantOf(c: C): Variant {
  if (c.get("admin").roleId === SUPER_ADMIN_ROLE) return "admin";
  const p = c.get("permissions");
  const content = canAdmin(p, "resources", "view") || canAdmin(p, "review_queues", "view");
  const support = canAdmin(p, "support_inbox", "view");
  if (support && !content) return "support";
  if (content && !support) return "curator";
  return "admin";
}

type Stat = { key: string; label: string; value: number | null; previous: number | null };
const stat = (
  key: string,
  label: string,
  value: number | null,
  previous: number | null = null,
): Stat => ({
  key,
  label,
  value,
  previous,
});

adminDashboard.get("/", requireAdmin("dashboard", "view"), async (c) => {
  const q = c.req.query();
  const range = resolveRange(q);
  if (!range) return invalid(c);
  const db = c.env.DB;
  const perms = c.get("permissions");
  const variant = variantOf(c);
  const { current, previous, bucket } = range;
  const now = Math.floor(Date.now() / 1000);
  const mayReview = canAdmin(perms, "review_queues", "view");
  const maySupport = canAdmin(perms, "support_inbox", "view");
  const mayUsers = canAdmin(perms, "users_waitlist", "view");

  // Attention: things that are late, link to where they are handled.
  const attention: Array<{ key: string; count: number; href: string }> = [];
  const [subsLate, requestsLate] = await Promise.all([
    mayReview ? submissionsWaitingOver(db, now - 5 * DAY) : 0,
    maySupport ? overdueRequests(db, now) : 0,
  ]);
  if (subsLate)
    attention.push({
      key: "submissions_over_5_days",
      count: subsLate,
      href: "/review/submissions",
    });
  if (requestsLate)
    attention.push({ key: "requests_overdue", count: requestsLate, href: "/support?overdue=1" });

  let stats: Stat[] = [];
  let series: Record<string, unknown> = {};
  if (variant === "admin") {
    const [nl, nlp, wa, wap, pc, pcp, open, curS, prevS, curA, prevA] = await Promise.all([
      newLearners(db, current),
      newLearners(db, previous),
      activeLearners(db, current),
      activeLearners(db, previous),
      pathCompletions(db, current),
      pathCompletions(db, previous),
      openRequests(db),
      signupSeries(db, current, bucket),
      signupSeries(db, previous, bucket),
      activeSeries(db, current, bucket),
      activeSeries(db, previous, bucket),
    ]);
    stats = [
      stat("new_learners", "New learners", nl, nlp),
      stat("weekly_active", "Weekly active", wa, wap),
      stat("path_completions", "Path completions", pc, pcp),
      stat("open_requests", "Open help requests", open),
    ];
    series = {
      title: "Sign-ups and active learners",
      signups: { current: curS, previous: prevS },
      active: { current: curA, previous: prevA },
    };
  } else if (variant === "curator") {
    const [live, paths, waiting, curA, prevA] = await Promise.all([
      optionalCount(db, "SELECT COUNT(*) AS n FROM resources WHERE status = 'live'"),
      optionalCount(db, "SELECT COUNT(*) AS n FROM paths WHERE status = 'live'"),
      submissionsWaiting(db),
      activeSeries(db, current, bucket),
      activeSeries(db, previous, bucket),
    ]);
    stats = [
      stat("live_resources", "Live resources", live),
      stat("paths_live", "Paths live", paths),
      stat("submissions_waiting", "Submissions waiting", waiting),
      stat("broken_links", "Broken links", null),
    ];
    // Resource opens are not recorded; learner activity stands in and says so.
    series = { title: "Learner activity", active: { current: curA, previous: prevA } };
  } else {
    const [cur, prev, open, unconfirmed, opened, openedPrev, resolved, resolvedPrev] =
      await Promise.all([
        supportAgg(db, current),
        supportAgg(db, previous),
        openRequests(db),
        db.prepare("SELECT COUNT(*) AS n FROM user WHERE emailVerified = 0").first<{ n: number }>(),
        ticketSeries(db, current, bucket, "created_at"),
        ticketSeries(db, previous, bucket, "created_at"),
        ticketSeries(db, current, bucket, "closed_at"),
        ticketSeries(db, previous, bucket, "closed_at"),
      ]);
    stats = [
      stat("open_requests", "Open requests", open),
      stat(
        "avg_first_reply_hours",
        "Avg. first reply (hours)",
        cur.avgFirstReplyHours,
        prev.avgFirstReplyHours,
      ),
      stat("resolved", "Resolved", cur.resolved, prev.resolved),
      stat("unconfirmed_accounts", "Unconfirmed accounts", unconfirmed?.n ?? 0),
    ];
    series = {
      title: "Requests opened and resolved",
      opened: { current: opened, previous: openedPrev },
      resolved: { current: resolved, previous: resolvedPrev },
    };
  }

  // Queue: oldest waiting first, 5 of each kind the admin may handle.
  type QueueItem = {
    id: string;
    kind: string;
    title: string;
    meta: string | null;
    createdAt: string;
    href: string;
  };
  const queue: QueueItem[] = [];
  if (mayReview && variant !== "support") {
    const subs = await db
      .prepare(
        "SELECT id, title, url, created_at FROM resource_submissions WHERE status = 'in_review' ORDER BY created_at LIMIT 5",
      )
      .all<{ id: string; title: string | null; url: string; created_at: number }>();
    for (const s of subs.results)
      queue.push({
        id: s.id,
        kind: "submission",
        title: s.title ?? new URL(s.url).hostname,
        meta: null,
        createdAt: iso(s.created_at),
        href: `/review/submissions/detail?id=${s.id}`,
      });
  }
  if (maySupport && variant !== "curator") {
    const t = await db
      .prepare(
        "SELECT id, subject, category, created_at FROM support_tickets WHERE status = 'open' ORDER BY created_at LIMIT 5",
      )
      .all<{ id: string; subject: string; category: string | null; created_at: number }>();
    for (const r of t.results)
      queue.push({
        id: r.id,
        kind: "help_request",
        title: r.subject,
        meta: r.category,
        createdAt: iso(r.created_at),
        href: `/support/detail?id=${r.id}`,
      });
  }
  queue.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Recent activity of the admin team, from the audit log (no personal data in those rows).
  let recentActivity: unknown[] = [];
  if (variant === "admin" && canAdmin(perms, "audit_log", "view")) {
    const rows = await db
      .prepare(
        `SELECT a.id, a.actor, a.action, a.target, a.created_at, u.name
           FROM audit_log a JOIN admin_users u ON u.id = a.actor
          WHERE a.action IN (${ACTIVITY_ACTIONS.map(() => "?").join(",")})
          ORDER BY a.created_at DESC, a.id DESC LIMIT 10`,
      )
      .bind(...ACTIVITY_ACTIONS)
      .all<{
        id: number;
        actor: string;
        action: string;
        target: string | null;
        created_at: number;
        name: string;
      }>();
    recentActivity = rows.results.map((r) => ({
      id: r.id,
      at: iso(r.created_at),
      actor: { id: r.actor, name: r.name },
      action: r.action,
      label: ACTIVITY_LABEL[r.action] ?? r.action,
      target: r.target,
    }));
  }

  // Learners who started a path, did not finish and went quiet for 14 to 60 days (path progress).
  let atRisk: unknown[] = [];
  if (mayUsers && variant !== "curator") {
    const rows = await db
      .prepare(
        `SELECT e.user_id, u.name, e.path_slug, e.last_activity_at,
           (SELECT COUNT(*) FROM path_lessons_done d WHERE d.user_id = e.user_id AND d.path_slug = e.path_slug) AS done
           FROM path_enrolments e JOIN user u ON u.id = e.user_id
          WHERE e.last_activity_at >= ?1 AND e.last_activity_at < ?2
            AND e.completed_at IS NULL AND e.started_at IS NOT NULL
          ORDER BY e.last_activity_at DESC LIMIT 10`,
      )
      .bind(iso(now - 60 * DAY), iso(now - 14 * DAY))
      .all<{
        user_id: string;
        name: string;
        path_slug: string;
        last_activity_at: string;
        done: number;
      }>();
    atRisk = rows.results.map((r) => ({
      userId: r.user_id,
      name: r.name,
      pathSlug: r.path_slug,
      lastActivityAt: r.last_activity_at,
      lessonsDone: r.done,
    }));
  }

  // Support: accounts that may need help (unconfirmed for 3+ days, or asked for a data export lately).
  let accountsNeedHelp: unknown[] = [];
  if (mayUsers && variant === "support") {
    const unconfirmed = await db
      .prepare(
        "SELECT id, name, email, createdAt FROM user WHERE emailVerified = 0 AND createdAt < ?1 ORDER BY createdAt LIMIT 10",
      )
      .bind(iso(now - 3 * DAY))
      .all<{ id: string; name: string; email: string; createdAt: string }>();
    accountsNeedHelp = unconfirmed.results.map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      reason: "unconfirmed",
      since: u.createdAt,
    }));
  }

  const empty = !(await db.prepare("SELECT 1 AS x FROM user LIMIT 1").first());
  return c.json({
    variant,
    range: {
      key: range.key,
      from: iso(current.start),
      to: iso(current.end),
      previousFrom: iso(previous.start),
      previousTo: iso(previous.end),
      buckets: bucketStarts(current, bucket),
    },
    empty,
    attention,
    stats,
    series,
    queue,
    // Learner search happens in the browser against the catalogue, so no misses are logged yet.
    noResultSearches: { available: false, items: [] },
    recentActivity,
    atRisk,
    accountsNeedHelp,
  });
});
