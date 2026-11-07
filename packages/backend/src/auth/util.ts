// Small helpers shared by the auth modules. Nothing here logs.
const enc = new TextEncoder();

export function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "";
  for (const b of view) out += b.toString(16).padStart(2, "0");
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(input)));
}

/** Keyed hash used to reference an email in audit rows and rate-limit keys without storing it. */
export async function emailRef(secret: string, email: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`email:${email.trim().toLowerCase()}`),
  );
  return toHex(sig).slice(0, 24);
}

/** IPv4 -> a.b.c.0, IPv6 -> first four groups. Empty when unknown. */
export function truncateIp(ip: string | null | undefined): string {
  if (!ip) return "";
  const v = ip.trim();
  if (v.includes(":")) {
    const groups = v.split(":").filter((g, i, a) => g !== "" || i === 0 || i === a.length - 1);
    return `${groups.slice(0, 4).join(":")}::`;
  }
  const parts = v.split(".");
  if (parts.length !== 4) return "";
  return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
}

/** "Chrome on macOS" style label from a User-Agent. Coarse on purpose. */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iOS/.test(ua)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "an unknown OS";
  return `${browser} on ${os}`;
}

export const clientIp = (headers: Headers): string =>
  headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
