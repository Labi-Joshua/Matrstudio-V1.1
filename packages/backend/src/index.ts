import { Hono } from "hono";
import { cors } from "hono/cors";
import { checkUsage } from "./cron/usage-monitor";
import type { AppEnv, Bindings } from "./env";
import { apiError } from "./lib/errors";
import { health } from "./routes/health";
import { uploads } from "./routes/uploads";
import { waitlist } from "./routes/waitlist";

const app = new Hono<AppEnv>();

// CORS: exact-match allow-list from ALLOWED_ORIGINS. maxAge 7200 s is Chrome's ceiling; it lets one
// preflight cover two hours, because every OPTIONS request is a billable Worker request.
app.use("*", (c, next) => {
  const allowed = c.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 7200,
  })(c, next);
});

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
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(checkUsage(env));
  },
} satisfies ExportedHandler<Bindings>;
