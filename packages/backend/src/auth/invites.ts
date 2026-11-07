import type { Bindings } from "../env";
import { writeAudit } from "./audit";
import { emailRef, sha256Hex, toHex } from "./util";

export const INVITE_TTL_SECONDS = 72 * 3600;

/**
 * Issues a waitlist invite. Internal only (no route, no admin UI yet): call it from a script or a
 * future admin handler. The token is returned once and only its SHA-256 is stored; it is bound to
 * the invited address and single use. The caller sends `link` to the person (an invite email
 * template is not designed yet). The address does not have to be in waitlist_subscribers, and that
 * table is never touched.
 */
export async function issueInvite(
  env: Bindings,
  input: { email: string; createdBy?: string },
): Promise<{ token: string; link: string; expiresAt: number }> {
  const email = input.email.trim().toLowerCase();
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = Math.floor(Date.now() / 1000) + INVITE_TTL_SECONDS;
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO invites (id, email, token_hash, created_by, expires_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, email, await sha256Hex(token), input.createdBy ?? null, expiresAt)
    .run();
  await writeAudit(env.DB, {
    actor: input.createdBy ?? null,
    action: "invite.created",
    target: `email:${await emailRef(env.BETTER_AUTH_SECRET, email)}`,
    meta: { inviteId: id },
  });
  return {
    token,
    link: `${new URL(env.PUBLIC_WEB_URL).origin}/invite?token=${token}`,
    expiresAt,
  };
}
