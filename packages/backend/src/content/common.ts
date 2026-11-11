import type { Context } from "hono";
import type { ZodType } from "zod";
import type { AdminCtx } from "../auth/admin-guard";
import { type AuditEntry, writeAudit } from "../auth/audit";
import { authError } from "../auth/guard";
import { clientIp } from "../auth/util";

export type C = Context<AdminCtx>;

export const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const iso = (sec: number | null | undefined) =>
  sec == null ? null : new Date(sec * 1000).toISOString();
export const nowSec = () => Math.floor(Date.now() / 1000);
export const newId = () => crypto.randomUUID();

export const invalid = (c: C, extra = {}) =>
  c.json(authError("invalid_request", "Check the details you entered.", extra), 400);
export const notFound = (c: C, what = "That") =>
  c.json(authError("not_found", `${what} wasn’t found.`), 404);
export const conflict = (c: C, code: string, message: string, extra = {}) =>
  c.json(authError(code, message, extra), 409);

/** Parses the JSON body with a schema; null when it is missing or does not match. */
export async function body<T>(c: C, schema: ZodType<T>): Promise<T | null> {
  const raw = await c.req.json().catch(() => null);
  const r = schema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Same, for routes whose body is optional ("{}" when absent). */
export async function optionalBody<T>(c: C, schema: ZodType<T>): Promise<T | null> {
  const text = await c.req.text().catch(() => "");
  let raw: unknown = {};
  if (text.trim()) {
    try {
      raw = JSON.parse(text);
    } catch {
      return null;
    }
  }
  const r = schema.safeParse(raw);
  return r.success ? r.data : null;
}

export const audit = (c: C, e: Pick<AuditEntry, "action" | "target" | "meta">) =>
  writeAudit(c.env.DB, {
    actor: c.get("admin").id,
    ip: clientIp(c.req.raw.headers),
    ua: c.req.header("user-agent"),
    ...e,
  });

/** The route param as a safe id, or null (never interpolated into SQL; bound only). */
export const idParam = (c: C, name = "id") => {
  const v = c.req.param(name) ?? "";
  return ID.test(v) ? v : null;
};

// --- cursors: opaque "<unix seconds>.<id>" ---------------------------------------------------
export const encodeCursor = (at: number, id: string) => btoa(`${at}.${id}`);
export function decodeCursor(raw: string | undefined): { at: number; id: string } | null {
  if (!raw) return null;
  try {
    const s = atob(raw);
    const dot = s.indexOf(".");
    const at = Number(s.slice(0, dot));
    const id = s.slice(dot + 1);
    return Number.isFinite(at) && ID.test(id) ? { at, id } : null;
  } catch {
    return null;
  }
}

export const clampLimit = (raw: string | undefined, def = 25, max = 100) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, max) : def;
};

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** "?,?,?" for an IN list. */
export const qmarks = (n: number) => Array.from({ length: n }, () => "?").join(",");

/** Runs D1 batches in chunks (a batch is one round trip; keep each well under the bind limits). */
export async function runChunked(db: D1Database, stmts: D1PreparedStatement[], size = 50) {
  for (let i = 0; i < stmts.length; i += size) await db.batch(stmts.slice(i, i + size));
}
