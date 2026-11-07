import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, GOOD_PASSWORD, stubFetch } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

const audit = (app: ReturnType<typeof createApp>, action: string) =>
  app.sqlite.prepare("SELECT * FROM audit_log WHERE action = ?").all(action) as Array<
    Record<string, unknown>
  >;

const shape = (v: unknown): unknown =>
  v && typeof v === "object"
    ? Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, typeof x === "object" ? shape(x) : typeof x]),
      )
    : typeof v;

describe("no account enumeration", () => {
  it("sign-in answers the same for a known email with a wrong password and an unknown email", async () => {
    stubFetch();
    const app = createApp();
    await app.signUpConfirmed("ada@example.com");
    const known = await app.signIn("ada@example.com", "definitely the wrong one 1");
    const unknown = await app.signIn("nobody@example.com", "definitely the wrong one 1");
    expect(known.status).toBe(401);
    expect(unknown.status).toBe(known.status);
    expect(unknown.json).toEqual(known.json);
  });

  it.each([["/api/auth/sign-in/magic-link"], ["/api/auth/request-password-reset"]])(
    "%s answers the same for known and unknown emails, with consistent timing",
    async (path) => {
      stubFetch();
      const app = createApp();
      await app.signUpConfirmed("ada@example.com");
      const time = async (email: string) => {
        const t = performance.now();
        const res = await app.call(path, { body: { email } });
        return { res, ms: performance.now() - t };
      };
      const known = await time("ada@example.com");
      const unknown = await time("nobody@example.com");
      expect(unknown.res.status).toBe(known.res.status);
      expect(shape(unknown.res.json)).toEqual(shape(known.res.json));
      // Both are padded to the same floor (60 ms in tests), so they cannot be told apart.
      expect(Math.abs(known.ms - unknown.ms)).toBeLessThan(120);
      expect(known.ms).toBeGreaterThanOrEqual(55);
      expect(unknown.ms).toBeGreaterThanOrEqual(55);
    },
  );

  it("sign-in timing for a known and an unknown account is comparable (dummy hash)", async () => {
    stubFetch();
    const app = createApp({ PASSWORD_SCRYPT_N: "16384" });
    await app.signUpConfirmed("ada@example.com");
    const time = async (email: string) => {
      const t = performance.now();
      await app.signIn(email, "definitely the wrong one 1");
      return performance.now() - t;
    };
    await time("ada@example.com"); // warm up
    const a = [await time("ada@example.com"), await time("ada@example.com")];
    const b = [await time("nobody1@example.com"), await time("nobody2@example.com")];
    const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
    expect(Math.abs(mean(a) - mean(b))).toBeLessThan(Math.max(80, mean(a) * 0.6));
  });

  it("documented exceptions: email_already_registered on sign-up, email_not_verified on correct credentials", async () => {
    stubFetch();
    const app = createApp();
    const first = await app.call("/api/auth/sign-up/email", {
      body: { email: "ada@example.com", password: GOOD_PASSWORD, name: "Ada" },
    });
    expect(first.status).toBe(200);
    const dup = await app.call("/api/auth/sign-up/email", {
      body: { email: "ADA@example.com", password: GOOD_PASSWORD, name: "Ada" },
    });
    expect(dup.status).toBe(422);
    expect(dup.json.code).toBe("email_already_registered");
    // Unconfirmed: correct password gets email_not_verified (and a fresh link), wrong password is generic.
    const before = app.emails.filter((e) => e.type === "confirm-email").length;
    const right = await app.signIn("ada@example.com");
    expect(right.status).toBe(403);
    expect(right.json.code).toBe("email_not_verified");
    expect(app.emails.filter((e) => e.type === "confirm-email").length).toBe(before + 1);
    const wrong = await app.signIn("ada@example.com", "definitely the wrong one 1");
    expect(wrong.status).toBe(401);
    expect(wrong.json.code).toBe("INVALID_EMAIL_OR_PASSWORD");
  });
});

describe("rate limits", () => {
  it("sign-in: 5 per 15 minutes per email, then 429 too_many_attempts, an audit row and an owner notice", async () => {
    stubFetch();
    const app = createApp();
    await app.signUpConfirmed("ada@example.com");
    for (let i = 0; i < 5; i++) {
      expect(
        (await app.signIn("ada@example.com", `wrong password number ${i} x`)).status,
      ).toBeLessThan(429);
    }
    const blocked = await app.signIn("ada@example.com", GOOD_PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.json.code).toBe("too_many_attempts");
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(blocked.json.retryAfterSeconds).toBeGreaterThan(0);
    expect(audit(app, "rate_limit.hit").length).toBe(1);
    expect(app.last("too-many-attempts")?.to).toBe("ada@example.com");
    // Not an account oracle: an unknown address is blocked identically but nobody is emailed.
    for (let i = 0; i < 5; i++)
      await app.signIn("ghost@example.com", `wrong password number ${i} x`);
    const ghost = await app.signIn("ghost@example.com", GOOD_PASSWORD);
    expect(ghost.status).toBe(429);
    expect(ghost.json.code).toBe("too_many_attempts");
    expect(app.emails.filter((e) => e.type === "too-many-attempts").length).toBe(1);
  });

  it("sign-in: 20 per 15 minutes per IP", async () => {
    stubFetch();
    const app = createApp();
    const ip = { "cf-connecting-ip": "203.0.113.9" };
    for (let i = 0; i < 20; i++) {
      const r = await app.call("/api/auth/sign-in/email", {
        body: { email: `user${i}@example.com`, password: "wrong password here 1" },
        headers: ip,
      });
      expect(r.status).toBe(401);
    }
    const blocked = await app.call("/api/auth/sign-in/email", {
      body: { email: "user99@example.com", password: "wrong password here 1" },
      headers: ip,
    });
    expect(blocked.status).toBe(429);
    expect(blocked.json.code).toBe("rate_limited");
    // Another network is unaffected.
    const other = await app.call("/api/auth/sign-in/email", {
      body: { email: "user99@example.com", password: "wrong password here 1" },
      headers: { "cf-connecting-ip": "198.51.100.4" },
    });
    expect(other.status).toBe(401);
  });

  it("magic link: 5 per 15 minutes per email", async () => {
    stubFetch();
    const app = createApp();
    for (let i = 0; i < 5; i++) {
      expect(
        (await app.call("/api/auth/sign-in/magic-link", { body: { email: "ada@example.com" } }))
          .status,
      ).toBe(200);
    }
    const blocked = await app.call("/api/auth/sign-in/magic-link", {
      body: { email: "ada@example.com" },
    });
    expect(blocked.status).toBe(429);
    expect(blocked.json.code).toBe("rate_limited");
    expect(audit(app, "rate_limit.hit").length).toBe(1);
  });

  it("password reset: 3 per hour per email", async () => {
    stubFetch();
    const app = createApp();
    for (let i = 0; i < 3; i++) {
      expect(
        (await app.call("/api/auth/request-password-reset", { body: { email: "ada@example.com" } }))
          .status,
      ).toBe(200);
    }
    const blocked = await app.call("/api/auth/request-password-reset", {
      body: { email: "ada@example.com" },
    });
    expect(blocked.status).toBe(429);
    expect(blocked.json.code).toBe("rate_limited");
  });

  it("sign-up: 10 per hour per IP", async () => {
    stubFetch();
    const app = createApp();
    const ip = { "cf-connecting-ip": "203.0.113.50" };
    for (let i = 0; i < 10; i++) {
      const r = await app.call("/api/auth/sign-up/email", {
        body: { email: `new${i}@example.com`, password: GOOD_PASSWORD, name: "N" },
        headers: ip,
      });
      expect(r.status).toBe(200);
    }
    const blocked = await app.call("/api/auth/sign-up/email", {
      body: { email: "new10@example.com", password: GOOD_PASSWORD, name: "N" },
      headers: ip,
    });
    expect(blocked.status).toBe(429);
    expect(blocked.json.code).toBe("rate_limited");
  });

  it("verification email resend: 3 per hour per email, with a stable code", async () => {
    stubFetch();
    const app = createApp();
    await app.call("/api/auth/sign-up/email", {
      body: { email: "ada@example.com", password: GOOD_PASSWORD, name: "Ada" },
    });
    for (let i = 0; i < 3; i++) {
      expect(
        (
          await app.call("/api/auth/send-verification-email", {
            body: { email: "ada@example.com" },
          })
        ).status,
      ).toBe(200);
    }
    const blocked = await app.call("/api/auth/send-verification-email", {
      body: { email: "ada@example.com" },
    });
    expect(blocked.status).toBe(429);
    expect(blocked.json.code).toBe("resend_limit_reached");
    expect(audit(app, "rate_limit.hit").length).toBe(1);
  });

  it("counters reset when the window passes", async () => {
    stubFetch();
    const app = createApp();
    const { hit } = await import("../src/auth/limits");
    const rule = { limit: 2, windowSec: 60 };
    expect((await hit(app.db, "k", rule, 1000)).allowed).toBe(true);
    expect((await hit(app.db, "k", rule, 1001)).allowed).toBe(true);
    expect((await hit(app.db, "k", rule, 1002)).allowed).toBe(false);
    expect((await hit(app.db, "k", rule, 1061)).allowed).toBe(true);
  });
});

describe("Turnstile", () => {
  const withSecret = { TURNSTILE_SECRET: "turnstile-test-secret" };

  it("is required on sign-up, reset request and magic-link request", async () => {
    stubFetch();
    const app = createApp(withSecret);
    const paths: Array<[string, unknown]> = [
      ["/api/auth/sign-up/email", { email: "a@example.com", password: GOOD_PASSWORD, name: "A" }],
      ["/api/auth/request-password-reset", { email: "a@example.com" }],
      ["/api/auth/sign-in/magic-link", { email: "a@example.com" }],
    ];
    for (const [path, body] of paths) {
      const missing = await app.call(path, { body });
      expect(missing.status).toBe(400);
      expect(missing.json.code).toBe("captcha_required");
      const ok = await app.call(path, { body, headers: { "x-captcha-response": "good-token" } });
      expect(ok.status).toBe(200);
    }
  });

  it("rejects a failed token and writes an audit event", async () => {
    stubFetch((url) =>
      url.includes("challenges.cloudflare.com") ? Response.json({ success: false }) : undefined,
    );
    const app = createApp(withSecret);
    const res = await app.call("/api/auth/request-password-reset", {
      body: { email: "a@example.com" },
      headers: { "x-captcha-response": "bad" },
    });
    expect(res.status).toBe(400);
    expect(res.json.code).toBe("captcha_failed");
    expect(audit(app, "turnstile.failed").length).toBe(1);
  });

  it("sign-in needs it only after 3 failed attempts for that email", async () => {
    stubFetch();
    const app = createApp(withSecret);
    // Sign-up itself needs a token under this config.
    const captcha = { "x-captcha-response": "good" };
    await app.call("/api/auth/sign-up/email", {
      body: { email: "ada@example.com", password: GOOD_PASSWORD, name: "Ada" },
      headers: captcha,
    });
    const link = app.last("confirm-email")?.link ?? "";
    await app.call(new URL(link).pathname + new URL(link).search, { origin: null });
    for (let i = 0; i < 3; i++) {
      const r = await app.signIn("ada@example.com", `wrong password number ${i} x`);
      expect(r.status).toBe(401);
    }
    const needs = await app.signIn("ada@example.com");
    expect(needs.status).toBe(400);
    expect(needs.json.code).toBe("captcha_required");
    const ok = await app.signIn("ada@example.com", GOOD_PASSWORD, captcha);
    expect(ok.status).toBe(200);
    // A success clears the failure counter.
    expect(
      app.sqlite.prepare("SELECT COUNT(*) n FROM rate_limits WHERE key LIKE 'signinfail:%'").get(),
    ).toEqual({ n: 0 });
  });

  it("is skipped without a secret outside production, and fails closed in production", async () => {
    stubFetch();
    const dev = createApp();
    expect(
      (await dev.call("/api/auth/request-password-reset", { body: { email: "a@example.com" } }))
        .status,
    ).toBe(200);
    const prod = createApp({ ENVIRONMENT: "production" });
    const res = await prod.call("/api/auth/request-password-reset", {
      body: { email: "a@example.com" },
    });
    expect(res.status).toBe(503);
    expect(res.json.code).toBe("captcha_unavailable");
  });
});

describe("password policy", () => {
  it("enforces length 12 to 128", async () => {
    stubFetch();
    const app = createApp();
    const tooShort = await app.call("/api/auth/sign-up/email", {
      body: { email: "b@example.com", password: "elevenchars", name: "B" },
    });
    expect(tooShort.status).toBe(400);
    expect(tooShort.json.code).toBe("PASSWORD_TOO_SHORT");
    const tooLong = await app.call("/api/auth/sign-up/email", {
      body: { email: "c@example.com", password: "x".repeat(129), name: "C" },
    });
    expect(tooLong.status).toBe(400);
    expect(tooLong.json.code).toBe("PASSWORD_TOO_LONG");
    const edge = await app.call("/api/auth/sign-up/email", {
      body: { email: "d@example.com", password: "y".repeat(128), name: "D" },
    });
    expect(edge.status).toBe(200);
  });

  it("rejects a breached password (k-anonymity: only a 5 character prefix leaves the Worker)", async () => {
    const password = "password1234567";
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const spy = stubFetch((url) =>
      url.includes("pwnedpasswords.com") ? new Response(`${sha1.slice(5)}:42\r\n`) : undefined,
    );
    const app = createApp();
    const res = await app.call("/api/auth/sign-up/email", {
      body: { email: "a@example.com", password, name: "A" },
    });
    expect(res.status).toBe(400);
    expect(res.json.code).toBe("PASSWORD_COMPROMISED");
    const hibp = spy.mock.calls.map((c) => String(c[0])).find((u) => u.includes("pwnedpasswords"));
    expect(hibp).toBe(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`);
    expect(app.sqlite.prepare("SELECT COUNT(*) n FROM user").get()).toEqual({ n: 0 });
  });

  it("fails open when the breach check is down, and logs an event", async () => {
    stubFetch((url) =>
      url.includes("pwnedpasswords.com") ? new Response("down", { status: 503 }) : undefined,
    );
    const app = createApp();
    const res = await app.call("/api/auth/sign-up/email", {
      body: { email: "a@example.com", password: GOOD_PASSWORD, name: "A" },
    });
    expect(res.status).toBe(200);
    expect(audit(app, "pwned_check.unavailable").length).toBe(1);
  });

  it("stores a self-describing scrypt hash", async () => {
    stubFetch();
    const app = createApp();
    await app.signUpConfirmed("ada@example.com");
    const row = app.sqlite
      .prepare("SELECT password FROM account WHERE providerId = 'credential'")
      .get() as {
      password: string;
    };
    expect(row.password).toMatch(/^scrypt\$N=\d+,r=8,p=1\$[\w-]+\$[\w-]+$/);
    expect(row.password).not.toContain(GOOD_PASSWORD);
  });
});

describe("waitlist invites", () => {
  async function invite(app: ReturnType<typeof createApp>, email = "waiting@example.com") {
    const { issueInvite } = await import("../src/auth/invites");
    return issueInvite(app.env, { email, createdBy: "test" });
  }
  const accept = (
    app: ReturnType<typeof createApp>,
    token: string,
    extra: Record<string, unknown> = {},
  ) =>
    app.call("/api/auth/invite/accept", {
      body: { token, name: "Wendy", password: GOOD_PASSWORD, ...extra },
    });

  it("creates a confirmed, signed-in account bound to the invited email; single use", async () => {
    stubFetch();
    const app = createApp();
    const inv = await invite(app);
    expect(inv.link.startsWith("https://matrstudio.com/invite?token=")).toBe(true);
    const row = app.sqlite
      .prepare("SELECT token_hash, expires_at, created_at FROM invites")
      .get() as {
      token_hash: string;
      expires_at: number;
      created_at: number;
    };
    expect(row.token_hash).not.toContain(inv.token);
    expect(row.expires_at - row.created_at).toBeGreaterThanOrEqual(72 * 3600 - 2);
    expect(row.expires_at - row.created_at).toBeLessThanOrEqual(72 * 3600 + 2);

    const ok = await accept(app, inv.token);
    expect(ok.status).toBe(200);
    expect(ok.cookie).toBeTruthy();
    const me = await app.call("/api/me", { cookie: ok.cookie });
    expect(me.json.email).toBe("waiting@example.com");
    expect(me.json.emailVerified).toBe(true);
    expect(audit(app, "invite.created").length).toBe(1);
    expect(audit(app, "invite.accepted").length).toBe(1);

    const reuse = await accept(app, inv.token);
    expect(reuse.status).toBe(400);
    expect(reuse.json.code).toBe("invite_invalid");
  });

  it("rejects tampered and expired invites with the same answer", async () => {
    stubFetch();
    const app = createApp();
    const inv = await invite(app);
    const tampered = await accept(
      app,
      `${inv.token.slice(0, -1)}${inv.token.endsWith("a") ? "b" : "a"}`,
    );
    expect(tampered.status).toBe(400);
    expect(tampered.json.code).toBe("invite_invalid");
    app.sqlite.prepare("UPDATE invites SET expires_at = unixepoch() - 1").run();
    const expired = await accept(app, inv.token);
    expect(expired.status).toBe(400);
    expect(expired.json).toEqual(tampered.json);
  });

  it("applies the password policy, and does not burn the invite on a rejected password", async () => {
    stubFetch();
    const app = createApp();
    const inv = await invite(app);
    expect((await accept(app, inv.token, { password: "short" })).status).toBe(400);
    expect((await accept(app, inv.token)).status).toBe(200);
  });
});
