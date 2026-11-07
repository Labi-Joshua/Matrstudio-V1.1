import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env";
import { apiError } from "../lib/errors";

const ADMIN_DEFAULT_ORIGIN = "https://admin.matrstudio.com";
const adminOriginOf = (env: { PUBLIC_ADMIN_URL?: string }) =>
  new URL(env.PUBLIC_ADMIN_URL || ADMIN_DEFAULT_ORIGIN).origin;

/** Origins allowed for the learner API. The admin origin is deliberately never in this set. */
export const allowedOrigins = (env: {
  ALLOWED_ORIGINS: string;
  PUBLIC_WEB_URL: string;
  PUBLIC_ADMIN_URL?: string;
}) => {
  const admin = adminOriginOf(env);
  const set = new Set([
    new URL(env.PUBLIC_WEB_URL).origin,
    "https://matrstudio.com",
    ...env.ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  ]);
  set.delete(admin);
  return set;
};

/**
 * Origins allowed for /api/admin/**: the admin app origin only. Outside production the local dev
 * origins in ALLOWED_ORIGINS are accepted too, so the admin app can run on localhost.
 */
export const adminOrigins = (env: {
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS: string;
  PUBLIC_ADMIN_URL?: string;
}) => {
  const set = new Set([adminOriginOf(env)]);
  if (env.ENVIRONMENT === "development") {
    for (const o of env.ALLOWED_ORIGINS.split(",")
      .map((x) => x.trim())
      .filter((x) => x.startsWith("http://localhost"))) {
      set.add(o);
    }
  }
  return set;
};

export const isAdminPath = (path: string) =>
  path === "/api/admin" || path.startsWith("/api/admin/");

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF (SECURITY-AUTH.md section 8): every state-changing request to /api/** must carry an Origin
 * header on the allow-list. A missing or foreign Origin is rejected with 403 before any handler runs.
 */
export const originGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (STATE_CHANGING.has(c.req.method)) {
    const origin = c.req.header("origin");
    const allowed = isAdminPath(c.req.path) ? adminOrigins(c.env) : allowedOrigins(c.env);
    if (!origin || !allowed.has(origin)) {
      return c.json(apiError("forbidden_origin", "Request not allowed from this origin."), 403);
    }
  }
  await next();
};

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  // API responses are JSON (or a redirect): nothing is ever rendered, so the policy is closed.
  "Content-Security-Policy":
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "Cross-Origin-Resource-Policy": "same-site",
};

export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  // Responses built by fetch() or other handlers can have immutable headers: copy first.
  const res = new Response(c.res.body, c.res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  if (
    c.req.path.startsWith("/api/auth") ||
    c.req.path.startsWith("/api/me") ||
    isAdminPath(c.req.path)
  ) {
    res.headers.set("Cache-Control", "no-store");
  }
  c.res = res;
};
