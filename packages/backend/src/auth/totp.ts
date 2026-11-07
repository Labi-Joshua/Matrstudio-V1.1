// TOTP (RFC 6238) over HOTP (RFC 4226), WebCrypto HMAC-SHA1, 6 digits, 30 s step. This is the
// authenticator-app code for admins. The module is pure (no I/O, no logging) and is tested against
// the RFC test vectors. Replay protection lives with the caller: verifyTotp returns the matched
// time-step, and the caller refuses any step <= the last one it accepted.
const enc = new TextEncoder();

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW = 1; // accept the previous, current and next step (clock drift)

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/[\s=-]/g, "").toUpperCase();
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

/** 160-bit secret, the size RFC 4226 recommends. */
export const generateTotpSecret = (): Uint8Array => crypto.getRandomValues(new Uint8Array(20));

async function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    secret as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setBigUint64(0, BigInt(counter));
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const offset = (mac[19] as number) & 0x0f;
  const bin =
    (((mac[offset] as number) & 0x7f) << 24) |
    (((mac[offset + 1] as number) & 0xff) << 16) |
    (((mac[offset + 2] as number) & 0xff) << 8) |
    ((mac[offset + 3] as number) & 0xff);
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const timeStep = (unixSeconds: number) => Math.floor(unixSeconds / TOTP_STEP_SECONDS);

/** The code for the time containing `unixSeconds`. `digits` is only for the 8-digit RFC vectors. */
export const totpAt = (secret: Uint8Array, unixSeconds: number, digits = TOTP_DIGITS) =>
  hotp(secret, timeStep(unixSeconds), digits);

/**
 * Checks a code against the window and returns the matched time-step, or null. Every step in the
 * window is compared (no early exit) and the comparison is constant-time per code.
 */
export async function verifyTotp(
  secret: Uint8Array,
  code: string,
  unixSeconds: number,
  window = TOTP_WINDOW,
): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const center = timeStep(unixSeconds);
  let matched: number | null = null;
  for (let step = center - window; step <= center + window; step++) {
    const expected = await hotp(secret, step);
    if (timingSafeEq(expected, code) && (matched === null || step > matched)) matched = step;
  }
  return matched;
}

function timingSafeEq(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] as number) ^ (y[i] as number);
  return diff === 0;
}

/** otpauth:// URI the authenticator app reads from the QR code. */
export function otpauthUri(secret: Uint8Array, account: string, issuer = "Matr Studio"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const q = new URLSearchParams({
    secret: base32Encode(secret),
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${q.toString()}`;
}

/** "JBSW Y3DP EHPK 3PXP" grouping the design shows under the QR code. */
export const formatSecretKey = (secret: Uint8Array) =>
  base32Encode(secret)
    .replace(/(.{4})/g, "$1 ")
    .trim();
