import type { Bindings } from "../env";
import { enqueueAuthEmail } from "../queue/auth-email";
import { revokeAdminSessions, SUPER_ADMIN_ROLE } from "./admin-perms";
import { signInviteToken, verifyInviteToken } from "./admin-secrets";
import { writeAudit } from "./audit";
import { emailRef, sha256Hex } from "./util";

export const ADMIN_INVITE_TTL_SECONDS = 72 * 3600;
export const DEFAULT_ADMIN_URL = "https://admin.matrstudio.com";

/** The admin app origin. Emailed links are built on this and never on anything a request sent. */
export const adminOrigin = (env: Pick<Bindings, "PUBLIC_ADMIN_URL">) =>
  new URL(env.PUBLIC_ADMIN_URL || DEFAULT_ADMIN_URL).origin;

const nowSec = () => Math.floor(Date.now() / 1000);

const nameFromEmail = (email: string) => (email.split("@")[0] ?? "Admin").slice(0, 60) || "Admin";

export class InviteError extends Error {
  constructor(public readonly code: "role_not_found" | "admin_exists") {
    super(code);
  }
}

/**
 * Issues an admin invite. Internal (no admin UI yet) apart from POST /api/admin/team/invite.
 * Single use, 72 hours, bound to `email`; the token is a signed value and only its SHA-256 is
 * stored. A pending admin account (status "invited", no sign-in possible) is created for the
 * address; inviting an address that is already pending replaces its earlier invites. An address
 * that is already an active or suspended admin is refused ("admin_exists").
 * The link is emailed through the queue and also returned (once) for scripts and tests.
 */
export async function issueAdminInvite(
  env: Bindings,
  input: { email: string; roleId: string; createdBy?: string | null; name?: string },
): Promise<{ id: string; adminId: string; token: string; link: string; expiresAt: number }> {
  const email = input.email.trim().toLowerCase();
  const role = await env.DB.prepare("SELECT id, name FROM admin_roles WHERE id = ?")
    .bind(input.roleId)
    .first<{ id: string; name: string }>();
  if (!role) throw new InviteError("role_not_found");

  const existing = await env.DB.prepare("SELECT id, status FROM admin_users WHERE email = ?")
    .bind(email)
    .first<{ id: string; status: string }>();
  if (existing && existing.status !== "invited") throw new InviteError("admin_exists");

  const adminId = existing?.id ?? crypto.randomUUID();
  const inviteId = crypto.randomUUID();
  const token = await signInviteToken(env, inviteId);
  const expiresAt = nowSec() + ADMIN_INVITE_TTL_SECONDS;
  const createdBy = input.createdBy ?? null;

  const stmts = [];
  if (existing) {
    // Re-invite: the new invite replaces any still-live one, and the half-finished setup restarts.
    stmts.push(
      env.DB.prepare(
        "UPDATE admin_invites SET cancelled_at = unixepoch() WHERE admin_id = ? AND used_at IS NULL AND cancelled_at IS NULL",
      ).bind(adminId),
      env.DB.prepare(
        "UPDATE admin_users SET role_id = ?, password_hash = NULL, totp_pending_enc = NULL, updated_at = unixepoch() WHERE id = ?",
      ).bind(role.id, adminId),
    );
  } else {
    stmts.push(
      env.DB.prepare(
        "INSERT INTO admin_users (id, email, name, role_id, status, created_by) VALUES (?, ?, ?, ?, 'invited', ?)",
      ).bind(
        adminId,
        email,
        (input.name?.trim() || nameFromEmail(email)).slice(0, 80),
        role.id,
        createdBy,
      ),
    );
  }
  stmts.push(
    env.DB.prepare(
      "INSERT INTO admin_invites (id, email, role_id, admin_id, token_hash, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(inviteId, email, role.id, adminId, await sha256Hex(token), createdBy, expiresAt),
  );
  await env.DB.batch(stmts);

  await writeAudit(env.DB, {
    actor: createdBy,
    action: "admin.invite.created",
    target: adminId,
    meta: { inviteId, role: role.id },
  });

  const link = `${adminOrigin(env)}/accept-invite?token=${token}`;
  const inviter = createdBy
    ? await env.DB.prepare("SELECT name FROM admin_users WHERE id = ?")
        .bind(createdBy)
        .first<{ name: string }>()
    : null;
  await enqueueAuthEmail(env, {
    type: "admin-invite",
    to: email,
    link,
    invitedBy: inviter?.name ?? null,
    role: role.name,
  });
  return { id: inviteId, adminId, token, link, expiresAt };
}

/** Cancels a live invite. True when one was cancelled. The pending account stays (it cannot sign in). */
export async function cancelAdminInvite(
  env: Bindings,
  input: { inviteId: string; actor?: string | null },
): Promise<boolean> {
  const res = await env.DB.prepare(
    "UPDATE admin_invites SET cancelled_at = unixepoch() WHERE id = ? AND used_at IS NULL AND cancelled_at IS NULL",
  )
    .bind(input.inviteId)
    .run();
  if (!res.meta.changes) return false;
  await writeAudit(env.DB, {
    actor: input.actor ?? null,
    action: "admin.invite.cancelled",
    target: input.inviteId,
  });
  return true;
}

export type InviteState =
  | { state: "ok"; invite: InviteRow }
  | { state: "expired" | "cancelled"; invite: InviteRow }
  | { state: "invalid" };

export type InviteRow = {
  id: string;
  email: string;
  role_id: string;
  admin_id: string;
  created_by: string | null;
  created_at: number;
  expires_at: number;
  used_at: number | null;
  cancelled_at: number | null;
};

/**
 * Resolves a token without consuming it. Garbage, forged, unknown and already-used tokens are all
 * "invalid"; "expired" and "cancelled" are only ever reported for a token whose signature is valid,
 * i.e. to someone we actually sent it to.
 */
export async function resolveInvite(env: Bindings, token: string): Promise<InviteState> {
  const id = await verifyInviteToken(env, token);
  if (!id) return { state: "invalid" };
  const row = await env.DB.prepare(
    `SELECT id, email, role_id, admin_id, created_by, created_at, expires_at, used_at, cancelled_at
       FROM admin_invites WHERE id = ? AND token_hash = ?`,
  )
    .bind(id, await sha256Hex(token))
    .first<InviteRow>();
  if (!row || row.used_at !== null) return { state: "invalid" };
  if (row.cancelled_at !== null) return { state: "cancelled", invite: row };
  if (row.expires_at <= nowSec()) return { state: "expired", invite: row };
  return { state: "ok", invite: row };
}

/**
 * First super admin. Driven by the secret ADMIN_BOOTSTRAP_EMAIL; there is no default account and no
 * password anywhere. It is called from the cron tick (src/index.ts) so it needs no open endpoint,
 * and from `wrangler dev --test-scheduled` locally. Idempotent:
 *   - ADMIN_BOOTSTRAP_EMAIL unset            -> "disabled" (no query at all)
 *   - an active or suspended super admin     -> "exists" (a no-op forever after the first one)
 *   - a live, unused invite for that address -> "pending" (no email spam)
 *   - otherwise                              -> a super_admin invite is issued ("invited")
 */
export async function bootstrapSuperAdmin(
  env: Bindings,
): Promise<"disabled" | "exists" | "pending" | "invited"> {
  const email = env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!email) return "disabled";
  const existing = await env.DB.prepare(
    "SELECT 1 AS x FROM admin_users WHERE role_id = ? AND status <> 'invited' LIMIT 1",
  )
    .bind(SUPER_ADMIN_ROLE)
    .first();
  if (existing) return "exists";
  const live = await env.DB.prepare(
    "SELECT 1 AS x FROM admin_invites WHERE email = ? AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > ? LIMIT 1",
  )
    .bind(email, nowSec())
    .first();
  if (live) return "pending";
  await issueAdminInvite(env, { email, roleId: SUPER_ADMIN_ROLE, createdBy: null });
  await writeAudit(env.DB, {
    action: "admin.bootstrap",
    target: `email:${await emailRef(env.BETTER_AUTH_SECRET, email)}`,
  });
  return "invited";
}

/**
 * MFA reset (a lost phone and no backup codes): clears the password, the authenticator secret and
 * the backup codes, signs the admin out everywhere, and sends a fresh invite so they set a password
 * and enrol again. Internal; the Admin team screen will call it (with step-up).
 */
export async function resetAdminMfa(
  env: Bindings,
  input: { adminId: string; actor: string },
): Promise<boolean> {
  const a = await env.DB.prepare("SELECT email, role_id FROM admin_users WHERE id = ?")
    .bind(input.adminId)
    .first<{ email: string; role_id: string }>();
  if (!a) return false;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE admin_users SET status = 'invited', password_hash = NULL, totp_secret_enc = NULL,
         totp_pending_enc = NULL, totp_enrolled_at = NULL, totp_last_step = 0, updated_at = unixepoch()
       WHERE id = ?`,
    ).bind(input.adminId),
    env.DB.prepare("DELETE FROM admin_backup_codes WHERE admin_id = ?").bind(input.adminId),
  ]);
  await revokeAdminSessions(env, input.adminId, { actor: input.actor, reason: "mfa_reset" });
  await writeAudit(env.DB, {
    actor: input.actor,
    action: "admin.mfa.reset",
    target: input.adminId,
  });
  await issueAdminInvite(env, { email: a.email, roleId: a.role_id, createdBy: input.actor });
  return true;
}
