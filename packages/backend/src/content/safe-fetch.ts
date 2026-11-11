import { checkSubmissionUrl } from "../auth/submission-url";
import { sniffImage } from "../profile/data";

// Server-side fetching of an admin-supplied URL (resource preview, link check, submission
// auto-checks). SSRF rules: https only, and every hop (including each redirect target) must pass the
// same host rules as learner submissions (src/auth/submission-url.ts): no IP literals, no
// localhost or single-label hosts, no internal TLDs, no credentials in the URL. Redirects are
// followed by hand, at most MAX_REDIRECTS, never to a blocked address. Time and size are capped, no
// cookies or auth are ever sent, and the page body is never stored. The Workers runtime also
// cannot reach private networks; these checks are the first line, not the only one.

export const FETCH_TIMEOUT_MS = 5000;
export const MAX_BODY_BYTES = 256 * 1024;
export const MAX_REDIRECTS = 3;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
/** Sites that refuse automated requests: the check is inconclusive, not a failure. */
const BOT_BLOCK = new Set([401, 403, 429, 999]);

export type Fetched = {
  /** True when the page is reachable (or the site refuses bots, see `inconclusive`). */
  ok: boolean;
  inconclusive: boolean;
  status: number | null;
  reason: string | null;
  finalUrl: string | null;
  contentType: string | null;
  html: string | null;
};

const fail = (
  reason: string,
  status: number | null = null,
  finalUrl: string | null = null,
): Fetched => ({
  ok: false,
  inconclusive: false,
  status,
  reason,
  finalUrl,
  contentType: null,
  html: null,
});

async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(Math.min(size, max));
  let off = 0;
  for (const ch of chunks) {
    const part = ch.subarray(0, Math.max(0, Math.min(ch.byteLength, all.byteLength - off)));
    all.set(part, off);
    off += part.byteLength;
  }
  return new TextDecoder("utf-8").decode(all);
}

export async function safeFetch(
  rawUrl: string,
  opts: { readBody?: boolean; timeoutMs?: number } = {},
): Promise<Fetched> {
  const signal = AbortSignal.timeout(opts.timeoutMs ?? FETCH_TIMEOUT_MS);
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const checked = checkSubmissionUrl(current);
    if (!checked.ok)
      return fail(
        hop === 0 ? "This link can’t be checked." : "Redirects somewhere that isn’t allowed.",
      );
    let res: Response;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: {
          "user-agent": "MatrStudioLinkCheck/1.0 (+https://matrstudio.com)",
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        },
      });
    } catch (err) {
      const timedOut =
        err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      return fail(timedOut ? "The page took too long to answer." : "Couldn’t connect to the site.");
    }
    if (REDIRECTS.has(res.status)) {
      await res.body?.cancel().catch(() => {});
      const loc = res.headers.get("location");
      if (!loc) return fail("Redirects without a destination.", res.status);
      try {
        current = new URL(loc, current).toString();
      } catch {
        return fail("Redirects somewhere that isn’t allowed.", res.status);
      }
      continue;
    }
    const contentType = res.headers.get("content-type");
    if (res.status >= 200 && res.status < 300) {
      const isHtml = /text\/html|application\/xhtml/i.test(contentType ?? "");
      const read = Boolean(opts.readBody && isHtml);
      const html = read ? await readCapped(res, MAX_BODY_BYTES) : null;
      if (!read) await res.body?.cancel().catch(() => {});
      return {
        ok: true,
        inconclusive: false,
        status: res.status,
        reason: null,
        finalUrl: current,
        contentType,
        html,
      };
    }
    await res.body?.cancel().catch(() => {});
    if (BOT_BLOCK.has(res.status))
      return {
        ok: true,
        inconclusive: true,
        status: res.status,
        reason: `The site blocks automated checks (HTTP ${res.status}).`,
        finalUrl: current,
        contentType,
        html: null,
      };
    return fail(`The page answered HTTP ${res.status}.`, res.status, current);
  }
  return fail("Too many redirects.");
}

// --- page metadata ---------------------------------------------------------------------------
const ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};
const decode = (s: string) =>
  s
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e.startsWith("#")) {
        const code =
          e[1]?.toLowerCase() === "x" ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1));
        return Number.isFinite(code) && code > 0 && code < 0x110000
          ? String.fromCodePoint(code)
          : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();

function metaContent(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = /\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (name?.toLowerCase() !== key) continue;
    const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const v = content?.[1] ?? content?.[2];
    if (v) return decode(v);
  }
  return null;
}

function isoDurationMin(v: string): number | null {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(v);
  if (!m) return null;
  const secs = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return secs > 0 ? Math.max(1, Math.round(secs / 60)) : null;
}

export type PageMeta = {
  title: string | null;
  siteName: string | null;
  thumbnail: string | null;
  durationMin: number | null;
  lang: string | null;
};

export function parseMeta(html: string | null, baseUrl: string): PageMeta {
  const empty: PageMeta = {
    title: null,
    siteName: null,
    thumbnail: null,
    durationMin: null,
    lang: null,
  };
  if (!html) return empty;
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const title =
    (metaContent(html, "og:title") ?? (titleTag ? decode(titleTag) : null))?.slice(0, 200) || null;
  let thumbnail: string | null = null;
  const img = metaContent(html, "og:image");
  if (img) {
    try {
      const abs = new URL(img, baseUrl).toString();
      thumbnail = checkSubmissionUrl(abs).ok ? abs.slice(0, 500) : null;
    } catch {}
  }
  const dur = metaContent(html, "og:video:duration") ?? metaContent(html, "video:duration");
  let durationMin: number | null = null;
  if (dur && /^\d+$/.test(dur)) durationMin = Math.max(1, Math.round(Number(dur) / 60));
  else {
    const isoDur = metaContent(html, "duration");
    if (isoDur) durationMin = isoDurationMin(isoDur);
  }
  if (durationMin !== null && durationMin > 6000) durationMin = null;
  return {
    title,
    siteName: metaContent(html, "og:site_name")?.slice(0, 80) ?? null,
    thumbnail,
    durationMin,
    lang:
      /<html\b[^>]*\blang\s*=\s*["']([A-Za-z-]{2,10})["']/i.exec(html)?.[1]?.toLowerCase() ?? null,
  };
}

const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/i;
export const suggestType = (host: string): "video" | "article" =>
  VIDEO_HOSTS.test(host) ? "video" : "article";

// --- thumbnails ----------------------------------------------------------------------------------
export const MAX_THUMB_BYTES = 150 * 1024;

const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/**
 * The admin portal's CSP only allows same-origin and data: images, so a page's preview image is
 * fetched here (same SSRF rules, redirects checked by hand, 150 KB cap, 5 s) and kept as a data: URL.
 * Only PNG, JPEG and WebP are accepted, by their first bytes (never SVG). Null on any problem.
 */
export async function fetchThumbnail(src: string | null): Promise<string | null> {
  if (!src) return null;
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let current = src;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!checkSubmissionUrl(current).ok) return null;
      const res = await fetch(current, {
        redirect: "manual",
        signal,
        headers: { accept: "image/*" },
      });
      if (REDIRECTS.has(res.status)) {
        await res.body?.cancel().catch(() => {});
        const loc = res.headers.get("location");
        if (!loc) return null;
        current = new URL(loc, current).toString();
        continue;
      }
      if (res.status !== 200 || !res.body) {
        await res.body?.cancel().catch(() => {});
        return null;
      }
      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > MAX_THUMB_BYTES) {
        await res.body.cancel().catch(() => {});
        return null;
      }
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        size += value.byteLength;
        if (size > MAX_THUMB_BYTES) {
          await reader.cancel().catch(() => {});
          return null;
        }
        chunks.push(value);
      }
      const all = new Uint8Array(size);
      let off = 0;
      for (const ch of chunks) {
        all.set(ch, off);
        off += ch.byteLength;
      }
      const type = sniffImage(all);
      return type ? `data:${type};base64,${b64(all)}` : null;
    }
  } catch {
    return null;
  }
  return null;
}
