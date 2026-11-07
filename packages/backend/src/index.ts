import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAuth } from "./auth";
import { purgeStaleLimits } from "./auth/limits";
import { deleteStaleUnconfirmed, isCleanupTick } from "./cron/cleanup";
import { checkUsage } from "./cron/usage-monitor";
import type { AppEnv, Bindings } from "./env";
import type { AuthEmailMessage } from "./lib/auth-email-templates";
import { apiError } from "./lib/errors";
import { allowedOrigins, originGuard, securityHeaders } from "./middleware/security";
import { handleAuthEmailBatch } from "./queue/auth-email";
import { health } from "./routes/health";
import { me } from "./routes/me";
import { uploads } from "./routes/uploads";
import { waitlist } from "./routes/waitlist";

const app = new Hono<AppEnv>();

// CORS: exact-match allow-list from ALLOWED_ORIGINS. maxAge 7200 s is Chrome's ceiling; it lets one
// preflight cover two hours, because every OPTIONS request is a billable Worker request.
app.use("*", (c, next) => {
  const allowed = allowedOrigins(c.env);
  return cors({
    // Credentials (the session cookie) only for the explicit allow-list, never with "*".
    origin: (origin) => (allowed.has(origin) ? origin : null),
    credentials: allowed.has(c.req.header("origin") ?? ""),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Captcha-Response"],
    maxAge: 7200,
  })(c, next);
});
app.use("*", securityHeaders);
app.use("/api/*", originGuard);

// Responses on these paths take at least AUTH_MIN_RESPONSE_MS, so a known and an unknown address
// cannot be told apart by timing.
const PADDED_PATHS = new Set([
  "/api/auth/sign-in/magic-link",
  "/api/auth/request-password-reset",
  "/api/auth/send-verification-email",
]);

app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  const started = Date.now();
  const res = await getAuth(c.env).handler(c.req.raw);
  if (PADDED_PATHS.has(c.req.path)) {
    const floor =
      c.env.ENVIRONMENT !== "production" && c.env.AUTH_MIN_RESPONSE_MS
        ? Number(c.env.AUTH_MIN_RESPONSE_MS)
        : 400;
    const wait = floor - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  return res;
});
app.route("/api", me);

app.route("/health", health);
app.route("/api/waitlist", waitlist);
app.route("/api/uploads", uploads);

app.notFound((c) => c.json(apiError("not_found", "Not found."), 404));
app.onError((err, c) => {
  console.error(err);
  return c.json(apiError("internal_error", "Something went wrong."), 500);
});

export default {
  fetch: app.fetch,
  scheduled(controller, env, ctx) {
    ctx.waitUntil(checkUsage(env));
    if (isCleanupTick(controller.scheduledTime)) {
      ctx.waitUntil(deleteStaleUnconfirmed(env));
      ctx.waitUntil(purgeStaleLimits(env.DB));
    }
  },
  queue(batch, env) {
    return handleAuthEmailBatch(batch as MessageBatch<AuthEmailMessage>, env);
  },
} satisfies ExportedHandler<Bindings>;
