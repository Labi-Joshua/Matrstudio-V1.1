import type { Bindings } from "../env";
import { toHex } from "./util";

// Secret handling for admin authentication: TOTP secrets are AES-GCM encrypted at rest, backup
// codes are keyed hashes, invite tokens are signed values. Nothing here logs.
const enc = new TextEncoder();

const b64u = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const fromB64u = (s: string): Uint8Array =>
  Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));

/** ADMIN_TOTP_KEY when set (so it can be rotated apart from the session secret), else BETTER_AUTH_SECRET. */
const keyMaterial = (env: Pick<Bindings, "ADMIN_TOTP_KEY" | "BETTER_AUTH_SECRET">) =>
  env.ADMIN_TOTP_KEY || env.BETTER_AUTH_SECRET;

async function aesKey(env: Pick<Bindings, "ADMIN_TOTP_KEY" | "BETTER_AUTH_SECRET">) {
  const base = await crypto.subtle.importKey("raw", enc.encode(keyMaterial(env)), "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode("matr-studio-admin"),
      info: enc.encode("admin-totp-secret-v1"),
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** "v1.<iv>.<ciphertext>". The admin id is authenticated data, so a ciphertext cannot be moved to another row. */
export async function encryptTotpSecret(
  env: Pick<Bindings, "ADMIN_TOTP_KEY" | "BETTER_AUTH_SECRET">,
  adminId: string,
  secret: Uint8Array,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(adminId) },
      await aesKey(env),
      secret as BufferSource,
    ),
  );
  return `v1.${b64u(iv)}.${b64u(ct)}`;
}

export async function decryptTotpSecret(
  env: Pick<Bindings, "ADMIN_TOTP_KEY" | "BETTER_AUTH_SECRET">,
  adminId: string,
  stored: string,
): Promise<Uint8Array | null> {
  try {
    const [v, iv, ct] = stored.split(".");
    if (v !== "v1" || !iv || !ct) return null;
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromB64u(iv) as BufferSource, additionalData: enc.encode(adminId) },
        await aesKey(env),
        fromB64u(ct) as BufferSource,
      ),
    );
  } catch {
    return null;
  }
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

// --- Backup codes ----------------------------------------------------------------------------
// 10 codes of 10 characters (about 50 bits each), shown once as "xxxxx-xxxxx". Only a keyed hash is
// stored, so a database read does not give offline-guessable codes.
export const BACKUP_CODE_COUNT = 10;
const BACKUP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i

export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = crypto.getRandomValues(new Uint8Array(10));
    const chars = Array.from(raw, (b) => BACKUP_ALPHABET[b % BACKUP_ALPHABET.length]).join("");
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

/** Lower-case, no spaces or dashes. Returns null when the input cannot be a backup code. */
export function normaliseBackupCode(input: string): string | null {
  const v = input.toLowerCase().replace(/[\s-]/g, "");
  return /^[a-z0-9]{10}$/.test(v) ? v : null;
}

export async function hashBackupCode(
  env: Pick<Bindings, "BETTER_AUTH_SECRET">,
  adminId: string,
  normalised: string,
): Promise<string> {
  return toHex(await hmac(env.BETTER_AUTH_SECRET, `admin-backup:${adminId}:${normalised}`));
}

// --- Invite tokens ---------------------------------------------------------------------------
// token = <invite id>.<32 random bytes hex>.<HMAC-SHA256 signature>. The signature lets us tell a
// token we issued (which may learn "expired" or "cancelled") from garbage (always "invalid").
// The database stores only SHA-256(token).
export async function signInviteToken(
  env: Pick<Bindings, "BETTER_AUTH_SECRET">,
  inviteId: string,
): Promise<string> {
  const rand = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const sig = b64u(await hmac(env.BETTER_AUTH_SECRET, `admin-invite:${inviteId}.${rand}`));
  return `${inviteId}.${rand}.${sig}`;
}

/** The invite id inside a correctly signed token, or null (bad format or bad signature). */
export async function verifyInviteToken(
  env: Pick<Bindings, "BETTER_AUTH_SECRET">,
  token: string,
): Promise<string | null> {
  if (token.length > 300) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, rand, sig] = parts as [string, string, string];
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f]{64}$/.test(rand)) return null;
  const expected = await hmac(env.BETTER_AUTH_SECRET, `admin-invite:${id}.${rand}`);
  let given: Uint8Array;
  try {
    given = fromB64u(sig);
  } catch {
    return null;
  }
  if (given.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= (given[i] as number) ^ (expected[i] as number);
  return diff === 0 ? id : null;
}
