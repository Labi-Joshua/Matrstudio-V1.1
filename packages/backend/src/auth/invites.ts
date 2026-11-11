import type { Bindings } from "../env";
import { writeAudit } from "./audit";
import { emailRef, sha256Hex, toHex } from "./util";

export const INVITE_TTL_SECONDS = 72 * 3600;
/** Waitlist invites sent from the admin portal last 14 days (the design says so). */
export const WAITLIST_INVITE_TTL_SECONDS = 14 * 24 * 3600;

export type InviteInput = { email: string; createdBy?: string; ttlSeconds?: number };
export type PreparedInvite = {
  id: string;
  token: string;
  link: string;
  expiresAt: number;
  /** The INSERT, to run alone or inside a batch with other statements. */
  statement: D1PreparedStatement;
  email: string;
};

/**
 * Builds an invite without running it, so many can go in one D1 batch (waitlist batches). The
 * token is returned once and only its SHA-256 is stored; it is bound to the invited address and
 * single use. The address does not have to be in waitlist_subscribers.
 */
export async function prepareInvite(env: Bindings, input: InviteInput): Promise<PreparedInvite> {
  const email = input.email.trim().toLowerCase();
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? INVITE_TTL_SECONDS);
  const id = crypto.randomUUID();
  return {
    id,
    token,
    email,
    expiresAt,
    link: `${new URL(env.PUBLIC_WEB_URL).origin}/invite?token=${token}`,
    statement: env.DB.prepare(
      "INSERT INTO invites (id, email, token_hash, created_by, expires_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(id, email, await sha256Hex(token), input.createdBy ?? null, expiresAt),
  };
}

/**
 * Issues one waitlist invite and audits it. Used by the admin waitlist routes (which batch the
 * inserts through prepareInvite) and available to scripts. The caller sends `link` to the person.
 */
export async function issueInvite(
  env: Bindings,
  input: InviteInput,
): Promise<{ token: string; link: string; expiresAt: number }> {
  const p = await prepareInvite(env, input);
  await p.statement.run();
  await writeAudit(env.DB, {
    actor: input.createdBy ?? null,
    action: "invite.created",
    target: `email:${await emailRef(env.BETTER_AUTH_SECRET, p.email)}`,
    meta: { inviteId: p.id },
  });
  return { token: p.token, link: p.link, expiresAt: p.expiresAt };
}
