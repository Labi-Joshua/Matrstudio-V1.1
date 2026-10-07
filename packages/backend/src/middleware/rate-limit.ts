import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env";
import { apiError } from "../lib/errors";

/** Per-IP limit using the Workers Rate Limiting binding (configured in wrangler.toml). */
export const rateLimit =
  (binding: "SIGNUP_LIMITER" | "API_LIMITER"): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const { success } = await c.env[binding].limit({ key: `${c.req.path}:${ip}` });
    if (!success) {
      return c.json(apiError("rate_limited", "Too many requests. Try again shortly."), 429, {
        "Retry-After": "60",
      });
    }
    await next();
  };
