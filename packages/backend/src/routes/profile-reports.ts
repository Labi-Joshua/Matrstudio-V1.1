import { reportProfileSchema } from "@matr/types";
import { Hono } from "hono";
import { writeAudit } from "../auth/audit";
import { type AuthedEnv, authError, can } from "../auth/guard";
import { hit, LIMITS } from "../auth/limits";
import { clientIp } from "../auth/util";
import { checkUsername } from "../profile/data";

// Mounted by routes/me.ts at /me/profile-reports, so requireSession already ran. Reports about a
// public profile land in the admin Review queues (Profile reports). Posting needs no other tickets:
// the support-ticket kinds cannot carry a profile.
export const profileReports = new Hono<AuthedEnv>();

profileReports.post("/", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "manage"))
    return c.json(authError("unauthorized", "Not allowed."), 403);
  const parsed = reportProfileSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(authError("invalid_request", "Check the details you entered."), 400);
  const db = c.env.DB;
  const limit = await hit(db, `profile-report:${user.id}`, LIMITS.profileReportUser);
  if (!limit.allowed) {
    c.header("Retry-After", String(limit.retryAfterSec));
    return c.json(
      authError("rate_limited", "You’ve sent a lot of reports. Try again later.", {
        retryAfterSeconds: limit.retryAfterSec,
      }),
      429,
    );
  }
  const checked = checkUsername(parsed.data.username.toLowerCase());
  // One answer for unknown, private and hidden profiles.
  const notFound = () => c.json(authError("not_found", "This profile isn’t available."), 404);
  if (!checked.ok) return notFound();
  const profile = await db
    .prepare(
      "SELECT user_id FROM profiles WHERE username = ? AND is_public = 1 AND hidden_at IS NULL",
    )
    .bind(checked.username)
    .first<{ user_id: string }>();
  if (!profile) return notFound();
  if (profile.user_id === user.id)
    return c.json(authError("invalid_request", "You can’t report your own profile."), 400);
  // "OR IGNORE": a second open report from the same person is the same report.
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO profile_reports (id, reporter_id, profile_user_id, reason, note, created_at)
       VALUES (?, ?, ?, ?, ?, unixepoch())`,
    )
    .bind(
      crypto.randomUUID(),
      user.id,
      profile.user_id,
      parsed.data.reason,
      parsed.data.note || null,
    )
    .run();
  if (res.meta.changes)
    await writeAudit(db, {
      actor: user.id,
      action: "profile.reported",
      target: profile.user_id,
      ip: clientIp(c.req.raw.headers),
      ua: c.req.header("user-agent"),
      meta: { reason: parsed.data.reason },
    });
  return c.json({ ok: true }, 201);
});
