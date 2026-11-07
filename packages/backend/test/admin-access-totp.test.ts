import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAccessKeyCache } from "../src/auth/access";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateBackupCodes,
  hashBackupCode,
  normaliseBackupCode,
  signInviteToken,
  verifyInviteToken,
} from "../src/auth/admin-secrets";
import { base32Decode, base32Encode, otpauthUri, totpAt, verifyTotp } from "../src/auth/totp";
import {
  ADMIN_ORIGIN,
  AUD,
  createAdminApp,
  makeKeyPair,
  signAccessJwt,
  TEAM,
} from "./admin-helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetAccessKeyCache();
});

describe("TOTP (RFC 6238 vectors, SHA-1)", () => {
  const secret = new TextEncoder().encode("12345678901234567890");
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])("T=%i gives the 8-digit code %s", async (t, expected) => {
    expect(await totpAt(secret, t, 8)).toBe(expected);
  });

  it("6-digit codes are the last 6 digits of the 8-digit vector", async () => {
    expect(await totpAt(secret, 59)).toBe("287082");
  });

  it("accepts the previous, current and next step and nothing else", async () => {
    const t = 1_700_000_000;
    expect(await verifyTotp(secret, await totpAt(secret, t - 30), t)).toBe(Math.floor(t / 30) - 1);
    expect(await verifyTotp(secret, await totpAt(secret, t), t)).toBe(Math.floor(t / 30));
    expect(await verifyTotp(secret, await totpAt(secret, t + 30), t)).toBe(Math.floor(t / 30) + 1);
    expect(await verifyTotp(secret, await totpAt(secret, t - 90), t)).toBeNull();
    expect(await verifyTotp(secret, await totpAt(secret, t + 90), t)).toBeNull();
    expect(await verifyTotp(secret, "12345", t)).toBeNull();
    expect(await verifyTotp(secret, "abcdef", t)).toBeNull();
  });

  it("base32 round-trips and the otpauth URI carries issuer, period and digits", () => {
    expect(base32Encode(base32Decode("JBSWY3DPEHPK3PXP"))).toBe("JBSWY3DPEHPK3PXP");
    const uri = otpauthUri(secret, "a@b.co");
    expect(uri.startsWith("otpauth://totp/Matr%20Studio:a%40b.co?")).toBe(true);
    expect(uri).toContain("period=30");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("algorithm=SHA1");
  });
});

describe("admin secrets", () => {
  const env = { BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123" };
  it("TOTP secrets are encrypted at rest and bound to the admin id", async () => {
    const secret = new Uint8Array(20).fill(7);
    const enc = await encryptTotpSecret(env, "admin-1", secret);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain(base32Encode(secret));
    expect(await decryptTotpSecret(env, "admin-1", enc)).toEqual(secret);
    expect(await decryptTotpSecret(env, "admin-2", enc)).toBeNull(); // moved to another row
    expect(
      await decryptTotpSecret({ BETTER_AUTH_SECRET: "x".repeat(40) }, "admin-1", enc),
    ).toBeNull();
    // a dedicated key takes over when set
    const withKey = await encryptTotpSecret(
      { ...env, ADMIN_TOTP_KEY: "k".repeat(40) },
      "a",
      secret,
    );
    expect(await decryptTotpSecret(env, "a", withKey)).toBeNull();
  });

  it("backup codes are 10 distinct single-format codes and hash per admin", async () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
    const n = normaliseBackupCode(codes[0] as string) as string;
    expect(normaliseBackupCode(` ${(codes[0] as string).toUpperCase()} `)).toBe(n);
    expect(normaliseBackupCode("short")).toBeNull();
    const h1 = await hashBackupCode(env, "a", n);
    expect(h1).not.toContain(n);
    expect(await hashBackupCode(env, "b", n)).not.toBe(h1);
  });

  it("invite tokens are signed: tampering and garbage fail verification", async () => {
    const id = crypto.randomUUID();
    const token = await signInviteToken(env, id);
    expect(await verifyInviteToken(env, token)).toBe(id);
    const [a, b, c] = token.split(".") as [string, string, string];
    expect(await verifyInviteToken(env, `${a}.${b}.${c.slice(0, -2)}AA`)).toBeNull();
    expect(await verifyInviteToken(env, `${crypto.randomUUID()}.${b}.${c}`)).toBeNull();
    expect(await verifyInviteToken(env, "garbage")).toBeNull();
    expect(await verifyInviteToken({ BETTER_AUTH_SECRET: "y".repeat(40) }, token)).toBeNull();
  });
});

describe("Lock 1: Cloudflare Access JWT on every /api/admin request", () => {
  // Reaching 401 "unauthorized" means lock 1 passed and the missing admin session stopped it.
  const passed = (r: { status: number; json: Record<string, unknown> }) =>
    r.status === 401 && r.json.code === "unauthorized";

  it("accepts a validly signed token and extracts the verified email", async () => {
    const app = await createAdminApp();
    expect(passed(await app.call("/api/admin/me"))).toBe(true);
  });

  it("accepts the token from the CF_Authorization cookie when the header is absent", async () => {
    const app = await createAdminApp();
    const jwt = await signAccessJwt(app.key);
    const res = await app.call("/api/admin/me", { as: null, cookie: `CF_Authorization=${jwt}` });
    expect(passed(res)).toBe(true);
  });

  it("rejects a missing token (403 access_denied)", async () => {
    const app = await createAdminApp();
    const res = await app.call("/api/admin/me", { as: null });
    expect(res.status).toBe(403);
    expect(res.json.code).toBe("access_denied");
  });

  it("rejects a header that is merely present", async () => {
    const app = await createAdminApp();
    for (const v of ["1", "true", "x.y.z", "a.b"]) {
      const res = await app.call("/api/admin/me", {
        as: null,
        headers: { "cf-access-jwt-assertion": v },
      });
      expect(res.status).toBe(403);
    }
  });

  it("does not fall back to the cookie when the header is present but invalid", async () => {
    const app = await createAdminApp();
    const good = await signAccessJwt(app.key);
    const res = await app.call("/api/admin/me", {
      as: null,
      headers: { "cf-access-jwt-assertion": "junk" },
      cookie: `CF_Authorization=${good}`,
    });
    expect(res.status).toBe(403);
  });

  it.each([
    ["wrong aud", { aud: ["someone-elses-app"] }],
    ["wrong iss", { iss: "https://evil.cloudflareaccess.com" }],
    ["expired", { exp: Math.floor(Date.now() / 1000) - 3600 }],
    ["not yet valid", { nbf: Math.floor(Date.now() / 1000) + 3600 }],
    ["no email claim (service token)", { omitEmail: true }],
    ["HS256 alg", { alg: "HS256" }],
  ])("rejects %s", async (_n, jwt) => {
    const app = await createAdminApp();
    const res = await app.call("/api/admin/me", { jwt });
    expect(res.status).toBe(403);
    expect(res.json.code).toBe("access_denied");
  });

  it("accepts aud given as a plain string", async () => {
    const app = await createAdminApp();
    expect(passed(await app.call("/api/admin/me", { jwt: { aud: AUD } }))).toBe(true);
  });

  it("rejects a bad signature (right kid, someone else's key)", async () => {
    const app = await createAdminApp();
    const other = await makeKeyPair("kid-1");
    const jwt = await signAccessJwt(other);
    const res = await app.call("/api/admin/me", {
      as: null,
      headers: { "cf-access-jwt-assertion": jwt },
    });
    expect(res.status).toBe(403);
  });

  it("rejects an unknown kid, refetching the keys at most once a minute", async () => {
    const app = await createAdminApp();
    expect(passed(await app.call("/api/admin/me"))).toBe(true);
    expect(app.fetchStub.calls.certs).toBe(1);
    const stranger = await makeKeyPair("kid-unknown");
    const jwt = await signAccessJwt(stranger);
    for (let i = 0; i < 3; i++) {
      const res = await app.call("/api/admin/me", {
        as: null,
        headers: { "cf-access-jwt-assertion": jwt },
      });
      expect(res.status).toBe(403);
    }
    expect(app.fetchStub.calls.certs).toBe(1); // no refetch inside the minimum interval
  });

  it("picks up a rotated key: unknown kid refetches once the interval has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const app = await createAdminApp();
    expect(passed(await app.call("/api/admin/me"))).toBe(true);
    const rotated = await makeKeyPair("kid-2");
    app.keys.push(rotated);
    vi.setSystemTime(Date.now() + 61_000);
    const jwt = await signAccessJwt(rotated, { email: "owner@example.com" });
    const res = await app.call("/api/admin/me", {
      as: null,
      headers: { "cf-access-jwt-assertion": jwt },
    });
    expect(passed(res)).toBe(true);
    expect(app.fetchStub.calls.certs).toBe(2);
  });

  it("fails closed (503) in production when Access is not configured", async () => {
    for (const unset of [
      { CF_ACCESS_TEAM_DOMAIN: undefined },
      { CF_ACCESS_AUD: undefined },
      { CF_ACCESS_TEAM_DOMAIN: undefined, CF_ACCESS_AUD: undefined },
    ]) {
      const app = await createAdminApp({ ENVIRONMENT: "production", ...unset });
      const res = await app.call("/api/admin/me");
      expect(res.status).toBe(503);
      expect(res.json.code).toBe("admin_unavailable");
      const signIn = await app.call("/api/admin/sign-in", {
        body: { email: "a@b.co", password: "x" },
      });
      expect(signIn.status).toBe(503);
    }
  });

  it("fails closed in development too when unconfigured and no bypass is set", async () => {
    const app = await createAdminApp({
      CF_ACCESS_TEAM_DOMAIN: undefined,
      CF_ACCESS_AUD: undefined,
    });
    expect((await app.call("/api/admin/me")).status).toBe(503);
  });

  it("fails closed when the key set cannot be fetched", async () => {
    const app = await createAdminApp();
    app.keys.length = 0; // JWKS answers with no keys
    const res = await app.call("/api/admin/me");
    expect(res.status).toBe(503);
  });

  it("rejects a team domain that is not a Cloudflare Access host (no fetch to arbitrary hosts)", async () => {
    const app = await createAdminApp({ CF_ACCESS_TEAM_DOMAIN: "evil.example.com" });
    const res = await app.call("/api/admin/me");
    expect(res.status).toBe(503);
    expect(app.fetchStub.calls.certs).toBe(0);
  });

  it("dev bypass works only with ENVIRONMENT=development and the explicit flag", async () => {
    const app = await createAdminApp({
      CF_ACCESS_TEAM_DOMAIN: undefined,
      CF_ACCESS_AUD: undefined,
      ADMIN_DEV_BYPASS_ACCESS: "true",
    });
    const res = await app.call("/api/admin/me", {
      as: null,
      headers: { "x-dev-access-email": "dev@example.com" },
    });
    expect(passed(res)).toBe(true);
    // the bypass still needs an identity
    expect((await app.call("/api/admin/me", { as: null })).status).toBe(403);
    // and other flag values do nothing
    const off = await createAdminApp({
      CF_ACCESS_TEAM_DOMAIN: undefined,
      CF_ACCESS_AUD: undefined,
      ADMIN_DEV_BYPASS_ACCESS: "1",
    });
    expect(
      (
        await off.call("/api/admin/me", {
          as: null,
          headers: { "x-dev-access-email": "dev@example.com" },
        })
      ).status,
    ).toBe(503);
  });

  it("dev bypass is impossible in production, configured or not", async () => {
    for (const env of [
      {
        ENVIRONMENT: "production" as const,
        CF_ACCESS_TEAM_DOMAIN: undefined,
        CF_ACCESS_AUD: undefined,
      },
      { ENVIRONMENT: "production" as const },
      {
        ENVIRONMENT: undefined as never,
        CF_ACCESS_TEAM_DOMAIN: undefined,
        CF_ACCESS_AUD: undefined,
      },
      {
        ENVIRONMENT: "staging" as never,
        CF_ACCESS_TEAM_DOMAIN: undefined,
        CF_ACCESS_AUD: undefined,
      },
    ]) {
      const app = await createAdminApp({ ...env, ADMIN_DEV_BYPASS_ACCESS: "true" });
      const res = await app.call("/api/admin/me", {
        as: null,
        headers: { "x-dev-access-email": "dev@example.com" },
      });
      expect([403, 503]).toContain(res.status);
      expect(res.json.code).not.toBe("unauthorized"); // never got past lock 1
    }
  });
});

describe("admin origin, headers and CORS", () => {
  it("requires the admin origin on state-changing admin requests, and not the learner one", async () => {
    const app = await createAdminApp();
    const body = { email: "a@b.co", password: "x" };
    expect((await app.call("/api/admin/sign-in", { body, origin: null })).status).toBe(403);
    expect(
      (await app.call("/api/admin/sign-in", { body, origin: "https://matrstudio.com" })).status,
    ).toBe(403);
    expect(
      (await app.call("/api/admin/sign-in", { body, origin: "https://evil.example" })).status,
    ).toBe(403);
    expect((await app.call("/api/admin/sign-in", { body, origin: ADMIN_ORIGIN })).status).not.toBe(
      403,
    );
  });

  it("does not let the admin origin call learner state-changing routes", async () => {
    const app = await createAdminApp({ ALLOWED_ORIGINS: `https://matrstudio.com,${ADMIN_ORIGIN}` });
    const res = await app.call("/api/auth/sign-in/email", {
      as: null,
      body: { email: "a@b.co", password: "x" },
      origin: ADMIN_ORIGIN,
    });
    expect(res.status).toBe(403);
  });

  it("sets no-store and the security headers on admin responses", async () => {
    const app = await createAdminApp();
    const res = await app.call("/api/admin/me");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("CORS allows credentials only for the admin origin on admin paths", async () => {
    const app = await createAdminApp();
    const ok = await app.call("/api/admin/me", { origin: ADMIN_ORIGIN });
    expect(ok.headers.get("access-control-allow-origin")).toBe(ADMIN_ORIGIN);
    expect(ok.headers.get("access-control-allow-credentials")).toBe("true");
    const learner = await app.call("/api/admin/me", { origin: "https://matrstudio.com" });
    expect(learner.headers.get("access-control-allow-origin")).toBeNull();
    const l = await app.call("/api/me", { as: null, origin: ADMIN_ORIGIN });
    expect(l.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("uses the TEAM constant for the issuer (sanity)", () => {
    expect(TEAM).toBe("matr");
  });
});
