// Stateless, HMAC-signed verification tokens: no DB row to write or read until the user clicks the link.
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64u = {
  encode(bytes: Uint8Array): string {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  },
  decode(str: string): Uint8Array {
    const pad = "=".repeat((4 - (str.length % 4)) % 4);
    const bin = atob(str.replaceAll("-", "+").replaceAll("_", "/") + pad);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  },
};

const importKey = (secret: string, usage: "sign" | "verify") =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    usage,
  ]);

/**
 * How long a confirmation link stays valid. The email copy states it too. Readers who miss it
 * can get a new link from the expired page or by signing up again.
 */
export const VERIFY_TTL_SECONDS = 24 * 3600;

export async function signVerifyToken(
  secret: string,
  email: string,
  ttlSeconds = VERIFY_TTL_SECONDS,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${b64u.encode(enc.encode(email))}.${exp}`;
  const sig = await crypto.subtle.sign(
    "HMAC",
    await importKey(secret, "sign"),
    enc.encode(payload),
  );
  return `${payload}.${b64u.encode(new Uint8Array(sig))}`;
}

export type VerifyTokenInfo = {
  email: string;
  /** Expiry, unix seconds. */
  exp: number;
  expired: boolean;
};

/**
 * Checks the signature and reads the token, expired or not, so the caller can tell an expired
 * link (offer a new one) from a broken or forged one (null).
 */
export async function readVerifyToken(
  secret: string,
  token: string,
): Promise<VerifyTokenInfo | null> {
  const [emailPart, expPart, sigPart] = token.split(".");
  if (!emailPart || !expPart || !sigPart) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await importKey(secret, "verify"),
      b64u.decode(sigPart),
      enc.encode(`${emailPart}.${expPart}`),
    );
    const exp = Number(expPart);
    if (!ok || !Number.isFinite(exp)) return null;
    return {
      email: dec.decode(b64u.decode(emailPart)),
      exp,
      expired: exp < Math.floor(Date.now() / 1000),
    };
  } catch {
    return null;
  }
}

/** Returns the email if the token is authentic and unexpired, otherwise null. */
export async function verifyVerifyToken(secret: string, token: string): Promise<string | null> {
  const info = await readVerifyToken(secret, token);
  return info && !info.expired ? info.email : null;
}
