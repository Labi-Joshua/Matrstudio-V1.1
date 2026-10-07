import { zValidator } from "@hono/zod-validator";
import { AwsClient } from "aws4fetch";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { apiError } from "../lib/errors";
import { requireAdmin } from "../middleware/admin-auth";

const MAX_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const EXPIRES_IN = 300; // seconds

const presignSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"]),
  size: z.number().int().positive().max(MAX_BYTES),
});

export const uploads = new Hono<AppEnv>();
uploads.use("*", requireAdmin); // swap for real user auth when apps/user-app lands

// POST /api/uploads/presign: the Worker only signs; the browser sends the bytes straight to R2.
uploads.post("/presign", zValidator("json", presignSchema), async (c) => {
  const { contentType } = c.req.valid("json");
  const key = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${EXT[contentType]}`;
  const headers = { "Content-Type": contentType };

  // The local R2 emulator has no S3 endpoint, so in dev the "presigned" URL points back at this Worker.
  // (PUBLIC_API_URL, not c.req.url: wrangler dev rewrites the request host to the production route.)
  if (c.env.ENVIRONMENT === "development") {
    return c.json({
      method: "PUT" as const,
      url: `${c.env.PUBLIC_API_URL}/api/uploads/dev/${key}`,
      key,
      headers: { ...headers, Authorization: c.req.header("Authorization") ?? "" },
      expiresIn: EXPIRES_IN,
    });
  }

  const r2 = new AwsClient({
    accessKeyId: c.env.R2_ACCESS_KEY_ID,
    secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  const target = new URL(
    `https://${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${c.env.R2_BUCKET_NAME}/${key}`,
  );
  target.searchParams.set("X-Amz-Expires", String(EXPIRES_IN));
  const signed = await r2.sign(new Request(target, { method: "PUT", headers }), {
    aws: { signQuery: true },
  });
  return c.json({
    method: "PUT" as const,
    url: signed.url,
    key,
    headers,
    expiresIn: EXPIRES_IN,
  });
});

// PUT /api/uploads/dev/*: development-only stand-in for the R2 S3 endpoint.
uploads.put("/dev/*", async (c) => {
  if (c.env.ENVIRONMENT !== "development") return c.json(apiError("not_found", "Not found."), 404);
  const key = c.req.path.replace("/api/uploads/dev/", "");
  await c.env.BUCKET.put(key, c.req.raw.body, {
    httpMetadata: { contentType: c.req.header("Content-Type") ?? "application/octet-stream" },
  });
  return c.body(null, 200);
});
