import type { Context } from "hono";
import type { ZodType } from "zod";
import type { AdminCtx } from "../auth/admin-guard";
import { SUPER_ADMIN_ROLE } from "../auth/admin-perms";
import { type AuditAction, writeAudit } from "../auth/audit";
import { authError } from "../auth/guard";
import { hit, type Limit } from "../auth/limits";
import { clientIp } from "../auth/util";

export type C = Context<AdminCtx>;

export const invalid = (c: C) =>
  c.json(authError("invalid_request", "Check the details you entered."), 400);
export const notFound = (c: C, what = "That") =>
  c.json(authError("not_found", `${what} wasn’t found.`), 404);

export async function parseBody<T>(c: C, schema: ZodType<T>): Promise<T | null> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

export const isSuperAdmin = (c: C) => c.get("admin").roleId === SUPER_ADMIN_ROLE;

/** Spends one hit on a limit; on overflow answers 429 (audited without personal data). */
export async function limited(c: C, key: string, rule: Limit, scope: string) {
  const r = await hit(c.env.DB, key, rule);
  if (r.allowed) return null;
  await audit(c, "rate_limit.hit", null, { scope });
  c.header("Retry-After", String(r.retryAfterSec));
  return c.json(
    authError("rate_limited", "Too many attempts. Try again later.", {
      retryAfterSeconds: r.retryAfterSec,
    }),
    429,
  );
}

/** One audit row for an admin write: actor is the admin id, meta carries ids and codes only. */
export const audit = (
  c: C,
  action: AuditAction,
  target: string | null,
  meta: Record<string, string | number | boolean | null> = {},
) =>
  writeAudit(c.env.DB, {
    actor: c.get("admin").id,
    action,
    target,
    ip: clientIp(c.req.raw.headers),
    ua: c.req.header("user-agent"),
    meta,
  });

/** Opaque cursors are "<a>:<b>" pairs; anything else is rejected. */
export function readCursor(v: string | undefined): [string, string] | null | "bad" {
  if (!v) return null;
  const i = v.lastIndexOf(":");
  return i > 0 && i < v.length - 1 ? [v.slice(0, i), v.slice(i + 1)] : "bad";
}

export const clampLimit = (v: string | undefined, def = 50, max = 100) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : def;
};

/** Escapes a CSV cell; cells starting with = + - @ are quoted with a leading apostrophe (formula injection). */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export const toCsv = (rows: Array<Array<string | number | null>>) =>
  `${rows.map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
