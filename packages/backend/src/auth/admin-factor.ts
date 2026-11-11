import type { Bindings } from "../env";
import { decryptTotpSecret, hashBackupCode, normaliseBackupCode } from "./admin-secrets";
import { verifyTotp } from "./totp";

export type FactorResult = { ok: true; via: "totp" | "backup" } | { ok: false };

/**
 * Checks an authenticator code or a backup code for an active admin. A TOTP step is accepted once:
 * the matched step is stored with a conditional UPDATE, so two parallel requests with the same code
 * cannot both win. A backup code is spent with a conditional UPDATE as well.
 */
export async function checkSecondFactor(
  env: Bindings,
  a: { id: string; totp_secret_enc: string | null; totp_last_step: number },
  input: string,
): Promise<FactorResult> {
  const code = input.trim();
  if (/^\d{6}$/.test(code)) {
    if (!a.totp_secret_enc) return { ok: false };
    const secret = await decryptTotpSecret(env, a.id, a.totp_secret_enc);
    if (!secret) return { ok: false };
    const step = await verifyTotp(secret, code, Math.floor(Date.now() / 1000));
    if (step === null || step <= a.totp_last_step) return { ok: false };
    const res = await env.DB.prepare(
      "UPDATE admin_users SET totp_last_step = ? WHERE id = ? AND totp_last_step < ?",
    )
      .bind(step, a.id, step)
      .run();
    return res.meta.changes ? { ok: true, via: "totp" } : { ok: false };
  }
  const normalised = normaliseBackupCode(code);
  if (!normalised) return { ok: false };
  const res = await env.DB.prepare(
    "UPDATE admin_backup_codes SET used_at = unixepoch() WHERE admin_id = ? AND code_hash = ? AND used_at IS NULL",
  )
    .bind(a.id, await hashBackupCode(env, a.id, normalised))
    .run();
  return res.meta.changes ? { ok: true, via: "backup" } : { ok: false };
}
