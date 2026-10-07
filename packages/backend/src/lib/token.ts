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

export async function signVerifyToken(
  secret: string,
  email: string,
  ttlSeconds = 7 * 24 * 3600,
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

/** Returns the email if the token is authentic and unexpired, otherwise null. */
export async function verifyVerifyToken(secret: string, token: string): Promise<string | null> {
  const [emailPart, expPart, sigPart] = token.split(".");
  if (!emailPart || !expPart || !sigPart) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await importKey(secret, "verify"),
      b64u.decode(sigPart),
      enc.encode(`${emailPart}.${expPart}`),
    );
    if (!ok || Number(expPart) < Math.floor(Date.now() / 1000)) return null;
    return dec.decode(b64u.decode(emailPart));
  } catch {
    return null;
  }
}
