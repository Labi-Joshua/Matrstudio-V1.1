import type { MiddlewareHandler } from "hono";
import type { AppEnv, Bindings } from "../env";
import { authError } from "./guard";

// Lock 1 of the admin portal (SECURITY-AUTH.md section 6): Cloudflare Access. Every /api/admin/**
// request must carry an Access JWT (header Cf-Access-Jwt-Assertion, or the CF_Authorization cookie)
// that verifies against the team's published keys. The header merely being present proves nothing.
//
// Checked: RS256 signature, iss = https://<team>.cloudflareaccess.com, aud contains the Access
// application AUD tag, exp (required) and nbf, and a non-empty email claim. The verified email is
// handed to the handlers as `accessEmail`; the admin account's email must equal it.
//
// Fail closed: with CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD unset the admin API answers 503, never
// "open". The only way around the check is the dev bypass, which needs ENVIRONMENT to be exactly
// "development" AND ADMIN_DEV_BYPASS_ACCESS=true; "production" (or anything else) can never use it.

const CLOCK_SKEW_SECONDS = 30;
const JWKS_TTL_MS = 60 * 60 * 1000; // cached keys are trusted for an hour
const JWKS_MIN_REFRESH_MS = 60 * 1000; // an unknown kid triggers a refetch at most once a minute
const DEV_EMAIL_HEADER = "x-dev-access-email";

type CachedKeys = { keys: Map<string, CryptoKey>; fetchedAt: number };
const cache = new Map<string, CachedKeys>();

/** Tests only: forget cached signing keys. */
export const resetAccessKeyCache = () => cache.clear();

export type AccessIdentity = { email: string };
export type AccessFailure =
  | "unconfigured"
  | "missing"
  | "malformed"
  | "bad_signature"
  | "unknown_key"
  | "bad_issuer"
  | "bad_audience"
  | "expired"
  | "not_yet_valid"
  | "no_email"
  | "keys_unavailable";

export type AccessResult =
  | { ok: true; email: string; bypass: boolean }
  | { ok: false; reason: AccessFailure };

/** Team host such as "matrstudio.cloudflareaccess.com", or null when unset or not a valid team name. */
export function accessTeamHost(env: Pick<Bindings, "CF_ACCESS_TEAM_DOMAIN">): string | null {
  const raw = env.CF_ACCESS_TEAM_DOMAIN?.trim().toLowerCase();
  if (!raw) return null;
  const host = raw.includes(".") ? raw : `${raw}.cloudflareaccess.com`;
  // Only a Cloudflare Access team host: the value is used to build the key-fetch URL.
  return /^[a-z0-9][a-z0-9-]{0,62}\.cloudflareaccess\.com$/.test(host) ? host : null;
}

/** The dev bypass exists only when ENVIRONMENT is exactly "development" and the flag is "true". */
export const devBypassEnabled = (
  env: Pick<Bindings, "ENVIRONMENT" | "ADMIN_DEV_BYPASS_ACCESS">,
): boolean => env.ENVIRONMENT === "development" && env.ADMIN_DEV_BYPASS_ACCESS === "true";

const fromB64u = (s: string): Uint8Array =>
  Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));

async function loadKeys(host: string): Promise<CachedKeys | null> {
  try {
    const res = await fetch(`https://${host}/cdn-cgi/access/certs`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { keys?: Array<JsonWebKey & { kid?: string }> };
    const keys = new Map<string, CryptoKey>();
    for (const jwk of body.keys ?? []) {
      if (!jwk.kid || jwk.kty !== "RSA") continue;
      keys.set(
        jwk.kid,
        await crypto.subtle.importKey(
          "jwk",
          jwk,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          false,
          ["verify"],
        ),
      );
    }
    if (keys.size === 0) return null;
    const entry = { keys, fetchedAt: Date.now() };
    cache.set(host, entry);
    return entry;
  } catch {
    return null;
  }
}

async function signingKey(host: string, kid: string): Promise<CryptoKey | "unavailable" | null> {
  let entry = cache.get(host);
  const fresh = entry && Date.now() - entry.fetchedAt < JWKS_TTL_MS;
  if (!entry || !fresh) {
    const loaded = await loadKeys(host);
    if (loaded) entry = loaded;
    else if (!entry) return "unavailable"; // no keys at all: refuse, do not guess
  }
  const hit = entry.keys.get(kid);
  if (hit) return hit;
  // Unknown kid: Cloudflare rotates keys, so refetch once (rate limited), then give up.
  if (Date.now() - entry.fetchedAt >= JWKS_MIN_REFRESH_MS) {
    const loaded = await loadKeys(host);
    if (loaded) return loaded.keys.get(kid) ?? null;
  }
  return null;
}

/** Reads the Access JWT from the header, else the CF_Authorization cookie. */
export function accessTokenFrom(headers: Headers): string | null {
  const header = headers.get("cf-access-jwt-assertion");
  if (header) return header.trim();
  const cookie = headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "CF_Authorization") return rest.join("=") || null;
  }
  return null;
}

export async function verifyAccessJwt(env: Bindings, token: string | null): Promise<AccessResult> {
  const host = accessTeamHost(env);
  const aud = env.CF_ACCESS_AUD?.trim();
  if (!host || !aud) return { ok: false, reason: "unconfigured" };
  if (!token) return { ok: false, reason: "missing" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [h, p, s] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  let signature: Uint8Array;
  try {
    header = JSON.parse(new TextDecoder().decode(fromB64u(h)));
    payload = JSON.parse(new TextDecoder().decode(fromB64u(p)));
    signature = fromB64u(s);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    return { ok: false, reason: "malformed" };
  }
  const key = await signingKey(host, header.kid);
  if (key === "unavailable") return { ok: false, reason: "keys_unavailable" };
  if (!key) return { ok: false, reason: "unknown_key" };
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature as BufferSource,
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!valid) return { ok: false, reason: "bad_signature" };

  if (payload.iss !== `https://${host}`) return { ok: false, reason: "bad_issuer" };
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) return { ok: false, reason: "bad_audience" };
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp + CLOCK_SKEW_SECONDS <= now) {
    return { ok: false, reason: "expired" };
  }
  if (typeof payload.nbf === "number" && payload.nbf - CLOCK_SKEW_SECONDS > now) {
    return { ok: false, reason: "not_yet_valid" };
  }
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email) return { ok: false, reason: "no_email" };
  return { ok: true, email, bypass: false };
}

export type AccessEnv = AppEnv & { Variables: { accessEmail: string } };

/** Lock 1. Runs on every /api/admin/** request (not on CORS preflights, which carry no credentials). */
export const requireAccess: MiddlewareHandler<AccessEnv> = async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  if (devBypassEnabled(c.env)) {
    const email = (c.req.header(DEV_EMAIL_HEADER) ?? "").trim().toLowerCase();
    if (!email) {
      return c.json(authError("access_denied", "Access is required."), 403);
    }
    c.set("accessEmail", email);
    return next();
  }
  const result = await verifyAccessJwt(c.env, accessTokenFrom(c.req.raw.headers));
  if (!result.ok) {
    if (result.reason === "unconfigured" || result.reason === "keys_unavailable") {
      console.error("admin access unavailable", result.reason);
      return c.json(authError("admin_unavailable", "The admin area is not available."), 503);
    }
    // One answer for every rejection, so the response does not say which check failed.
    console.error("admin access denied", result.reason);
    return c.json(authError("access_denied", "Access is required."), 403);
  }
  c.set("accessEmail", result.email);
  await next();
};
