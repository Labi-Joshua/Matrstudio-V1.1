/**
 * Entry point of the site Worker. Static files are served by Cloudflare's asset handling (see
 * wrangler.toml); this only runs for page and API requests:
 * - www.matrstudio.com redirects to the canonical host, matrstudio.com;
 * - /api/* goes to the API Worker (matr-api) through a service binding, so sign-in works
 *   same-origin: the session cookie is set on matrstudio.com itself, with no CORS or cross-site
 *   cookies involved;
 * - everything else is served from the static assets with the security headers and a
 *   per-page Content-Security-Policy (see security.ts).
 */
import cspHashes from "./csp-hashes.json";
import { isProfilePath } from "./profile-path";
import { type CspHashes, routeKey, withSecurityHeaders } from "./security";

type Fetcher = { fetch(request: Request): Promise<Response> };
type Env = { ASSETS: Fetcher; API: Fetcher };

const CANONICAL_HOST = "matrstudio.com";
const hashes: CspHashes = cspHashes;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === `www.${CANONICAL_HOST}`) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }
    // The API sets its own security headers.
    if (url.pathname.startsWith("/api/")) return env.API.fetch(request);

    // /@name is the public profile page: serve the static /u page and let it read the name.
    const profile = isProfilePath(url.pathname);
    const response = await env.ASSETS.fetch(
      profile ? new Request(new URL("/u", url), request) : request,
    );
    // An unknown path is served as 404.html, whose scripts are listed under "/404".
    const key = response.status === 404 ? "/404" : routeKey(profile ? "/u" : url.pathname);
    return withSecurityHeaders(response, hashes[key] ?? hashes["/404"] ?? []);
  },
};
