import type { Bindings } from "../env";
import { writeAudit } from "./audit";
import { clear } from "./limits";
import { emailRef } from "./util";

// Counter keys for admin sign-in throttling. Keys carry keyed hashes or admin ids, never raw emails.
export const adminKeys = {
  signinEmail: (eref: string) => `adm:si:e:${eref}`,
  signinIp: (ipref: string) => `adm:si:ip:${ipref}`,
  mfa: (adminId: string) => `adm:mfa:${adminId}`,
  mfaWait: (adminId: string) => `adm:mfa:wait:${adminId}`,
  notice: (adminId: string) => `adm:notice:${adminId}`,
  invite: (ipref: string) => `adm:inv:ip:${ipref}`,
};

/**
 * "Ask a Super admin to unlock it" (the sign-in paused screen): clears the sign-in and 2-step
 * counters for one admin. Internal for now; the Admin team screen will call it.
 */
export async function unlockAdmin(
  env: Bindings,
  input: { adminId: string; actor: string },
): Promise<boolean> {
  const row = await env.DB.prepare("SELECT email FROM admin_users WHERE id = ?")
    .bind(input.adminId)
    .first<{ email: string }>();
  if (!row) return false;
  const eref = await emailRef(env.BETTER_AUTH_SECRET, row.email);
  await clear(env.DB, adminKeys.signinEmail(eref));
  await clear(env.DB, adminKeys.mfa(input.adminId));
  await clear(env.DB, adminKeys.mfaWait(input.adminId));
  await clear(env.DB, adminKeys.notice(input.adminId));
  await writeAudit(env.DB, {
    actor: input.actor,
    action: "admin.unlocked",
    target: input.adminId,
  });
  return true;
}
