/**
 * Entry point of the site Worker. Static files are served by Cloudflare's asset handling (see
 * wrangler.toml); this only runs for page and API requests:
 * - www.matrstudio.com redirects to the canonical host, matrstudio.com;
 * - /api/* goes to the API Worker (matr-api) through a service binding, so sign-in works
 *   same-origin: the session cookie is set on matrstudio.com itself, with no CORS or cross-site
 *   cookies involved.
 */
type Fetcher = { fetch(request: Request): Promise<Response> };
type Env = { ASSETS: Fetcher; API: Fetcher };

const CANONICAL_HOST = "matrstudio.com";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === `www.${CANONICAL_HOST}`) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname.startsWith("/api/")) return env.API.fetch(request);
    return env.ASSETS.fetch(request);
  },
};
