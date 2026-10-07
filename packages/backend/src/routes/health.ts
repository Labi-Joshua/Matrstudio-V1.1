import { Hono } from "hono";
import type { AppEnv } from "../env";

export const health = new Hono<AppEnv>();

// Does not touch D1 or R2, so an uptime monitor polling it burns zero database quota.
health.get("/", (c) =>
  c.json({ ok: true as const, env: c.env.ENVIRONMENT, time: new Date().toISOString() }),
);

// Deliberate dependency check. Point monitors at "/health", and hit this one by hand.
health.get("/db", async (c) => {
  await c.env.DB.prepare("SELECT 1").first();
  return c.json({ ok: true as const });
});
