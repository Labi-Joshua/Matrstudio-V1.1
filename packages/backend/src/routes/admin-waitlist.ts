import {
  WAITLIST_FILTERS,
  type WaitlistStats,
  type WaitlistStatus,
  waitlistInviteSchema,
} from "@matr/types";
import { Hono } from "hono";
import {
  audit,
  type C,
  clampLimit,
  invalid,
  limited,
  notFound,
  parseBody,
  readCursor,
} from "../admin/common";
import { iso, isoOrNull } from "../admin/range";
import { type AdminCtx, requireAdmin } from "../auth/admin-guard";
import { authError } from "../auth/guard";
import { prepareInvite, WAITLIST_INVITE_TTL_SECONDS } from "../auth/invites";
import { LIMITS } from "../auth/limits";
import { enqueueAuthEmail } from "../queue/auth-email";

// Mounted by routes/admin.ts at /waitlist after requireAccess (lock 1); requireAdmin adds lock 2.
// Only subscribers who confirmed their email (status 'verified') are on this list.
export const adminWaitlist = new Hono<AdminCtx>();

const DAY = 86400;
const REMIND_AFTER_DAYS = 7;
const MAX_BATCH = 100;

// waiting -> invited -> created (account, email not confirmed) -> confirmed. Exclusive per person:
// someone who signed up without an invite is created/confirmed with no invitedAt.
const STATUS_SQL = `CASE WHEN u.id IS NOT NULL THEN (CASE WHEN u.emailVerified = 1 THEN 'confirmed' ELSE 'created' END)
  WHEN wi.subscriber_id IS NOT NULL THEN 'invited' ELSE 'waiting' END`;
const FROM = `FROM waitlist_subscribers s
  LEFT JOIN waitlist_invites wi ON wi.subscriber_id = s.id
  LEFT JOIN user u ON u.email = lower(s.email)`;
const WAITING = "s.status = 'verified' AND wi.subscriber_id IS NULL AND u.id IS NULL";

// GET /waitlist?status&cursor&limit  (oldest first, the order invites go out in)
adminWaitlist.get("/", requireAdmin("users_waitlist", "view"), async (c) => {
  const status = c.req.query("status");
  if (status && !(WAITLIST_FILTERS as readonly string[]).includes(status)) return invalid(c);
  const cursor = readCursor(c.req.query("cursor"));
  if (cursor === "bad" || (cursor && !/^\d+$/.test(cursor[0] + cursor[1]))) return invalid(c);
  const limit = clampLimit(c.req.query("limit"));
  const where = ["s.status = 'verified'"];
  const args: unknown[] = [];
  const arg = (v: unknown) => `?${args.push(v)}`;
  if (status === "joined") where.push(`(${STATUS_SQL}) IN ('created', 'confirmed')`);
  else if (status) where.push(`(${STATUS_SQL}) = ${arg(status)}`);
  if (cursor) {
    const a = arg(Number(cursor[0]));
    const b = arg(Number(cursor[1]));
    where.push(`(s.created_at > ${a} OR (s.created_at = ${a} AND s.id > ${b}))`);
  }
  const rows = await c.env.DB.prepare(
    `SELECT s.id, s.email, s.referred_by, s.created_at, wi.batch_id, wi.invited_at, ${STATUS_SQL} AS state
     ${FROM} WHERE ${where.join(" AND ")} ORDER BY s.created_at, s.id LIMIT ${limit + 1}`,
  )
    .bind(...args)
    .all<{
      id: number;
      email: string;
      referred_by: string | null;
      created_at: number;
      batch_id: string | null;
      invited_at: number | null;
      state: WaitlistStatus;
    }>();
  const page = rows.results.slice(0, limit);
  const last = page.at(-1);
  const out = page.map((r) => ({
    id: String(r.id), // a string for the portal; POST /waitlist/invites {ids} takes the number
    source: r.referred_by ? "referral" : null,
    email: r.email,
    joinedAt: iso(r.created_at),
    status: r.state,
    invitedAt: isoOrNull(r.invited_at),
    batchId: r.batch_id,
  }));
  return c.json({
    entries: out,
    nextCursor: rows.results.length > limit && last ? `${last.created_at}:${last.id}` : null,
  });
});

adminWaitlist.get("/stats", requireAdmin("users_waitlist", "view"), async (c) => {
  const db = c.env.DB;
  const [waiting, invited, learners] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS n, MIN(s.created_at) AS oldest ${FROM} WHERE ${WAITING}`)
      .first<{ n: number; oldest: number | null }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS invited, COALESCE(SUM(u.id IS NOT NULL), 0) AS created,
                COALESCE(SUM(u.emailVerified = 1), 0) AS confirmed, MAX(wi.invited_at) AS last_at
           FROM waitlist_invites wi
           JOIN waitlist_subscribers s ON s.id = wi.subscriber_id
           LEFT JOIN user u ON u.email = lower(s.email)`,
      )
      .first<{ invited: number; created: number; confirmed: number; last_at: number | null }>(),
    db.prepare("SELECT COUNT(*) AS n FROM user").first<{ n: number }>(),
  ]);
  const stats: WaitlistStats & { learners: number } = {
    waiting: waiting?.n ?? 0,
    oldestWaitingAt: isoOrNull(waiting?.oldest),
    invited: invited?.invited ?? 0,
    lastBatchAt: isoOrNull(invited?.last_at),
    created: invited?.created ?? 0,
    confirmed: invited?.confirmed ?? 0,
    learners: learners?.n ?? 0,
  };
  return c.json({ ...stats, stats });
});

adminWaitlist.get("/batches", requireAdmin("users_waitlist", "view"), async (c) => {
  const now = Math.floor(Date.now() / 1000);
  const rows = await c.env.DB.prepare(
    `SELECT b.id, b.created_at, b.joined_from, b.joined_to,
       COUNT(wi.subscriber_id) AS invited,
       COALESCE(SUM(u.id IS NOT NULL), 0) AS created,
       COALESCE(SUM(u.emailVerified = 1), 0) AS confirmed,
       COALESCE(SUM(wi.reminded_at IS NOT NULL), 0) AS reminded, MAX(wi.reminded_at) AS reminded_at,
       COALESCE(SUM(wi.reminded_at IS NULL AND u.id IS NULL AND wi.invited_at <= ?1
                    AND i.used_at IS NULL AND i.expires_at > ?2), 0) AS need
     FROM (SELECT * FROM waitlist_batches ORDER BY created_at DESC LIMIT 20) b
     LEFT JOIN waitlist_invites wi ON wi.batch_id = b.id
     LEFT JOIN waitlist_subscribers s ON s.id = wi.subscriber_id
     LEFT JOIN user u ON u.email = lower(s.email)
     LEFT JOIN invites i ON i.id = wi.invite_id
     GROUP BY b.id ORDER BY b.created_at DESC`,
  )
    .bind(now - REMIND_AFTER_DAYS * DAY, now)
    .all<{
      id: string;
      created_at: number;
      joined_from: number | null;
      joined_to: number | null;
      invited: number;
      created: number;
      confirmed: number;
      reminded: number;
      reminded_at: number | null;
      need: number;
    }>();
  const batches = rows.results.map((r) => ({
    id: r.id,
    // names the portal reads
    sentAt: iso(r.created_at),
    created: r.created,
    notJoined: r.need,
    reminderSentAt: isoOrNull(r.reminded_at),
    createdAt: iso(r.created_at),
    invited: r.invited,
    createdAccount: r.created,
    confirmed: r.confirmed,
    needReminder: r.need,
    reminded: r.reminded,
    joinedFrom: isoOrNull(r.joined_from),
    joinedTo: isoOrNull(r.joined_to),
  }));
  return c.json({ batches });
});

type Candidate = { id: number; email: string; created_at: number };

// POST /waitlist/invites {count} or {ids[]}: the oldest waiting people first, at most 100 a time.
adminWaitlist.post("/invites", requireAdmin("users_waitlist", "manage"), async (c) => {
  const body = await parseBody(c, waitlistInviteSchema);
  if (!body) return invalid(c);
  const blocked = await limited(
    c,
    `admin-invites:admin:${c.get("admin").id}`,
    LIMITS.adminInvitesAdmin,
    "admin_waitlist_invites",
  );
  if (blocked) return blocked;
  const db = c.env.DB;
  const ids = body.ids ? [...new Set(body.ids)] : null;
  const picked = await db
    .prepare(
      `SELECT s.id, s.email, s.created_at ${FROM} WHERE ${WAITING}
       ${ids ? `AND s.id IN (${ids.map(() => "?").join(",")})` : ""}
       ORDER BY s.created_at, s.id LIMIT ${Math.min(body.count ?? MAX_BATCH, MAX_BATCH)}`,
    )
    .bind(...(ids ?? []))
    .all<Candidate>();
  const people = picked.results;
  if (!people.length)
    return c.json(authError("nothing_to_send", "No one on the waitlist is waiting."), 409);

  const admin = c.get("admin").id;
  const now = Math.floor(Date.now() / 1000);
  const batchId = crypto.randomUUID();
  const invites = await Promise.all(
    people.map((p) =>
      prepareInvite(c.env, {
        email: p.email,
        createdBy: admin,
        ttlSeconds: WAITLIST_INVITE_TTL_SECONDS,
      }),
    ),
  );
  const first = people[0]?.created_at ?? now;
  const lastJoined = people.at(-1)?.created_at ?? now;
  try {
    await db.batch([
      db
        .prepare(
          "INSERT INTO waitlist_batches (id, created_by, created_at, size, joined_from, joined_to) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(batchId, admin, now, people.length, first, lastJoined),
      ...people.flatMap((p, i) => [
        (invites[i] as (typeof invites)[number]).statement,
        db
          .prepare(
            "INSERT INTO waitlist_invites (subscriber_id, batch_id, invite_id, invited_at) VALUES (?, ?, ?, ?)",
          )
          .bind(p.id, batchId, (invites[i] as (typeof invites)[number]).id, now),
      ]),
    ]);
  } catch {
    // Another admin invited some of these people a moment ago: the whole batch rolled back.
    return c.json(
      authError("conflict", "Someone just invited some of these people. Try again."),
      409,
    );
  }
  for (const inv of invites)
    await enqueueAuthEmail(c.env, { type: "waitlist-invite", to: inv.email, link: inv.link });
  await audit(c, "admin.waitlist.invited", batchId, { count: people.length });
  return c.json(
    {
      batchId,
      sent: people.length,
      invited: people.length,
      joinedFrom: iso(first),
      joinedTo: iso(lastJoined),
    },
    201,
  );
});

async function loadBatch(c: C) {
  const id = c.req.param("id") ?? "";
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  return c.env.DB.prepare("SELECT id FROM waitlist_batches WHERE id = ?")
    .bind(id)
    .first<{ id: string }>();
}

// POST /waitlist/batches/:id/remind: the one reminder, with a fresh 14-day link, to people still not joined.
adminWaitlist.post("/batches/:id/remind", requireAdmin("users_waitlist", "manage"), async (c) => {
  const batch = await loadBatch(c);
  if (!batch) return notFound(c, "That batch");
  const blocked = await limited(
    c,
    `admin-invites:admin:${c.get("admin").id}`,
    LIMITS.adminInvitesAdmin,
    "admin_waitlist_invites",
  );
  if (blocked) return blocked;
  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);
  // Atomic claim: each person can be marked reminded once, so a double click cannot send twice.
  const claimed = await db
    .prepare(
      `UPDATE waitlist_invites SET reminded_at = ?2
        WHERE batch_id = ?1 AND reminded_at IS NULL AND invited_at <= ?3
          AND EXISTS (SELECT 1 FROM invites i WHERE i.id = waitlist_invites.invite_id
                       AND i.used_at IS NULL AND i.expires_at > ?2)
          AND NOT EXISTS (SELECT 1 FROM waitlist_subscribers s JOIN user u ON u.email = lower(s.email)
                           WHERE s.id = waitlist_invites.subscriber_id)
        RETURNING subscriber_id`,
    )
    .bind(batch.id, now, now - REMIND_AFTER_DAYS * DAY)
    .all<{ subscriber_id: number }>();
  const ids = claimed.results.map((r) => r.subscriber_id);
  if (!ids.length)
    return c.json(authError("none_eligible", "No one in this batch needs a reminder."), 409);
  const people = await db
    .prepare(
      `SELECT id, email FROM waitlist_subscribers WHERE id IN (${ids.map(() => "?").join(",")})`,
    )
    .bind(...ids)
    .all<{ id: number; email: string }>();
  try {
    const invites = await Promise.all(
      people.results.map((p) =>
        prepareInvite(c.env, {
          email: p.email,
          createdBy: c.get("admin").id,
          ttlSeconds: WAITLIST_INVITE_TTL_SECONDS,
        }),
      ),
    );
    await db.batch(invites.map((i) => i.statement));
    for (const inv of invites)
      await enqueueAuthEmail(c.env, { type: "waitlist-reminder", to: inv.email, link: inv.link });
  } catch {
    await db
      .prepare(
        `UPDATE waitlist_invites SET reminded_at = NULL WHERE batch_id = ? AND subscriber_id IN (${ids.map(() => "?").join(",")})`,
      )
      .bind(batch.id, ...ids)
      .run();
    return c.json(authError("unavailable", "We couldn’t send the reminders. Try again."), 502);
  }
  await audit(c, "admin.waitlist.reminded", batch.id, { count: ids.length });
  return c.json({ reminded: ids.length });
});
