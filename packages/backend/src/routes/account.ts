import { zValidator } from "@hono/zod-validator";
import {
  type AccountSummary,
  emailChangeSchema,
  reauthSchema,
  setPasswordSchema,
} from "@matr/types";
import { isAPIError } from "better-auth/api";
import { isPasswordCompromised } from "better-auth/plugins/haveibeenpwned";
import { type Context, type Handler, Hono } from "hono";
import { collectLearnerExport, deleteLearnerAccount } from "../auth/account-deletion";
import { writeAudit } from "../auth/audit";
import { type AuthedEnv, authError, can } from "../auth/guard";
import { FRESH_AUTH_SECONDS, getAuth, SESSION_COOKIE } from "../auth/index";
import { hit, LIMITS, type Limit } from "../auth/limits";
import { verifyPassword } from "../auth/password";
import { clientIp, emailRef, truncateIp } from "../auth/util";
import { enqueueAuthEmail } from "../queue/auth-email";

// Mounted by routes/me.ts at /me/account, so requireSession (and requireAuthSecret on /api/me/*)
// already ran. Every query is scoped by the user id from the session, never from the request.
export const account = new Hono<AuthedEnv>();

const DAY_SECONDS = 86400;
const CHANGE_CALLBACK = "/settings/confirm-email";

const invalid = (
  result: { success: boolean },
  c: { json: (b: unknown, s: 400) => Response },
): Response | undefined =>
  result.success
    ? undefined
    : c.json(authError("invalid_request", "Check the details you entered."), 400);

const expiredSessionCookie = () =>
  `${SESSION_COOKIE}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`;

const auditCtx = (c: Context<AuthedEnv>) => ({
  actor: c.get("user").id,
  ip: clientIp(c.req.raw.headers),
  ua: c.req.header("user-agent"),
});

/** Spends one hit; on overflow audits (no personal data) and answers 429. */
async function limited(c: Context<AuthedEnv>, key: string, rule: Limit, scope: string) {
  const r = await hit(c.env.DB, key, rule);
  if (r.allowed) return null;
  await writeAudit(c.env.DB, { ...auditCtx(c), action: "rate_limit.hit", meta: { scope } });
  c.header("Retry-After", String(r.retryAfterSec));
  return c.json(
    authError("rate_limited", "Too many attempts. Try again later.", {
      retryAfterSeconds: r.retryAfterSec,
    }),
    429,
  );
}

const hasFreshSession = (c: Context<AuthedEnv>) =>
  Date.now() - c.get("session").createdAt.getTime() < FRESH_AUTH_SECONDS * 1000;

async function passwordHash(c: Context<AuthedEnv>) {
  const row = await c.env.DB.prepare(
    "SELECT password FROM account WHERE userId = ? AND providerId = 'credential'",
  )
    .bind(c.get("user").id)
    .first<{ password: string | null }>();
  return row?.password ?? null;
}

/**
 * Re-authentication for actions that could take the account over: a session created in the last
 * 5 minutes, or the account password in the request (checked against the stored hash and counted
 * per attempt). Returns a response to send when it fails.
 */
async function requireReauth(
  c: Context<AuthedEnv>,
  password: string | undefined,
): Promise<Response | null> {
  if (hasFreshSession(c)) return null;
  const hash = password ? await passwordHash(c) : null;
  if (password && hash) {
    const blocked = await limited(
      c,
      `reauth:user:${c.get("user").id}`,
      LIMITS.reauthUser,
      "reauth",
    );
    if (blocked) return blocked;
    if (await verifyPassword(hash, password)) return null;
  }
  return c.json(authError("reauth_required", "Confirm it is you to continue."), 401);
}

const guard = (c: Context<AuthedEnv>, level: "view" | "manage") =>
  can(c.get("user"), "learner.self", level)
    ? null
    : c.json(authError("forbidden", "Not allowed."), 403);

type PendingRow = { new_email: string; requested_at: number };

async function loadPending(db: D1Database, userId: string): Promise<PendingRow | null> {
  const row = await db
    .prepare("SELECT new_email, requested_at FROM pending_email_changes WHERE user_id = ?")
    .bind(userId)
    .first<PendingRow>();
  if (!row) return null;
  // The emailed link lasts 24 hours; after that the change is simply gone.
  if (row.requested_at + DAY_SECONDS <= Math.floor(Date.now() / 1000)) return null;
  return row;
}

const count = async (db: D1Database, sql: string, userId: string) =>
  (await db.prepare(sql).bind(userId).first<{ n: number }>())?.n ?? 0;

account.get("/", async (c) => {
  const denied = guard(c, "view");
  if (denied) return denied;
  const user = c.get("user");
  const db = c.env.DB;
  const [accounts, passkeys, saved, submissions, pending] = await Promise.all([
    db
      .prepare("SELECT providerId, password FROM account WHERE userId = ?")
      .bind(user.id)
      .all<{ providerId: string; password: string | null }>(),
    count(db, "SELECT COUNT(*) AS n FROM passkey WHERE userId = ?", user.id),
    count(db, "SELECT COUNT(*) AS n FROM saved_resources WHERE user_id = ?", user.id),
    count(db, "SELECT COUNT(*) AS n FROM resource_submissions WHERE user_id = ?", user.id),
    loadPending(db, user.id),
  ]);
  const body: AccountSummary = {
    hasPassword: accounts.results.some((a) => a.providerId === "credential" && !!a.password),
    google: { linked: accounts.results.some((a) => a.providerId === "google") },
    passkeyCount: passkeys,
    pendingEmail: pending
      ? {
          email: pending.new_email,
          requestedAt: new Date(pending.requested_at * 1000).toISOString(),
          expiresAt: new Date((pending.requested_at + DAY_SECONDS) * 1000).toISOString(),
        }
      : null,
    counts: { saved, submissions },
  };
  return c.json({ account: body });
});

/**
 * Starts (or restarts) an email change. The link goes to the NEW address through Better Auth's
 * change-email flow (signed, single use, 24 hours); the address only changes when it is opened,
 * which then revokes every session and warns the old address (auth/index.ts). When the new
 * address already belongs to someone, the answer is the same and no link is sent, so this cannot
 * be used to find out who has an account.
 */
async function requestChange(c: Context<AuthedEnv>, newEmail: string, kind: "new" | "resend") {
  const user = c.get("user");
  const db = c.env.DB;
  const ref = await emailRef(c.env.BETTER_AUTH_SECRET, newEmail);
  const taken = await db
    .prepare("SELECT 1 AS x FROM user WHERE lower(email) = ?")
    .bind(newEmail)
    .first();
  await db
    .prepare(
      `INSERT INTO pending_email_changes (user_id, new_email, requested_at) VALUES (?1, ?2, unixepoch())
       ON CONFLICT(user_id) DO UPDATE SET new_email = ?2, requested_at = unixepoch()`,
    )
    .bind(user.id, newEmail)
    .run();
  if (!taken) {
    try {
      await getAuth(c.env).api.changeEmail({
        body: { newEmail, callbackURL: CHANGE_CALLBACK },
        headers: c.req.raw.headers,
      });
    } catch (err) {
      if (!isAPIError(err)) throw err;
      await db.prepare("DELETE FROM pending_email_changes WHERE user_id = ?").bind(user.id).run();
      return c.json(authError("unavailable", "We couldn't send the link. Try again."), 502);
    }
  }
  await writeAudit(db, {
    ...auditCtx(c),
    action: "email.change_requested",
    target: `email:${ref}`,
    meta: { kind },
  });
  return null;
}

account.post("/email", zValidator("json", emailChangeSchema, invalid), async (c) => {
  const denied = guard(c, "manage");
  if (denied) return denied;
  const user = c.get("user");
  const { newEmail, password } = c.req.valid("json");
  const ipLimit = await limited(
    c,
    `emailchange:ip:${truncateIp(clientIp(c.req.raw.headers))}`,
    LIMITS.emailChangeIp,
    "email_change_ip",
  );
  if (ipLimit) return ipLimit;
  const reauth = await requireReauth(c, password);
  if (reauth) return reauth;
  if (newEmail === user.email.toLowerCase())
    return c.json(authError("same_email", "That is already your email address."), 400);
  const blocked = await limited(
    c,
    `emailchange:user:${user.id}`,
    LIMITS.emailChangeUser,
    "email_change_user",
  );
  if (blocked) return blocked;
  const failed = await requestChange(c, newEmail, "new");
  if (failed) return failed;
  return c.json({ pendingEmail: newEmail });
});

account.post("/email/resend", async (c) => {
  const denied = guard(c, "manage");
  if (denied) return denied;
  const user = c.get("user");
  const pending = await loadPending(c.env.DB, user.id);
  if (!pending) return c.json(authError("not_found", "There is no email change to resend."), 404);
  const blocked = await limited(
    c,
    `emailchange:user:${user.id}`,
    LIMITS.emailChangeUser,
    "email_change_user",
  );
  if (blocked) return blocked;
  const failed = await requestChange(c, pending.new_email, "resend");
  if (failed) return failed;
  return c.json({ pendingEmail: pending.new_email });
});

account.delete("/email", async (c) => {
  const denied = guard(c, "manage");
  if (denied) return denied;
  const res = await c.env.DB.prepare("DELETE FROM pending_email_changes WHERE user_id = ?")
    .bind(c.get("user").id)
    .run();
  if (res.meta.changes)
    await writeAudit(c.env.DB, { ...auditCtx(c), action: "email.change_cancelled" });
  return c.json({ cancelled: true });
});

// Google-only accounts add a password. A session that is not fresh could be a stolen cookie
// planting a second way in, so this needs a session created in the last 5 minutes. Hashing, the
// length rules and the breach check run inside Better Auth (auth/index.ts, PWNED_PATHS).
account.post("/password", zValidator("json", setPasswordSchema, invalid), async (c) => {
  const denied = guard(c, "manage");
  if (denied) return denied;
  const user = c.get("user");
  if (!hasFreshSession(c))
    return c.json(authError("reauth_required", "Sign in again to set a password."), 401);
  if (await passwordHash(c))
    return c.json(authError("password_exists", "This account already has a password."), 409);
  const blocked = await limited(c, `account:user:${user.id}`, LIMITS.accountUser, "account_user");
  if (blocked) return blocked;
  let compromised = false;
  try {
    compromised = await isPasswordCompromised(c.req.valid("json").newPassword);
  } catch {
    // The k-anonymity lookup failed: fail open like the other password routes, but leave a trace.
    await writeAudit(c.env.DB, {
      action: "pwned_check.unavailable",
      meta: { path: "/set-password" },
    });
  }
  if (compromised)
    return c.json(
      authError(
        "PASSWORD_COMPROMISED",
        "That password has appeared in a data breach. Please choose a different one.",
      ),
      400,
    );
  try {
    await getAuth(c.env).api.setPassword({
      body: { newPassword: c.req.valid("json").newPassword },
      headers: c.req.raw.headers,
    });
  } catch (err) {
    if (!isAPIError(err)) throw err;
    const body = err.body as { code?: string; message?: string } | undefined;
    return c.json(
      authError(body?.code ?? "invalid_request", body?.message ?? "Choose a different password."),
      400,
    );
  }
  await c.env.DB.prepare("DELETE FROM session WHERE userId = ? AND id <> ?")
    .bind(user.id, c.get("session").id)
    .run();
  await writeAudit(c.env.DB, {
    ...auditCtx(c),
    action: "password.set",
    meta: { sessionsRevoked: true },
  });
  await enqueueAuthEmail(c.env, {
    type: "password-updated",
    to: user.email,
    when: new Date().toUTCString(),
    device: "Matr Studio settings",
  });
  return c.json({ hasPassword: true });
});

// Unlinks Google only when another way to sign in remains (a password or a passkey).
account.delete("/google", async (c) => {
  const denied = guard(c, "manage");
  if (denied) return denied;
  const user = c.get("user");
  const db = c.env.DB;
  const hasPassword = !!(await passwordHash(c));
  if (!hasFreshSession(c) && !hasPassword)
    return c.json(authError("reauth_required", "Sign in again to unlink Google."), 401);
  const blocked = await limited(c, `account:user:${user.id}`, LIMITS.accountUser, "account_user");
  if (blocked) return blocked;
  const passkeys = await count(db, "SELECT COUNT(*) AS n FROM passkey WHERE userId = ?", user.id);
  if (!hasPassword && !passkeys)
    return c.json(
      authError("last_sign_in_method", "Set a password first: Google is your only way to sign in."),
      409,
    );
  const res = await db
    .prepare("DELETE FROM account WHERE userId = ? AND providerId = 'google'")
    .bind(user.id)
    .run();
  if (res.meta.changes) await writeAudit(db, { ...auditCtx(c), action: "account.google_unlinked" });
  return c.json({ unlinked: true });
});

// A copy of the learner's own data. Never includes password hashes, tokens or session rows.
account.get("/export", async (c) => {
  const denied = guard(c, "view");
  if (denied) return denied;
  const user = c.get("user");
  const db = c.env.DB;
  const blocked = await limited(c, `export:user:${user.id}`, LIMITS.exportUser, "export_user");
  if (blocked) return blocked;
  const body = await collectLearnerExport(db, user);
  await writeAudit(db, { ...auditCtx(c), action: "account.exported" });
  c.header("Content-Disposition", 'attachment; filename="matr-studio-data.json"');
  c.header("Cache-Control", "no-store");
  return c.json(body);
});

// Deletes the learner and everything they own. Needs re-authentication: a session created in the
// last 5 minutes, or the account password in the body. Rows in other tables go with the user
// (ON DELETE CASCADE); audit rows keep their action and time but lose actor, target, IP and agent.
export const deleteAccount: Handler<AuthedEnv> = async (c) => {
  const denied = guard(c, "manage");
  if (denied) return denied;
  const user = c.get("user");
  const db = c.env.DB;
  const parsed = reauthSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success)
    return c.json(authError("invalid_request", "Check the details you entered."), 400);
  const reauth = await requireReauth(c, parsed.data.password);
  if (reauth) return reauth;
  await deleteLearnerAccount(c.env, user);
  await writeAudit(db, { action: "account.deleted", meta: {} });
  c.header("Set-Cookie", expiredSessionCookie());
  return c.json({ deleted: true });
};

account.delete("/", deleteAccount);
