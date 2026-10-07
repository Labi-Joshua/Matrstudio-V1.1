import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env";
import { apiError } from "../lib/errors";

/** Placeholder until user-app auth exists: a shared bearer token held in a Worker secret. */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const presented = new TextEncoder().encode(
    (c.req.header("Authorization") ?? "").replace(/^Bearer /, ""),
  );
  const expected = new TextEncoder().encode(c.env.ADMIN_API_TOKEN);
  const ok =
    presented.byteLength === expected.byteLength &&
    crypto.subtle.timingSafeEqual(presented, expected);
  if (!ok) return c.json(apiError("unauthorized", "Missing or invalid credentials."), 401);
  await next();
};
