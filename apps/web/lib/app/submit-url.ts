import type { Resource, Source } from "../catalogue/types";

/**
 * Client-side checks for the "Submit a resource" link. They only exist to give quick, friendly
 * feedback: the server is the authority (docs/SECURITY-AUTH.md section 8: https only, no
 * credentials, no private hosts) and may still refuse a link this accepts.
 */
export const URL_MAX_LENGTH = 2048;

export type LinkProblem = "empty" | "scheme" | "credentials" | "too_long" | "invalid";

export type LinkCheck = { ok: true; url: string } | { ok: false; problem: LinkProblem };

export const LINK_MESSAGES: Record<LinkProblem, string> = {
  empty: "Paste a link to a free video, article or tool.",
  scheme: "Links must start with https://.",
  credentials: "Remove the username and password from the link.",
  too_long: "That link is too long.",
  // Figma "Submit: broken link": the same message is shown when the server answers invalid_url.
  invalid: "We couldn’t open this link. Check it and try again.",
};

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const KNOWN_BAD_SCHEMES = new Set([
  "http",
  "ftp",
  "file",
  "javascript",
  "data",
  "mailto",
  "vbscript",
  "blob",
]);
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * The field shows a fixed "https://" prefix, so people usually type "youtube.com/..." but some
 * paste the whole address. Returns the text after any https:// the visitor typed, so the field
 * never ends up with "https://https://".
 */
export function stripHttpsPrefix(raw: string): string {
  return raw.trim().replace(/^https:\/\//i, "");
}

export function checkLink(raw: string): LinkCheck {
  const text = raw.trim();
  if (text === "") return { ok: false, problem: "empty" };
  if (text.length > URL_MAX_LENGTH) return { ok: false, problem: "too_long" };

  const withScheme = text.match(SCHEME);
  const scheme = withScheme?.[1]?.toLowerCase();
  if (scheme && scheme !== "https") {
    // "example.com:8080/x" also looks like a scheme; only refuse the ones that are clearly not https.
    if (KNOWN_BAD_SCHEMES.has(scheme) || text.slice(scheme.length + 1).startsWith("//")) {
      return { ok: false, problem: "scheme" };
    }
  }

  const candidate = /^https:\/\//i.test(text) ? text : `https://${text}`;
  if (/\s/.test(candidate)) return { ok: false, problem: "invalid" };
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, problem: "invalid" };
  }
  if (parsed.username !== "" || parsed.password !== "")
    return { ok: false, problem: "credentials" };
  const host = parsed.hostname;
  if (
    !host.includes(".") ||
    host.startsWith("[") ||
    IPV4.test(host) ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return { ok: false, problem: "invalid" };
  }
  return { ok: true, url: parsed.toString() };
}

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|mc_|ref$|si$)/i;

/**
 * A key that is equal for two spellings of the same page: lower-case host without "www.", no
 * fragment, no trailing slash, tracking parameters dropped and the rest sorted. Returns null for
 * anything that is not a usable https link.
 */
export function normaliseUrlKey(raw: string): string | null {
  const check = checkLink(raw);
  if (!check.ok) return null;
  const parsed = new URL(check.url);
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/+$/, "");
  const params = [...parsed.searchParams.entries()]
    .filter(([name]) => !TRACKING_PARAM.test(name))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
  return `${host}${path}${params ? `?${params}` : ""}`;
}

export type LibraryMatch = { title: string; sourceName: string | null };

/** The catalogue resource with this link, if any (resources without a url never match). */
export function findInLibrary(
  raw: string,
  resources: readonly Pick<Resource, "title" | "url" | "sourceSlug">[],
  sources: readonly Pick<Source, "slug" | "name">[],
): LibraryMatch | null {
  const key = normaliseUrlKey(raw);
  if (!key) return null;
  for (const resource of resources) {
    if (!resource.url) continue;
    if (normaliseUrlKey(resource.url) === key) {
      const source = sources.find((s) => s.slug === resource.sourceSlug);
      return { title: resource.title, sourceName: source?.name ?? null };
    }
  }
  return null;
}

/** Host without "www." for showing next to a submission that has no title. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
