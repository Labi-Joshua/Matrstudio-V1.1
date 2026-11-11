/**
 * Entry point of the admin Worker. Static files come from Cloudflare's asset handling; this runs
 * for page and API requests:
 * - /api/* goes to the API Worker through a service binding (same origin, so the admin session
 *   cookie never crosses sites). The Cloudflare Access headers and cookie travel with the request
 *   and the API verifies the JWT itself;
 * - everything else is served from the static assets with the security headers and a per-page
 *   Content-Security-Policy (see security.ts).
 * Every response is marked noindex: the portal is never meant to be found by a search engine.
 */
import cspHashes from "./csp-hashes.json";
import { type CspHashes, routeKey, withSecurityHeaders } from "./security";

type Fetcher = { fetch(request: Request): Promise<Response> };
type Env = { ASSETS: Fetcher; API: Fetcher };

const hashes: CspHashes = cspHashes;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return env.API.fetch(request);

    const response = await env.ASSETS.fetch(request);
    const key = response.status === 404 ? "/404" : routeKey(url.pathname);
    const secured = withSecurityHeaders(response, hashes[key] ?? hashes["/404"] ?? []);
    secured.headers.set("X-Robots-Tag", "noindex, nofollow");
    return secured;
  },
};
