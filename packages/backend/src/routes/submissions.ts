import {
  createSubmissionSchema,
  type SubmissionErrorBody,
  updateSubmissionSchema,
} from "@matr/types";
import { Hono } from "hono";
import type { z } from "zod";
import { writeAudit } from "../auth/audit";
import { type AuthedEnv, authError, can } from "../auth/guard";
import { hit, LIMITS } from "../auth/limits";
import { checkSubmissionUrl } from "../auth/submission-url";
import { type SubmissionRow, toSubmission } from "../auth/submissions";
import { verifyTurnstile } from "../auth/turnstile";
import { clientIp, truncateIp } from "../auth/util";

// Mounted by routes/me.ts, so requireSession (and requireAuthSecret on /api/me/*) already ran.
export const submissions = new Hono<AuthedEnv>();

const err = (code: SubmissionErrorBody["code"], message: string, extra = {}) =>
  authError(code, message, extra);

function fieldErrors(error: z.ZodError): SubmissionErrorBody["fieldErrors"] {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (["url", "title", "note", "topic"].includes(key) && !out[key])
      out[key] = key === "topic" ? "Pick one of the listed topics." : "Check this field.";
  }
  return Object.keys(out).length ? out : undefined;
}

const invalidRequest = (error: z.ZodError) => {
  const fe = fieldErrors(error);
  return err("invalid_request", "Check the details you entered.", fe ? { fieldErrors: fe } : {});
};

const COLUMNS =
  "id, user_id, url, title, note, topic, status, curator_note, created_at, updated_at";

// Own rows only: the user id comes from the session, never from the request.
submissions.get("/", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "view")) return c.json(err("unauthorized", "Not allowed."), 403);
  const rows = await c.env.DB.prepare(
    `SELECT ${COLUMNS} FROM resource_submissions WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 100`,
  )
    .bind(user.id)
    .all<SubmissionRow>();
  return c.json({ submissions: rows.results.map(toSubmission) });
});

submissions.post("/", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "manage")) return c.json(err("unauthorized", "Not allowed."), 403);
  const parsed = createSubmissionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(invalidRequest(parsed.error), 400);
  const { url, title, note, topic } = parsed.data;
  const checked = checkSubmissionUrl(url);
  if (!checked.ok)
    return c.json(err("invalid_url", "Enter a public https link to the resource."), 400);

  const h = c.req.raw.headers;
  const ip = clientIp(h);
  const ua = h.get("user-agent");
  const db = c.env.DB;
  for (const [key, rule, scope] of [
    [`submission:user:${user.id}`, LIMITS.submissionUser, "submission_user"],
    [`submission:ip:${truncateIp(ip) || "unknown"}`, LIMITS.submissionIp, "submission_ip"],
  ] as const) {
    const r = await hit(db, key, rule);
    if (!r.allowed) {
      await writeAudit(db, { actor: user.id, action: "rate_limit.hit", ip, ua, meta: { scope } });
      c.header("Retry-After", String(r.retryAfterSec));
      return c.json(
        err("rate_limited", "You've sent a lot of links. Try again later.", {
          retryAfterSeconds: r.retryAfterSec,
        }),
        429,
      );
    }
  }

  const token = h.get("x-captcha-response");
  const captcha = await verifyTurnstile(c.env, token, ip);
  if (captcha === "unavailable")
    return c.json(
      err("captcha_unavailable", "We couldn't check that you're human. Try again shortly."),
      503,
    );
  if (captcha === "failed") {
    await writeAudit(db, {
      actor: user.id,
      action: "turnstile.failed",
      ip,
      ua,
      meta: { missing: !token },
    });
    return c.json(
      err(
        token ? "captcha_failed" : "captcha_required",
        token ? "Captcha failed. Try again." : "Complete the captcha to continue.",
      ),
      400,
    );
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  let row: SubmissionRow | null;
  try {
    row = await db
      .prepare(
        `INSERT INTO resource_submissions (id, user_id, url, url_normalised, title, note, topic, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'in_review', ?8, ?8) RETURNING ${COLUMNS}`,
      )
      .bind(id, user.id, url, checked.normalised, title ?? null, note ?? null, topic ?? null, now)
      .first<SubmissionRow>();
  } catch (e) {
    if (e instanceof Error && /UNIQUE/i.test(e.message))
      return c.json(err("already_submitted", "You've already sent us this link."), 409);
    throw e;
  }
  if (!row) throw new Error("submission insert returned no row");
  await writeAudit(db, {
    actor: user.id,
    action: "submission.created",
    target: id,
    ip,
    ua,
    meta: { status: "in_review", topic: topic ?? null },
  });
  return c.json({ submission: toSubmission(row) }, 201);
});

submissions.patch("/:id", async (c) => {
  const user = c.get("user");
  if (!can(user, "learner.self", "manage")) return c.json(err("unauthorized", "Not allowed."), 403);
  const parsed = updateSubmissionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(invalidRequest(parsed.error), 400);
  const { title, note, topic } = parsed.data;
  const id = c.req.param("id");
  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);
  // One atomic statement, scoped to the caller and to the editable state.
  const row = await db
    .prepare(
      `UPDATE resource_submissions SET
         title = CASE WHEN ?3 THEN ?4 ELSE title END,
         note = CASE WHEN ?5 THEN ?6 ELSE note END,
         topic = CASE WHEN ?7 THEN ?8 ELSE topic END,
         status = 'in_review', updated_at = ?9
       WHERE id = ?1 AND user_id = ?2 AND status = 'needs_changes' RETURNING ${COLUMNS}`,
    )
    .bind(
      id,
      user.id,
      title !== undefined ? 1 : 0,
      title ?? null,
      note !== undefined ? 1 : 0,
      note ?? null,
      topic !== undefined ? 1 : 0,
      topic ?? null,
      now,
    )
    .first<SubmissionRow>();
  if (!row) {
    const own = await db
      .prepare("SELECT id FROM resource_submissions WHERE id = ? AND user_id = ?")
      .bind(id, user.id)
      .first();
    if (!own) return c.json(err("not_found", "We couldn't find that submission."), 404);
    return c.json(err("not_editable", "This submission can't be edited right now."), 409);
  }
  await writeAudit(db, {
    actor: user.id,
    action: "submission.edited",
    target: id,
    ip: clientIp(c.req.raw.headers),
    ua: c.req.raw.headers.get("user-agent"),
    meta: { status: "in_review" },
  });
  return c.json({ submission: toSubmission(row) });
});
