import type { Bindings } from "../env";
import { hashSessionToken } from "./session-hash";
import { toHex, truncateIp } from "./util";

// Lock 2 sessions (SECURITY-AUTH.md section 3, admin column). A separate table and a separate
// cookie from learners: a learner session can never authorise an admin route and vice versa.
//   - cookie  __Host-ms_admin_session, HttpOnly; Secure; SameSite=Lax; Path=/, no Domain
//   - token   32 random bytes; the database keeps only "sha256:<hex>" (same hashing as learners)
//   - idle    30 minutes, sliding (the deadline is pushed forward at most once a minute, so the
//             effective idle timeout is 30 to 31 minutes), absolute cap 12 hours from sign-in
//   - stage   "mfa_pending" (password accepted, code not yet given) lives 10 minutes and authorises
//             only POST /api/admin/sign-in/mfa
export const ADMIN_SESSION_COOKIE = "__Host-ms_admin_session";
export const ADMIN_IDLE_SECONDS = 30 * 60;
export const ADMIN_ABSOLUTE_SECONDS = 12 * 3600;
export const ADMIN_PENDING_SECONDS = 10 * 60;
export const ADMIN_FRESH_AUTH_SECONDS = 300;
const SLIDE_AFTER_SECONDS = 60;

export type AdminStage = "mfa_pending" | "active";

export type AdminSession = {
  id: string;
  adminId: string;
  stage: AdminStage;
  createdAt: number;
  expiresAt: number;
  absoluteExpiresAt: number;
  lastReauthAt: number | null;
};

export type AdminAccount = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  mfaEnrolled: boolean;
  /** Unix seconds when temporary access ends; null = permanent. */
  accessExpiresAt: number | null;
};

const nowSec = () => Math.floor(Date.now() / 1000);

export const adminSessionCookie = (token: string, maxAgeSeconds: number) =>
  `${ADMIN_SESSION_COOKIE}=${token}; Max-Age=${maxAgeSeconds}; Path=/; Secure; HttpOnly; SameSite=Lax`;
export const expiredAdminSessionCookie = () =>
  `${ADMIN_SESSION_COOKIE}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`;

export function adminTokenFrom(headers: Headers): string | null {
  const cookie = headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ADMIN_SESSION_COOKIE) return rest.join("=") || null;
  }
  return null;
}

export async function createAdminSession(
  env: Pick<Bindings, "DB">,
  adminId: string,
  opts: { stage: AdminStage; ip?: string | null; ua?: string | null; reauthNow?: boolean },
): Promise<{ token: string; id: string; maxAgeSeconds: number }> {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const id = crypto.randomUUID();
  const now = nowSec();
  const idle = opts.stage === "active" ? ADMIN_IDLE_SECONDS : ADMIN_PENDING_SECONDS;
  await env.DB.prepare(
    `INSERT INTO admin_sessions
       (id, admin_id, token_hash, stage, created_at, last_seen_at, expires_at, absolute_expires_at, last_reauth_at, ip, ua)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      adminId,
      await hashSessionToken(token),
      opts.stage,
      now,
      now,
      now + idle,
      now + ADMIN_ABSOLUTE_SECONDS,
      opts.reauthNow ? now : null,
      truncateIp(opts.ip) || null,
      opts.ua ? opts.ua.slice(0, 200) : null,
    )
    .run();
  return { token, id, maxAgeSeconds: idle };
}

type Row = {
  id: string;
  admin_id: string;
  stage: AdminStage;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  absolute_expires_at: number;
  last_reauth_at: number | null;
  email: string;
  name: string;
  role_id: string;
  role_name: string;
  status: string;
  totp_enrolled_at: number | null;
  access_expires_at: number | null;
};

/**
 * Looks a session up by its cookie token. Returns null for an unknown, expired (idle or absolute)
 * or wrong-stage session, or when the admin is no longer active; expired rows are deleted. The
 * idle deadline slides on use.
 */
export async function loadAdminSession(
  env: Pick<Bindings, "DB">,
  token: string | null,
  stage: AdminStage,
): Promise<{ session: AdminSession; admin: AdminAccount } | null> {
  if (!token || token.length > 128) return null;
  const row = await env.DB.prepare(
    `SELECT s.id, s.admin_id, s.stage, s.created_at, s.last_seen_at, s.expires_at,
            s.absolute_expires_at, s.last_reauth_at,
            u.email, u.name, u.role_id, u.status, u.totp_enrolled_at, u.access_expires_at, r.name AS role_name
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.admin_id
       JOIN admin_roles r ON r.id = u.role_id
      WHERE s.token_hash = ?`,
  )
    .bind(await hashSessionToken(token))
    .first<Row>();
  if (!row) return null;
  const now = nowSec();
  // Temporary access: past its end date the admin has no session, whatever the cookie says.
  const accessEnded = row.access_expires_at !== null && row.access_expires_at <= now;
  if (
    row.expires_at <= now ||
    row.absolute_expires_at <= now ||
    row.status !== "active" ||
    accessEnded
  ) {
    await env.DB.prepare("DELETE FROM admin_sessions WHERE id = ?").bind(row.id).run();
    return null;
  }
  if (row.stage !== stage) return null; // a pending session is not an active one, and vice versa

  let expiresAt = row.expires_at;
  if (stage === "active" && now - row.last_seen_at >= SLIDE_AFTER_SECONDS) {
    expiresAt = Math.min(now + ADMIN_IDLE_SECONDS, row.absolute_expires_at);
    await env.DB.prepare("UPDATE admin_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?")
      .bind(now, expiresAt, row.id)
      .run();
  }
  return {
    session: {
      id: row.id,
      adminId: row.admin_id,
      stage: row.stage,
      createdAt: row.created_at,
      expiresAt,
      absoluteExpiresAt: row.absolute_expires_at,
      lastReauthAt: row.last_reauth_at,
    },
    admin: {
      id: row.admin_id,
      email: row.email,
      name: row.name,
      roleId: row.role_id,
      roleName: row.role_name,
      mfaEnrolled: row.totp_enrolled_at !== null,
      accessExpiresAt: row.access_expires_at,
    },
  };
}

export async function deleteAdminSession(env: Pick<Bindings, "DB">, id: string): Promise<void> {
  await env.DB.prepare("DELETE FROM admin_sessions WHERE id = ?").bind(id).run();
}
