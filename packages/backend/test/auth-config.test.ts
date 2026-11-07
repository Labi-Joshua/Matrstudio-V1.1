import { afterEach, describe, expect, it, vi } from "vitest";
import { authSecretProblem } from "../src/middleware/auth-config";
import { createApp, stubFetch } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

const PATHS = ["/api/auth/get-session", "/api/me", "/api/me/sessions", "/api/admin/me"] as const;

describe("fails closed without a proper BETTER_AUTH_SECRET", () => {
  const cases: [string, string | undefined][] = [
    ["unset", undefined],
    ["empty", ""],
    ["too short", "short-secret"],
    ["the library default", "better-auth-secret-12345678901234567890"],
  ];

  for (const [name, secret] of cases) {
    it(`answers 503 on every auth, account and admin route when the secret is ${name}`, async () => {
      stubFetch();
      const app = createApp({
        BETTER_AUTH_SECRET: secret as string,
        ENVIRONMENT: "production",
      });
      for (const path of PATHS) {
        const res = await app.call(path);
        expect(res.status, path).toBe(503);
        expect(res.json.code, path).toBe("auth_unavailable");
      }
      const signUp = await app.call("/api/auth/sign-up/email", {
        body: { email: "a@example.com", password: "a long enough password 99", name: "A" },
      });
      expect(signUp.status).toBe(503);
    });
  }

  it("still serves the non-auth routes", async () => {
    stubFetch();
    const app = createApp({ BETTER_AUTH_SECRET: undefined as unknown as string });
    expect((await app.call("/health")).status).toBe(200);
  });

  it("works normally with a good secret", async () => {
    stubFetch();
    const app = createApp();
    expect((await app.call("/api/me")).status).toBe(401);
  });

  it("describes the problem", () => {
    expect(authSecretProblem(undefined)).toMatch(/not set/);
    expect(authSecretProblem("x".repeat(31))).toMatch(/shorter/);
    expect(authSecretProblem("x".repeat(32))).toBeNull();
  });
});
