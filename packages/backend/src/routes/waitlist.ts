import { zValidator } from "@hono/zod-validator";
import { waitlistResendSchema, waitlistSignupSchema } from "@matr/types";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv, Bindings } from "../env";
import { cachedJson } from "../lib/cache";
import { sendVerificationEmail } from "../lib/email";
import { apiError } from "../lib/errors";
import { generateReferralCode } from "../lib/referral";
import { readVerifyToken, VERIFY_TTL_SECONDS } from "../lib/token";
import { rateLimit } from "../middleware/rate-limit";

export const waitlist = new Hono<AppEnv>();

/** Minimum gap between two confirmation emails to the same address. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Sends a new confirmation link if the address is still pending and the last one went out more
 * than a minute ago. updated_at records when the latest link was sent (see /verify).
 * One statement: the cooldown check and the timestamp update cannot race.
 */
async function resendIfPending(
  env: Bindings,
  ctx: { waitUntil(promise: Promise<unknown>): void },
  email: string,
) {
  const row = await env.DB.prepare(
    `UPDATE waitlist_subscribers
        SET updated_at = unixepoch()
      WHERE email = ?1 AND status = 'pending' AND updated_at <= unixepoch() - ?2
      RETURNING id`,
  )
    .bind(email, RESEND_COOLDOWN_SECONDS)
    .first<{ id: number }>();
  if (row) ctx.waitUntil(sendVerificationEmail(env, email));
}

async function turnstileOk(secret: string, token: string | undefined, ip: string | undefined) {
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
  });
  return ((await res.json()) as { success?: boolean }).success === true;
}

// POST /api/waitlist
waitlist.post(
  "/",
  rateLimit("SIGNUP_LIMITER"),
  bodyLimit({
    maxSize: 4 * 1024, // a signup is ~200 bytes; refuse anything bigger before parsing
    onError: (c) => c.json(apiError("payload_too_large", "Request body too large."), 413),
  }),
  zValidator("json", waitlistSignupSchema, (result, c) => {
    if (!result.success) {
      return c.json(apiError("invalid_request", "Check the email address and try again."), 400);
    }
  }),
  async (c) => {
    const body = c.req.valid("json");

    if (c.env.TURNSTILE_SECRET) {
      const ok = await turnstileOk(
        c.env.TURNSTILE_SECRET,
        body.turnstileToken,
        c.req.header("cf-connecting-ip"),
      );
      if (!ok) return c.json(apiError("captcha_failed", "Verification failed. Please retry."), 400);
    }

    // One statement, one write path: INSERT ... ON CONFLICT DO NOTHING + RETURNING.
    // No SELECT-then-INSERT race and no extra read. A duplicate returns no row.
    const inserted = await c.env.DB.prepare(
      `INSERT INTO waitlist_subscribers (email, referral_code, referred_by, metadata)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
    )
      .bind(
        body.email,
        generateReferralCode(),
        body.referralCode ?? null,
        JSON.stringify(body.metadata ?? {}),
      )
      .first<{ id: number }>();

    if (inserted) {
      c.executionCtx.waitUntil(sendVerificationEmail(c.env, body.email));
    } else {
      // Already signed up: a pending address gets a fresh link (the old one may have expired).
      await resendIfPending(c.env, c.executionCtx, body.email);
    }

    // Same response for new and existing emails: the endpoint cannot be used to enumerate subscribers.
    return c.json({ ok: true as const }, 202);
  },
);

// GET /api/waitlist/verify?token=...
// Redirects to the page for each outcome:
//   /verified          confirmed now
//   /verify-already    this address was confirmed before
//   /verify-expired    authentic but past its 24 hours (the page offers a new link)
//   /verify-failed     broken, unknown, or replaced by a newer link ("only the latest link works")
waitlist.get("/verify", rateLimit("API_LIMITER"), async (c) => {
  const web = c.env.PUBLIC_WEB_URL;
  const token = c.req.query("token") ?? "";
  const info = await readVerifyToken(c.env.VERIFY_SECRET, token);
  if (!info) return c.redirect(`${web}/verify-failed`, 302);

  const row = await c.env.DB.prepare(
    "SELECT status, updated_at FROM waitlist_subscribers WHERE email = ?1",
  )
    .bind(info.email)
    .first<{ status: string; updated_at: number }>();
  if (!row) return c.redirect(`${web}/verify-failed`, 302);
  if (row.status === "verified") return c.redirect(`${web}/verify-already`, 302);
  if (row.status !== "pending") return c.redirect(`${web}/verify-failed`, 302);

  // A newer link was sent after this one was issued: only the latest works. 5s of slack, since
  // the email is signed just after the row is written.
  const issuedAt = info.exp - VERIFY_TTL_SECONDS;
  if (issuedAt + 5 < row.updated_at) return c.redirect(`${web}/verify-failed`, 302);

  if (info.expired) {
    return c.redirect(`${web}/verify-expired?token=${encodeURIComponent(token)}`, 302);
  }

  await c.env.DB.prepare(
    `UPDATE waitlist_subscribers
        SET status = 'verified', updated_at = unixepoch()
      WHERE email = ?1 AND status = 'pending'`,
  )
    .bind(info.email)
    .run();

  return c.redirect(`${web}/verified`, 302);
});

// POST /api/waitlist/resend: "Send a new link" on the expired page. The token must be authentic
// (it may be expired, up to 30 days); the new link goes to the address inside it, so this can
// only ever email someone who already received one.
waitlist.post(
  "/resend",
  rateLimit("SIGNUP_LIMITER"),
  bodyLimit({
    maxSize: 2 * 1024,
    onError: (c) => c.json(apiError("payload_too_large", "Request body too large."), 413),
  }),
  zValidator("json", waitlistResendSchema, (result, c) => {
    if (!result.success) return c.json(apiError("invalid_request", "That link is not valid."), 400);
  }),
  async (c) => {
    const info = await readVerifyToken(c.env.VERIFY_SECRET, c.req.valid("json").token);
    const tooOld = !info || info.exp < Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
    if (tooOld) return c.json(apiError("invalid_request", "That link is not valid."), 400);

    await resendIfPending(c.env, c.executionCtx, info.email);
    // Same response whether or not an email went out (cooldown, already confirmed).
    return c.json({ ok: true as const }, 202);
  },
);

// GET /api/waitlist/stats: public counter, 1 row read on a miss, 0 on a hit.
waitlist.get("/stats", rateLimit("API_LIMITER"), async (c) => {
  const data = await cachedJson(c, 60, async () => {
    const row = await c.env.DB.prepare("SELECT total FROM waitlist_stats WHERE id = 1").first<{
      total: number;
    }>();
    return { total: row?.total ?? 0 };
  });
  c.header("Cache-Control", "public, max-age=60"); // let browsers cache it too
  return c.json(data);
});
