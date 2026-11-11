import {
  type AdminMeResponse,
  adminChangePasswordSchema,
  adminInviteAcceptSchema,
  adminInviteEnrolSchema,
  adminMfaSchema,
  adminReauthSchema,
  adminSignInSchema,
  adminTeamInviteSchema,
} from "@matr/types";
import { isPasswordCompromised } from "better-auth/plugins/haveibeenpwned";
import { type Context, Hono } from "hono";
import type { ZodType } from "zod";
import { type AccessEnv, requireAccess } from "../auth/access";
import { checkSecondFactor } from "../auth/admin-factor";
import {
  type AdminCtx,
  requireAdmin,
  requireAdminSession,
  requireFreshAuth,
} from "../auth/admin-guard";
import { InviteError, issueAdminInvite, resolveInvite } from "../auth/admin-invites";
import { adminKeys } from "../auth/admin-lock";
import {
  loadPermissions,
  menuFor,
  revokeAdminSessions,
  SUPER_ADMIN_ROLE,
} from "../auth/admin-perms";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateBackupCodes,
  hashBackupCode,
  normaliseBackupCode,
} from "../auth/admin-secrets";
import {
  ADMIN_FRESH_AUTH_SECONDS,
  type AdminAccount,
  type AdminSession,
  adminSessionCookie,
  adminTokenFrom,
  createAdminSession,
  deleteAdminSession,
  expiredAdminSessionCookie,
  loadAdminSession,
} from "../auth/admin-session";
import { writeAudit } from "../auth/audit";
import { authError } from "../auth/guard";
import {
  adminMfaDelaySeconds,
  blockedFor,
  blockUntil,
  clear,
  hit,
  LIMITS,
  windowState,
} from "../auth/limits";
import { hashPassword, SCRYPT_DEFAULTS, verifyPassword } from "../auth/password";
import { hashSessionToken } from "../auth/session-hash";
import { formatSecretKey, generateTotpSecret, otpauthUri, verifyTotp } from "../auth/totp";
import { clientIp, describeDevice, emailRef, sha256Hex } from "../auth/util";
import type { Bindings } from "../env";
import { enqueueAuthEmail } from "../queue/auth-email";
import { adminAudit } from "./admin-audit";
import { adminDashboard } from "./admin-dashboard";
import { adminMetrics } from "./admin-metrics";
import { adminRoles } from "./admin-roles";
import { adminShell, shellCounts } from "./admin-shell";
import { adminSupport } from "./admin-support";
import { adminSupportInbox } from "./admin-support-inbox";
import { adminTeam } from "./admin-team";
import { adminUsers } from "./admin-users";
import { adminWaitlist } from "./admin-waitlist";

/**
 * Admin auth API, everything under /api/admin. Lock 1 (Cloudflare Access JWT) runs on every route
 * below. Lock 2 (admin session) runs on every route except the ones that create one: sign-in, the
 * 2-step step of sign-in, and the invite flow. See packages/backend/ADMIN-AUTH.md for the contract.
 */
export const admin = new Hono<AdminCtx>();
admin.use("*", requireAccess);
admin.route("/support", adminSupport);
admin.route("/team", adminTeam);
admin.route("/roles", adminRoles);
admin.route("/audit", adminAudit);
admin.route("/", adminShell);
admin.route("/support", adminSupportInbox);
admin.route("/users", adminUsers);
admin.route("/waitlist", adminWaitlist);
admin.route("/dashboard", adminDashboard);
admin.route("/metrics", adminMetrics);

type C = Context<AdminCtx>;

// --- helpers ---------------------------------------------------------------------------------
const invalidRequest = (c: C) =>
  c.json(authError("invalid_request", "Check the details you entered."), 400);

async function parse<T>(c: C, schema: ZodType<T>): Promise<T | null> {
  const raw = await c.req.json().catch(() => null);
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}

const minFloorMs = (env: Bindings) =>
  env.ENVIRONMENT !== "production" && env.AUTH_MIN_RESPONSE_MS
    ? Number(env.AUTH_MIN_RESPONSE_MS)
    : 400;

/** Pads a response so a known and an unknown account cannot be told apart by timing. */
async function padded<T>(env: Bindings, started: number, value: T): Promise<T> {
  const wait = minFloorMs(env) - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return value;
}

const scryptParams = (env: Bindings) => ({
  ...SCRYPT_DEFAULTS,
  N:
    env.ENVIRONMENT !== "production" && env.PASSWORD_SCRYPT_N
      ? Number(env.PASSWORD_SCRYPT_N)
      : SCRYPT_DEFAULTS.N,
});

// A real hash of a throwaway password, so an unknown account costs the same scrypt run as a known one.
const dummyHashes = new Map<number, Promise<string>>();
const dummyHash = (env: Bindings) => {
  const p = scryptParams(env);
  let h = dummyHashes.get(p.N);
  if (!h) {
    h = hashPassword("matr-studio-dummy-password-for-timing", p);
    dummyHashes.set(p.N, h);
  }
  return h;
};

const ipRef = async (env: Bindings, h: Headers) =>
  (await sha256Hex(`${env.BETTER_AUTH_SECRET}:ip:${clientIp(h)}`)).slice(0, 24);

const audit = (c: C, e: Parameters<typeof writeAudit>[1]) =>
  writeAudit(c.env.DB, {
    ip: clientIp(c.req.raw.headers),
    ua: c.req.header("user-agent"),
    ...e,
  });

const paused = (c: C, retryAfterSeconds: number) => {
  c.header("Retry-After", String(retryAfterSeconds));
  return c.json(
    {
      ...authError("too_many_attempts", "Too many attempts on this account. Try again later.", {
        retryAfterSeconds,
      }),
    },
    429,
  );
};

type AdminRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  role_id: string;
  status: "invited" | "active" | "suspended";
  totp_secret_enc: string | null;
  totp_pending_enc: string | null;
  totp_enrolled_at: number | null;
  totp_last_step: number;
  access_expires_at: number | null;
};

const ADMIN_COLS =
  "id, email, name, password_hash, role_id, status, totp_secret_enc, totp_pending_enc, totp_enrolled_at, totp_last_step, access_expires_at";

/** One "sign-in paused" email per window per admin (design: Sign-in paused). */
async function notifyPaused(c: C, adminRow: Pick<AdminRow, "id" | "email">) {
  const once = await hit(c.env.DB, adminKeys.notice(adminRow.id), LIMITS.adminPausedNotice);
  if (!once.allowed) return;
  await audit(c, { actor: adminRow.id, action: "admin.signin.paused" });
  await enqueueAuthEmail(c.env, {
    type: "admin-signin-paused",
    to: adminRow.email,
    when: new Date().toUTCString(),
    device: describeDevice(c.req.header("user-agent")),
  });
}

async function buildMe(
  env: Bindings,
  account: AdminAccount,
  session: AdminSession,
): Promise<AdminMeResponse> {
  const permissions = await loadPermissions(env.DB, account.roleId);
  const now = Math.floor(Date.now() / 1000);
  const counts = await shellCounts(env.DB, account.id, permissions);
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: { id: account.roleId, name: account.roleName },
    permissions,
    menu: menuFor(permissions),
    mfaEnrolled: account.mfaEnrolled,
    lastReauthAt: session.lastReauthAt,
    fresh: session.lastReauthAt !== null && now - session.lastReauthAt <= ADMIN_FRESH_AUTH_SECONDS,
    sessionExpiresAt: session.expiresAt,
    sessionAbsoluteExpiresAt: session.absoluteExpiresAt,
    accessExpiresAt: account.accessExpiresAt,
    badges: { review: counts.review },
    unreadNotifications: counts.unread,
  };
}

/** Refuses a 2-step attempt while the admin is paused (5 failures per 15 minutes) or in a progressive delay. */
async function secondFactorGate(c: C, adminId: string): Promise<Response | null> {
  const state = await windowState(c.env.DB, adminKeys.mfa(adminId), LIMITS.adminMfa);
  if (state.count >= LIMITS.adminMfa.limit) return paused(c, state.retryAfterSec);
  const wait = await blockedFor(c.env.DB, adminKeys.mfaWait(adminId));
  if (wait > 0) return paused(c, wait);
  return null;
}

/** Records a wrong code or password. Returns the paused response when this failure exhausts the budget. */
async function secondFactorFailed(c: C, a: AdminRow): Promise<Response | null> {
  const r = await hit(c.env.DB, adminKeys.mfa(a.id), LIMITS.adminMfa);
  const delay = adminMfaDelaySeconds(r.count);
  if (delay > 0)
    await blockUntil(c.env.DB, adminKeys.mfaWait(a.id), Math.floor(Date.now() / 1000) + delay);
  if (r.count >= LIMITS.adminMfa.limit) {
    await audit(c, { actor: a.id, action: "rate_limit.hit", meta: { scope: "admin_mfa" } });
    await notifyPaused(c, a);
    return paused(c, r.retryAfterSec);
  }
  return null;
}

async function remainingBackupCodes(db: D1Database, adminId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM admin_backup_codes WHERE admin_id = ? AND used_at IS NULL")
    .bind(adminId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

async function checkNewPassword(env: Bindings, password: string): Promise<string | null> {
  if (password.length < 12) return "password_too_short";
  if (password.length > 128) return "password_too_long";
  try {
    if (await isPasswordCompromised(password)) return "password_compromised";
  } catch {
    // k-anonymity lookup failed: fail open, but leave a trace (same rule as learners).
    console.error("pwned password check unavailable");
    await writeAudit(env.DB, { action: "pwned_check.unavailable", meta: { path: "admin" } });
  }
  return null;
}

const PASSWORD_MESSAGES: Record<string, string> = {
  password_too_short: "Use at least 12 characters.",
  password_too_long: "Use 128 characters or fewer.",
  password_compromised:
    "That password has appeared in a data breach. Please choose a different one.",
};

// --- sign-in ---------------------------------------------------------------------------------
// Step 1 of 2. Wrong email, wrong password, an inactive account and a wrong Access identity all
// answer the same 401 invalid_credentials, after the same amount of work and at least the same time.
admin.post("/sign-in", async (c) => {
  const started = Date.now();
  const body = await parse(c, adminSignInSchema);
  if (!body) return invalidRequest(c);
  const { email, password } = body;
  const h = c.req.raw.headers;
  const eref = await emailRef(c.env.BETTER_AUTH_SECRET, email);

  const [byEmail, byIp] = [
    await hit(c.env.DB, adminKeys.signinEmail(eref), LIMITS.adminSigninEmail),
    await hit(c.env.DB, adminKeys.signinIp(await ipRef(c.env, h)), LIMITS.adminSigninIp),
  ];
  const row = await c.env.DB.prepare(`SELECT ${ADMIN_COLS} FROM admin_users WHERE email = ?`)
    .bind(email)
    .first<AdminRow>();
  if (!byEmail.allowed || !byIp.allowed) {
    await audit(c, {
      action: "rate_limit.hit",
      meta: { scope: byEmail.allowed ? "admin_signin_ip" : "admin_signin_email" },
    });
    if (!byEmail.allowed && row && row.status === "active") await notifyPaused(c, row);
    return padded(c.env, started, paused(c, Math.max(byEmail.retryAfterSec, byIp.retryAfterSec)));
  }

  // Always one scrypt run, against a dummy hash when there is no account.
  const passwordOk = await verifyPassword(row?.password_hash ?? (await dummyHash(c.env)), password);
  const accessOk = c.get("accessEmail") === email;
  const good =
    row !== null &&
    passwordOk &&
    accessOk &&
    row.status === "active" &&
    row.totp_enrolled_at !== null &&
    (row.access_expires_at === null || row.access_expires_at > Math.floor(Date.now() / 1000));

  if (!good || !row) {
    await audit(c, {
      actor: row?.id ?? null,
      action: "admin.signin.failure",
      target: row ? row.id : `email:${eref}`,
    });
    if (row && passwordOk && !accessOk) {
      await audit(c, {
        actor: row.id,
        action: "admin.signin.access_mismatch",
        meta: { where: "sign-in" },
      });
    }
    // The failure that uses up the budget answers "paused" straight away, as the design shows.
    if (!byEmail.allowed || byEmail.count >= LIMITS.adminSigninEmail.limit) {
      if (row && row.status === "active") await notifyPaused(c, row);
      return padded(c.env, started, paused(c, byEmail.retryAfterSec));
    }
    return padded(
      c.env,
      started,
      c.json(authError("invalid_credentials", "Check your email and password and try again."), 401),
    );
  }

  // Password accepted: a pending session that can do nothing but submit the 2-step code.
  await c.env.DB.prepare("DELETE FROM admin_sessions WHERE admin_id = ? AND stage = 'mfa_pending'")
    .bind(row.id)
    .run();
  const pending = await createAdminSession(c.env, row.id, {
    stage: "mfa_pending",
    ip: clientIp(h),
    ua: c.req.header("user-agent"),
  });
  c.header("Set-Cookie", adminSessionCookie(pending.token, pending.maxAgeSeconds));
  return padded(c.env, started, c.json({ status: "mfa_required" as const }));
});

// Step 2 of 2: authenticator code or backup code. Rotates the pending session into a full one.
admin.post("/sign-in/mfa", async (c) => {
  const body = await parse(c, adminMfaSchema);
  if (!body) return invalidRequest(c);
  const found = await loadAdminSession(c.env, adminTokenFrom(c.req.raw.headers), "mfa_pending");
  if (!found || found.admin.email !== c.get("accessEmail")) {
    return c.json(authError("unauthorized", "Sign in to continue."), 401);
  }
  const a = await c.env.DB.prepare(`SELECT ${ADMIN_COLS} FROM admin_users WHERE id = ?`)
    .bind(found.admin.id)
    .first<AdminRow>();
  if (!a) return c.json(authError("unauthorized", "Sign in to continue."), 401);

  const blocked = await secondFactorGate(c, a.id);
  if (blocked) return blocked;

  const result = await checkSecondFactor(c.env, a, body.code);
  if (!result.ok) {
    await audit(c, { actor: a.id, action: "admin.mfa.failure" });
    const stop = await secondFactorFailed(c, a);
    if (stop) {
      await deleteAdminSession(c.env, found.session.id); // back to the password step
      return stop;
    }
    return c.json(
      authError("invalid_code", "That code didn’t work. Check the app and try again."),
      401,
    );
  }

  await deleteAdminSession(c.env, found.session.id);
  const session = await createAdminSession(c.env, a.id, {
    stage: "active",
    ip: clientIp(c.req.raw.headers),
    ua: c.req.header("user-agent"),
    reauthNow: true,
  });
  await clear(c.env.DB, adminKeys.mfa(a.id));
  await clear(c.env.DB, adminKeys.mfaWait(a.id));
  await clear(c.env.DB, adminKeys.signinEmail(await emailRef(c.env.BETTER_AUTH_SECRET, a.email)));
  await c.env.DB.prepare("UPDATE admin_users SET last_signin_at = unixepoch() WHERE id = ?")
    .bind(a.id)
    .run();
  await audit(c, { actor: a.id, action: "admin.mfa.success", meta: { via: result.via } });
  if (result.via === "backup") await audit(c, { actor: a.id, action: "admin.backup_code.used" });
  await audit(c, { actor: a.id, action: "admin.signin.success" });

  const fresh = await loadAdminSession(c.env, session.token, "active");
  c.header("Set-Cookie", adminSessionCookie(session.token, session.maxAgeSeconds));
  return c.json({
    admin: await buildMe(c.env, found.admin, fresh?.session ?? found.session),
    backupCodesRemaining: await remainingBackupCodes(c.env.DB, a.id),
  });
});

admin.post("/sign-out", async (c) => {
  const token = adminTokenFrom(c.req.raw.headers);
  if (token) {
    const hash = await hashSessionToken(token);
    const row = await c.env.DB.prepare(
      "SELECT id, admin_id FROM admin_sessions WHERE token_hash = ?",
    )
      .bind(hash)
      .first<{ id: string; admin_id: string }>();
    if (row) {
      await deleteAdminSession(c.env, row.id);
      await audit(c, { actor: row.admin_id, action: "admin.signout" });
    }
  }
  c.header("Set-Cookie", expiredAdminSessionCookie());
  return c.json({ ok: true });
});

// --- session-bound routes --------------------------------------------------------------------
admin.get("/me", requireAdminSession, async (c) =>
  c.json(await buildMe(c.env, c.get("admin"), c.get("adminSession"))),
);

// Step-up (spec 6.2): the account password and a fresh 2-step code; sets last_reauth_at.
admin.post("/reauth", requireAdminSession, async (c) => {
  const body = await parse(c, adminReauthSchema);
  if (!body) return invalidRequest(c);
  const me = c.get("admin");
  const a = await c.env.DB.prepare(`SELECT ${ADMIN_COLS} FROM admin_users WHERE id = ?`)
    .bind(me.id)
    .first<AdminRow>();
  if (!a) return c.json(authError("unauthorized", "Sign in to continue."), 401);

  const blocked = await secondFactorGate(c, a.id);
  if (blocked) return blocked;

  const passwordOk = await verifyPassword(
    a.password_hash ?? (await dummyHash(c.env)),
    body.password,
  );
  const factor = passwordOk
    ? await checkSecondFactor(c.env, a, body.code)
    : ({ ok: false } as const);
  if (!passwordOk || !factor.ok) {
    await audit(c, { actor: a.id, action: "admin.reauth.failure" });
    const stop = await secondFactorFailed(c, a);
    if (stop) {
      // Paused: end the session too, so a hijacked cookie cannot keep guessing.
      await deleteAdminSession(c.env, c.get("adminSession").id);
      return stop;
    }
    return c.json(
      authError("reauth_failed", "That didn’t match. Check your password and code."),
      401,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare("UPDATE admin_sessions SET last_reauth_at = ? WHERE id = ?")
    .bind(now, c.get("adminSession").id)
    .run();
  await clear(c.env.DB, adminKeys.mfa(a.id));
  await clear(c.env.DB, adminKeys.mfaWait(a.id));
  await audit(c, { actor: a.id, action: "admin.reauth.success" });
  return c.json({ lastReauthAt: now });
});

// Password change: needs step-up. Every session of this admin, this one included, is revoked.
admin.post("/password", requireAdminSession, requireFreshAuth(), async (c) => {
  const body = await parse(c, adminChangePasswordSchema);
  if (!body) return invalidRequest(c);
  const me = c.get("admin");
  const a = await c.env.DB.prepare("SELECT password_hash FROM admin_users WHERE id = ?")
    .bind(me.id)
    .first<{ password_hash: string | null }>();
  if (!a?.password_hash || !(await verifyPassword(a.password_hash, body.currentPassword))) {
    await audit(c, {
      actor: me.id,
      action: "admin.reauth.failure",
      meta: { where: "password_change" },
    });
    return c.json(authError("reauth_failed", "That didn’t match. Check your password."), 401);
  }
  const problem = await checkNewPassword(c.env, body.newPassword);
  if (problem) {
    return c.json(
      authError(problem, PASSWORD_MESSAGES[problem] ?? "Choose a different password."),
      400,
    );
  }
  await c.env.DB.prepare(
    "UPDATE admin_users SET password_hash = ?, updated_at = unixepoch() WHERE id = ?",
  )
    .bind(await hashPassword(body.newPassword, scryptParams(c.env)), me.id)
    .run();
  await audit(c, { actor: me.id, action: "admin.password.set", meta: { via: "change" } });
  await revokeAdminSessions(c.env, me.id, { actor: me.id, reason: "password_changed" });
  c.header("Set-Cookie", expiredAdminSessionCookie());
  return c.json({ ok: true });
});

// --- invite flow (design: accept an invite) --------------------------------------------------
// The token in the emailed link is the credential for all three calls. Every call also needs the
// Access identity to be the invited address, so another identity gets invite_invalid.
const maskEmail = (email: string) => {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
};

async function inviteGate(c: C, token: string) {
  const ip = await hit(
    c.env.DB,
    adminKeys.invite(await ipRef(c.env, c.req.raw.headers)),
    LIMITS.adminInviteIp,
  );
  if (!ip.allowed) {
    await audit(c, { action: "rate_limit.hit", meta: { scope: "admin_invite" } });
    return { response: paused(c, ip.retryAfterSec) } as const;
  }
  const state = await resolveInvite(c.env, token);
  const invalid = () => {
    return c.json(authError("invite_invalid", "This invite isn’t valid."), 400);
  };
  if (state.state === "invalid") {
    await audit(c, { action: "admin.invite.invalid", meta: { reason: "token" } });
    return { response: invalid() } as const;
  }
  if (state.invite.email !== c.get("accessEmail")) {
    await audit(c, { action: "admin.invite.invalid", meta: { reason: "access_mismatch" } });
    return { response: invalid() } as const;
  }
  if (state.state !== "ok") {
    const by = state.invite.created_by
      ? await c.env.DB.prepare("SELECT name FROM admin_users WHERE id = ?")
          .bind(state.invite.created_by)
          .first<{ name: string }>()
      : null;
    return {
      response: c.json(
        {
          ...authError(
            state.state === "expired" ? "invite_expired" : "invite_cancelled",
            state.state === "expired" ? "This invite has expired." : "This invite was cancelled.",
          ),
          invitedBy: by?.name ?? null,
          invitedAt: state.invite.created_at,
        },
        400,
      ),
    } as const;
  }
  return { invite: state.invite } as const;
}

admin.get("/invite/check", async (c) => {
  const gate = await inviteGate(c, c.req.query("token") ?? "");
  if ("response" in gate) return gate.response;
  const role = await c.env.DB.prepare("SELECT name FROM admin_roles WHERE id = ?")
    .bind(gate.invite.role_id)
    .first<{ name: string }>();
  return c.json({
    status: "ok" as const,
    emailHint: maskEmail(gate.invite.email),
    role: role?.name ?? "",
    expiresAt: gate.invite.expires_at,
  });
});

// Step 1: choose a password. Starts (or restarts) enrolment and returns the authenticator secret.
admin.post("/invite/accept", async (c) => {
  const body = await parse(c, adminInviteAcceptSchema);
  if (!body) return invalidRequest(c);
  const gate = await inviteGate(c, body.token);
  if ("response" in gate) return gate.response;
  const problem = await checkNewPassword(c.env, body.password);
  if (problem) {
    return c.json(
      authError(problem, PASSWORD_MESSAGES[problem] ?? "Choose a different password."),
      400,
    );
  }
  const adminId = gate.invite.admin_id;
  const secret = generateTotpSecret();
  await c.env.DB.prepare(
    "UPDATE admin_users SET password_hash = ?, totp_pending_enc = ?, name = COALESCE(?, name), updated_at = unixepoch() WHERE id = ? AND status = 'invited'",
  )
    .bind(
      await hashPassword(body.password, scryptParams(c.env)),
      await encryptTotpSecret(c.env, adminId, secret),
      body.name ?? null,
      adminId,
    )
    .run();
  await audit(c, { actor: adminId, action: "admin.password.set" });
  return c.json({
    step: "mfa" as const,
    otpauthUri: otpauthUri(secret, gate.invite.email),
    secretKey: formatSecretKey(secret),
  });
});

// Step 2 and 3: confirm the first authenticator code. That consumes the invite, activates the
// account, stores 10 hashed backup codes, returns them ONCE and starts the session.
admin.post("/invite/enrol", async (c) => {
  const body = await parse(c, adminInviteEnrolSchema);
  if (!body) return invalidRequest(c);
  const gate = await inviteGate(c, body.token);
  if ("response" in gate) return gate.response;
  const adminId = gate.invite.admin_id;
  const a = await c.env.DB.prepare(`SELECT ${ADMIN_COLS} FROM admin_users WHERE id = ?`)
    .bind(adminId)
    .first<AdminRow>();
  if (!a || a.status !== "invited" || !a.password_hash || !a.totp_pending_enc) {
    // Password step not done (or restarted): nothing to confirm yet.
    return c.json(authError("enrolment_not_started", "Set a password first."), 409);
  }
  const blocked = await secondFactorGate(c, a.id);
  if (blocked) return blocked;

  const secret = await decryptTotpSecret(c.env, a.id, a.totp_pending_enc);
  const step = secret ? await verifyTotp(secret, body.code, Math.floor(Date.now() / 1000)) : null;
  if (step === null) {
    await audit(c, { actor: a.id, action: "admin.mfa.failure", meta: { phase: "enrol" } });
    const stop = await secondFactorFailed(c, { ...a, status: "invited" });
    return (
      stop ??
      c.json(authError("invalid_code", "That code didn’t work. Check the app and try again."), 401)
    );
  }

  // Single use: claim the invite before acting on it.
  const claimed = await c.env.DB.prepare(
    "UPDATE admin_invites SET used_at = unixepoch() WHERE id = ? AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > unixepoch()",
  )
    .bind(gate.invite.id)
    .run();
  if (!claimed.meta.changes)
    return c.json(authError("invite_invalid", "This invite isn’t valid."), 400);

  const codes = generateBackupCodes();
  const hashes = await Promise.all(
    codes.map((code) => hashBackupCode(c.env, a.id, normaliseBackupCode(code) as string)),
  );
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE admin_users SET status = 'active', totp_secret_enc = totp_pending_enc, totp_pending_enc = NULL,
         totp_enrolled_at = unixepoch(), totp_last_step = ?, last_signin_at = unixepoch(), updated_at = unixepoch()
       WHERE id = ?`,
    ).bind(step, a.id),
    c.env.DB.prepare("DELETE FROM admin_backup_codes WHERE admin_id = ?").bind(a.id),
    ...hashes.map((hash) =>
      c.env.DB.prepare(
        "INSERT INTO admin_backup_codes (id, admin_id, code_hash) VALUES (?, ?, ?)",
      ).bind(crypto.randomUUID(), a.id, hash),
    ),
  ]);
  await clear(c.env.DB, adminKeys.mfa(a.id));
  await clear(c.env.DB, adminKeys.mfaWait(a.id));
  await audit(c, { actor: a.id, action: "admin.mfa.enrolled" });
  await audit(c, {
    actor: a.id,
    action: "admin.invite.accepted",
    meta: { inviteId: gate.invite.id },
  });

  const session = await createAdminSession(c.env, a.id, {
    stage: "active",
    ip: clientIp(c.req.raw.headers),
    ua: c.req.header("user-agent"),
    reauthNow: true,
  });
  const loaded = await loadAdminSession(c.env, session.token, "active");
  c.header("Set-Cookie", adminSessionCookie(session.token, session.maxAgeSeconds));
  if (!loaded) return c.json(authError("unauthorized", "Sign in to continue."), 401);
  return c.json({ admin: await buildMe(c.env, loaded.admin, loaded.session), backupCodes: codes });
});

// --- team: invite and remove live here; everything else is in routes/admin-team.ts ---------------
admin.post("/team/invite", requireAdmin("admin_team", "manage"), requireFreshAuth(), async (c) => {
  const body = await parse(c, adminTeamInviteSchema);
  if (!body) return invalidRequest(c);
  try {
    const invite = await issueAdminInvite(c.env, {
      email: body.email,
      roleId: body.roleId,
      name: body.name,
      createdBy: c.get("admin").id,
    });
    return c.json(
      {
        invite: {
          id: invite.id,
          email: body.email,
          roleId: body.roleId,
          expiresAt: invite.expiresAt,
        },
      },
      201,
    );
  } catch (err) {
    if (err instanceof InviteError) {
      return err.code === "role_not_found"
        ? c.json(authError("role_not_found", "That role doesn’t exist."), 404)
        : c.json(authError("admin_exists", "That person is already an admin."), 409);
    }
    throw err;
  }
});

admin.delete("/team/:id", requireAdmin("admin_team", "manage"), requireFreshAuth(), async (c) => {
  const id = c.req.param("id");
  const actor = c.get("admin");
  if (id.length > 64) return c.json(authError("not_found", "Admin not found."), 404);
  const target = await c.env.DB.prepare("SELECT id, role_id, status FROM admin_users WHERE id = ?")
    .bind(id)
    .first<{ id: string; role_id: string; status: string }>();
  if (!target) return c.json(authError("not_found", "Admin not found."), 404);
  if (target.id === actor.id) {
    return c.json(authError("cannot_remove_self", "You can’t remove your own account."), 400);
  }
  if (target.role_id === SUPER_ADMIN_ROLE && target.status === "active") {
    const others = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM admin_users WHERE role_id = ? AND status = 'active' AND id <> ?",
    )
      .bind(SUPER_ADMIN_ROLE, id)
      .first<{ n: number }>();
    if (!others?.n) {
      return c.json(authError("last_super_admin", "There must be at least one Super admin."), 409);
    }
  }
  // Sessions first (immediate revocation), then the account; invites, backup codes cascade.
  await revokeAdminSessions(c.env, id, { actor: actor.id, reason: "removed" });
  // Invites they sent stop working (design: "invites they sent are cancelled").
  await c.env.DB.prepare(
    "UPDATE admin_invites SET cancelled_at = unixepoch() WHERE created_by = ? AND used_at IS NULL AND cancelled_at IS NULL",
  )
    .bind(id)
    .run();
  await audit(c, {
    actor: actor.id,
    action: "admin.removed",
    target: id,
    meta: { before: `role:${target.role_id}`, after: "removed" },
  });
  await c.env.DB.prepare("DELETE FROM admin_users WHERE id = ?").bind(id).run();
  return c.json({ removed: true });
});

export type { AccessEnv };
