/**
 * Security headers for the site (docs/SECURITY-AUTH.md section 8), added by the Worker to every
 * response it serves from the static assets.
 *
 * The Content-Security-Policy allows scripts only from this site and the Turnstile bot check, plus
 * the exact inline scripts each page contains: Next.js writes a handful of inline scripts into every
 * static page and a nonce is impossible without a server rendering each request, so
 * scripts/csp-hashes.mjs hashes them at build time (worker/csp-hashes.json) and each page gets a
 * policy listing only its own hashes. There is no 'unsafe-inline' for scripts and no 'unsafe-eval'.
 * Inline styles stay allowed: React and next/font emit style attributes and tags.
 */
export type CspHashes = Record<string, string[]>;

const TURNSTILE = "https://challenges.cloudflare.com";

export function contentSecurityPolicy(scriptHashes: string[]): string {
  const hashes = scriptHashes.map((h) => `'sha256-${h}'`).join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes} ${TURNSTILE}`.replace(/\s+/g, " "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${TURNSTILE}`,
    `frame-src ${TURNSTILE}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** Key of a page in csp-hashes.json: its path without a trailing slash ("/" for the home page). */
export function routeKey(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

const ALWAYS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

/** A copy of the response with the security headers set; the CSP only on HTML documents. */
export function withSecurityHeaders(response: Response, scriptHashes: string[]): Response {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(ALWAYS)) secured.headers.set(name, value);
  if ((secured.headers.get("Content-Type") ?? "").includes("text/html")) {
    secured.headers.set("Content-Security-Policy", contentSecurityPolicy(scriptHashes));
  }
  return secured;
}
