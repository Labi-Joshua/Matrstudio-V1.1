import type { Context } from "hono";
import type { AppEnv } from "../env";

/**
 * Edge-cache a JSON payload with the Workers Cache API.
 * - Only active on custom domains (a no-op on *.workers.dev).
 * - The cache is per data center, so worst case = (ttl-spaced) one origin read per colo.
 * - Stores the payload only, never CORS headers; those are added per request by the cors middleware.
 */
export async function cachedJson<T>(
  c: Context<AppEnv>,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const url = new URL(c.req.url);
  const cacheKey = new Request(`${url.origin}${url.pathname}`); // drop query string and headers from the key
  const cache = caches.default;

  const hit = await cache.match(cacheKey);
  if (hit) return hit.json<T>();

  const data = await load();
  c.executionCtx.waitUntil(
    cache.put(
      cacheKey,
      new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${ttlSeconds}`,
        },
      }),
    ),
  );
  return data;
}
