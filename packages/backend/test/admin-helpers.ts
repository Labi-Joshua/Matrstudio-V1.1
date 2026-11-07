import { createHash, createHmac } from "node:crypto";
import { vi } from "vitest";
import { resetAccessKeyCache } from "../src/auth/access";
import { issueAdminInvite } from "../src/auth/admin-invites";
import { base32Decode } from "../src/auth/totp";
import type { Bindings } from "../src/env";
import { createApp, GOOD_PASSWORD } from "./helpers";

export const ADMIN_ORIGIN = "https://admin.matrstudio.com";
export const TEAM = "matr";
export const AUD = "test-aud-tag-0123456789abcdef";
export const ADMIN_PASSWORD = GOOD_PASSWORD;

type Pair = { kid: string; privateKey: CryptoKey; jwk: JsonWebKey & { kid: string } };

export async function makeKeyPair(kid: string): Promise<Pair> {
  const kp = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", kp.publicKey)) as JsonWebKey;
  return { kid, privateKey: kp.privateKey, jwk: { ...jwk, kid, alg: "RS256", use: "sig" } };
}

const b64u = (b: Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : b;
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

export type JwtOpts = {
  email?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  nbf?: number;
  kid?: string;
  alg?: string;
  omitEmail?: boolean;
};

export async function signAccessJwt(key: Pair, o: JwtOpts = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: o.alg ?? "RS256", kid: o.kid ?? key.kid, typ: "JWT" }));
  const payload = b64u(
    JSON.stringify({
      iss: o.iss ?? `https://${TEAM}.cloudflareaccess.com`,
      aud: o.aud ?? [AUD],
      ...(o.omitEmail ? {} : { email: o.email ?? "owner@example.com" }),
      iat: now,
      exp: o.exp ?? now + 3600,
      ...(o.nbf !== undefined ? { nbf: o.nbf } : {}),
      type: "app",
    }),
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key.privateKey,
      new TextEncoder().encode(`${header}.${payload}`),
    ),
  );
  return `${header}.${payload}.${b64u(sig)}`;
}

/** Stubs fetch: Access JWKS for the test team (`keys` is read on every call) and HIBP "not breached". */
export function stubAccessFetch(getKeys: () => Pair[]) {
  const calls = { certs: 0 };
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === `https://${TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`) {
      calls.certs++;
      return Response.json({
        keys: getKeys().map((k) => k.jwk),
        public_cert: {},
        public_certs: [],
      });
    }
    if (url.includes("pwnedpasswords.com")) {
      const sha1 = createHash("sha1").update(BREACHED_PASSWORD).digest("hex").toUpperCase();
      const prefix = url.split("/range/")[1] ?? "";
      return new Response(
        sha1.startsWith(prefix)
          ? `${sha1.slice(5)}:99\r\n`
          : "0000000000000000000000000000000000A:1\r\n",
      );
    }
    return new Response("not stubbed", { status: 500 });
  });
  vi.stubGlobal("fetch", spy);
  return { spy, calls };
}

/** The one password the HIBP stub reports as breached. */
export const BREACHED_PASSWORD = "password123456";

/** Synchronous TOTP (node:crypto, independent of the module under test). */
export const codeNow = (secret: Uint8Array, offsetSeconds = 0) => {
  const step = Math.floor((Date.now() / 1000 + offsetSeconds) / 30);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", secret).update(msg).digest();
  const off = (mac[19] as number) & 15;
  const bin = new DataView(mac.buffer, mac.byteOffset).getUint32(off) & 0x7fffffff;
  return String(bin % 1_000_000).padStart(6, "0");
};

export type AdminApp = Awaited<ReturnType<typeof createAdminApp>>;

export async function createAdminApp(overrides: Partial<Bindings> = {}) {
  resetAccessKeyCache();
  const key = await makeKeyPair("kid-1");
  const keys = [key];
  const fetchStub = stubAccessFetch(() => keys);
  const app = createApp({
    CF_ACCESS_TEAM_DOMAIN: TEAM,
    CF_ACCESS_AUD: AUD,
    PUBLIC_ADMIN_URL: ADMIN_ORIGIN,
    ...overrides,
  });

  type Opts = {
    method?: string;
    body?: unknown;
    cookie?: string;
    as?: string | null; // the Access identity (email); null = no Access token
    origin?: string | null;
    headers?: Record<string, string>;
    jwt?: JwtOpts;
  };
  async function call(path: string, o: Opts = {}) {
    const headers: Record<string, string> = { ...(o.headers ?? {}) };
    if (o.as !== null) {
      headers["cf-access-jwt-assertion"] = await signAccessJwt(key, {
        email: o.as ?? "owner@example.com",
        ...o.jwt,
      });
    }
    const res = await app.call(path, {
      method: o.method,
      body: o.body,
      cookie: o.cookie,
      origin: o.origin === undefined ? ADMIN_ORIGIN : o.origin,
      headers,
    });
    const adminSet = res.setCookies.find((c) => c.startsWith("__Host-ms_admin_session="));
    return { ...res, adminCookie: adminSet?.split(";")[0], adminSetCookie: adminSet };
  }

  /**
   * Invite -> accept -> enrol through the real endpoints. Returns a signed-in admin: its session
   * cookie, the TOTP secret (to make codes) and the backup codes.
   */
  async function enrolAdmin(email: string, roleId = "super_admin", name?: string) {
    const invite = await issueAdminInvite(app.env, { email, roleId, createdBy: null, name });
    const accept = await call("/api/admin/invite/accept", {
      as: email,
      body: { token: invite.token, password: ADMIN_PASSWORD, ...(name ? { name } : {}) },
    });
    if (accept.status !== 200) throw new Error(`accept failed ${accept.status} ${accept.text}`);
    const uri = new URL(accept.json.otpauthUri as string);
    const secret = base32Decode(uri.searchParams.get("secret") as string);
    const enrol = await call("/api/admin/invite/enrol", {
      as: email,
      body: { token: invite.token, code: codeNow(secret) },
    });
    if (enrol.status !== 200) throw new Error(`enrol failed ${enrol.status} ${enrol.text}`);
    return {
      email,
      adminId: invite.adminId,
      invite,
      secret,
      cookie: enrol.adminCookie as string,
      backupCodes: enrol.json.backupCodes as string[],
      accept,
      enrol,
    };
  }

  /** Full sign-in (password + a code for the next step). Returns the new cookie. */
  async function signIn(a: { email: string; secret: Uint8Array }, password = ADMIN_PASSWORD) {
    const step1 = await call("/api/admin/sign-in", {
      as: a.email,
      body: { email: a.email, password },
    });
    if (step1.status !== 200) return { step1, step2: null, cookie: undefined };
    // the enrolment/previous code used the current step: the next one is valid inside the +-1 window
    app.sqlite.prepare("UPDATE admin_users SET totp_last_step = 0 WHERE email = ?").run(a.email);
    const step2 = await call("/api/admin/sign-in/mfa", {
      as: a.email,
      cookie: step1.adminCookie,
      body: { code: codeNow(a.secret) },
    });
    return { step1, step2, cookie: step2.adminCookie };
  }

  const audit = (action: string) =>
    app.sqlite.prepare("SELECT * FROM audit_log WHERE action = ?").all(action) as Array<
      Record<string, unknown>
    >;

  return { ...app, key, keys, fetchStub, call, enrolAdmin, signIn, audit };
}
