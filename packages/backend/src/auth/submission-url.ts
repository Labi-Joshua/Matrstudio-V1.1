// Validation and normalisation of submitted resource URLs. The server never fetches these, so
// there is no SSRF surface; internal-looking hosts are still refused (SECURITY-AUTH.md section 8).
export type UrlCheck = { ok: true; normalised: string } | { ok: false };

const TRACKING = /^(utm_.*|fbclid|gclid)$/i;
const IPV4_LIKE = /^[0-9.]+$/;

function hostAllowed(host: string): boolean {
  if (!host || host.startsWith("[") || host.includes(":")) return false; // IPv6 literal
  const h = host.endsWith(".") ? host.slice(0, -1) : host;
  if (!h || h.includes("..")) return false;
  if (IPV4_LIKE.test(h)) return false; // the URL parser rewrites 0x7f.1 and 2130706433 to dotted form
  if (!h.includes(".")) return false; // single-label, includes "localhost"
  const tld = h.slice(h.lastIndexOf(".") + 1);
  if (["local", "internal", "localhost", "localdomain", "lan", "home", "corp"].includes(tld))
    return false;
  if (/^[0-9]+$/.test(tld)) return false;
  return true;
}

export function checkSubmissionUrl(raw: string): UrlCheck {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false };
  }
  if (u.protocol !== "https:") return { ok: false };
  if (u.username || u.password) return { ok: false };
  if (!hostAllowed(u.hostname.toLowerCase())) return { ok: false };
  const params = new URLSearchParams();
  for (const [k, v] of u.searchParams) if (!TRACKING.test(k)) params.append(k, v);
  const search = params.size ? `?${params}` : "";
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : "";
  // u.host is lower-case and already omits the default port 443; the fragment is dropped.
  const host = u.host.replace(/\.(?=$|:)/, "");
  return { ok: true, normalised: `https://${host}${path}${search}` };
}
