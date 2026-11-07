import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Password hashing: scrypt through node:crypto (native and asynchronous, so it does not count
// against the Workers CPU limit; the pure-JS fallback Better Auth ships would). The stored string is
// self-describing, so parameters can be raised later and old hashes still verify:
//   scrypt$N=131072,r=8,p=1$<salt base64url>$<hash base64url>
export const SCRYPT_DEFAULTS = { N: 131072, r: 8, p: 1 } as const; // OWASP minimum for scrypt
const KEY_LEN = 32;
const SALT_LEN = 16;
const MAX_N = 2 ** 20;

export type ScryptParams = { N: number; r: number; p: number };

const b64u = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const fromB64u = (s: string): Uint8Array => {
  try {
    const bin = atob(s.replaceAll("-", "+").replaceAll("_", "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
};

function derive(
  password: string,
  salt: Uint8Array,
  { N, r, p }: ScryptParams,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    // maxmem must cover 128 * N * r bytes, plus headroom.
    const maxmem = 128 * N * r + 1024 * 1024;
    scrypt(password.normalize("NFKC"), salt, KEY_LEN, { N, r, p, maxmem }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(
  password: string,
  params: ScryptParams = SCRYPT_DEFAULTS,
): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await derive(password, salt, params);
  return `scrypt$N=${params.N},r=${params.r},p=${params.p}$${b64u(salt)}$${b64u(key)}`;
}

export function parseHash(
  stored: string,
): { params: ScryptParams; salt: Uint8Array; key: Uint8Array } | null {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return null;
  const kv = Object.fromEntries(
    (parts[1] ?? "").split(",").map((pair) => pair.split("=") as [string, string]),
  );
  const N = Number(kv.N);
  const r = Number(kv.r);
  const p = Number(kv.p);
  if (![N, r, p].every(Number.isInteger) || N < 2 || N > MAX_N || (N & (N - 1)) !== 0) return null;
  if (r < 1 || r > 32 || p < 1 || p > 16) return null;
  const salt = fromB64u(parts[2] ?? "");
  const key = fromB64u(parts[3] ?? "");
  if (salt.length < 8 || key.length < 16) return null;
  return { params: { N, r, p }, salt, key };
}

/** Constant-time comparison of the derived key. Unparseable hashes never verify. */
export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  const key = await derive(password, parsed.salt, parsed.params);
  return key.length === parsed.key.length && timingSafeEqual(key, parsed.key);
}

/** True when the stored hash uses weaker parameters than the current defaults. */
export function needsRehash(stored: string): boolean {
  const parsed = parseHash(stored);
  return !parsed || parsed.params.N < SCRYPT_DEFAULTS.N || parsed.params.r < SCRYPT_DEFAULTS.r;
}
