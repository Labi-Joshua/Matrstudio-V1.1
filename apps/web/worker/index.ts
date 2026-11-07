/**
 * Entry point of the site Worker. Static files are served by Cloudflare's asset handling (see
 * wrangler.toml); this only runs for page requests, to keep one canonical host: matrstudio.com.
 */
type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };

const CANONICAL_HOST = "matrstudio.com";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === `www.${CANONICAL_HOST}`) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
