import { zValidator } from "@hono/zod-validator";
import { waitlistSignupSchema } from "@matr/types";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "../env";
import { cachedJson } from "../lib/cache";
import { sendVerificationEmail } from "../lib/email";
import { apiError } from "../lib/errors";
import { generateReferralCode } from "../lib/referral";
import { verifyVerifyToken } from "../lib/token";
import { rateLimit } from "../middleware/rate-limit";

export const waitlist = new Hono<AppEnv>();

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
    }

    // Same response for new and existing emails: the endpoint cannot be used to enumerate subscribers.
    return c.json({ ok: true as const }, 202);
  },
);

// GET /api/waitlist/verify?token=...
waitlist.get("/verify", rateLimit("API_LIMITER"), async (c) => {
  const email = await verifyVerifyToken(c.env.VERIFY_SECRET, c.req.query("token") ?? "");
  if (!email) return c.redirect(`${c.env.PUBLIC_WEB_URL}/verify-failed`, 302);

  await c.env.DB.prepare(
    `UPDATE waitlist_subscribers
        SET status = 'verified', updated_at = unixepoch()
      WHERE email = ?1 AND status = 'pending'`,
  )
    .bind(email)
    .run();

  return c.redirect(`${c.env.PUBLIC_WEB_URL}/verified`, 302);
});

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
