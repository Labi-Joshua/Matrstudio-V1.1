import { zValidator } from "@hono/zod-validator";
import { DEFAULT_PREFS, prefsPatchSchema, type ReminderDay, type UserPrefs } from "@matr/types";
import { Hono } from "hono";
import { writeAudit } from "../auth/audit";
import { type AuthedEnv, authError, can } from "../auth/guard";
import { hit, LIMITS } from "../auth/limits";
import { clientIp } from "../auth/util";

// Mounted by routes/me.ts at /me/prefs: signed-in learners only, own row only (the user id comes
// from the session). The goal, level and topics stay in POST /api/me/onboarding.
export const prefs = new Hono<AuthedEnv>();

type Row = {
  notify_submissions: number;
  notify_lessons: number;
  notify_help: number;
  email_digest: number;
  email_reminders: number;
  email_news: number;
  reminder_days: string;
  reminder_time: string;
  weekly_goal: number;
};

function parseDays(raw: string): ReminderDay[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as ReminderDay[]) : [];
  } catch {
    return [];
  }
}

const toPrefs = (r: Row | null): UserPrefs =>
  r
    ? {
        notifications: {
          submissions: !!r.notify_submissions,
          lessons: !!r.notify_lessons,
          helpReplies: !!r.notify_help,
        },
        email: { digest: !!r.email_digest, reminders: !!r.email_reminders, news: !!r.email_news },
        reminders: { days: parseDays(r.reminder_days), time: r.reminder_time },
        learning: { weeklyGoal: r.weekly_goal },
      }
    : DEFAULT_PREFS;

const load = (db: D1Database, userId: string) =>
  db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").bind(userId).first<Row>();

/** Drops keys the client left out, so a spread never erases a stored value. */
function defined<T extends object>(group: T | undefined): Partial<T> {
  return Object.fromEntries(
    Object.entries(group ?? {}).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

prefs.get("/", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "view"))
    return c.json(authError("forbidden", "Not allowed."), 403);
  return c.json({ prefs: toPrefs(await load(c.env.DB, user.id)) });
});

// Partial and idempotent: the same body twice gives the same state. Only the fields sent change.
prefs.patch(
  "/",
  zValidator("json", prefsPatchSchema, (result, c) =>
    result.success
      ? undefined
      : c.json(authError("invalid_request", "Check the settings you chose."), 400),
  ),
  async (c) => {
    const user = c.get("user");
    if (!can(user, "learner.self", "manage"))
      return c.json(authError("forbidden", "Not allowed."), 403);
    const db = c.env.DB;
    const r = await hit(db, `prefs:user:${user.id}`, LIMITS.prefsUser);
    if (!r.allowed) {
      await writeAudit(db, {
        actor: user.id,
        action: "rate_limit.hit",
        ip: clientIp(c.req.raw.headers),
        ua: c.req.header("user-agent"),
        meta: { scope: "prefs_user" },
      });
      c.header("Retry-After", String(r.retryAfterSec));
      return c.json(
        authError("rate_limited", "You're changing settings a lot. Try again later.", {
          retryAfterSeconds: r.retryAfterSec,
        }),
        429,
      );
    }
    const patch = c.req.valid("json");
    const current = toPrefs(await load(db, user.id));
    const next: UserPrefs = {
      notifications: { ...current.notifications, ...defined(patch.notifications) },
      email: { ...current.email, ...defined(patch.email) },
      reminders: { ...current.reminders, ...defined(patch.reminders) },
      learning: { ...current.learning, ...defined(patch.learning) },
    };
    await db
      .prepare(
        `INSERT INTO user_preferences (user_id, notify_submissions, notify_lessons, notify_help, email_digest,
           email_reminders, email_news, reminder_days, reminder_time, weekly_goal, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, unixepoch())
         ON CONFLICT(user_id) DO UPDATE SET
           notify_submissions = ?2, notify_lessons = ?3, notify_help = ?4, email_digest = ?5,
           email_reminders = ?6, email_news = ?7, reminder_days = ?8, reminder_time = ?9,
           weekly_goal = ?10, updated_at = unixepoch()`,
      )
      .bind(
        user.id,
        Number(next.notifications.submissions),
        Number(next.notifications.lessons),
        Number(next.notifications.helpReplies),
        Number(next.email.digest),
        Number(next.email.reminders),
        Number(next.email.news),
        JSON.stringify(next.reminders.days),
        next.reminders.time,
        next.learning.weeklyGoal,
      )
      .run();
    await writeAudit(db, {
      actor: user.id,
      action: "prefs.updated",
      ip: clientIp(c.req.raw.headers),
      ua: c.req.header("user-agent"),
    });
    return c.json({ prefs: toPrefs(await load(db, user.id)) });
  },
);
