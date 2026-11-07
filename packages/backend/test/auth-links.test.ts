import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, stubFetch } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/auth/reset-password/check", () => {
  it("reports the token state without consuming it, and says nothing about accounts", async () => {
    stubFetch();
    const app = createApp();
    await app.signUpConfirmed("ada@example.com");
    await app.call("/api/auth/request-password-reset", { body: { email: "ada@example.com" } });
    await app.call("/api/auth/request-password-reset", { body: { email: "ghost@example.com" } });
    const token = new URL(app.last("reset-password")?.link ?? "").searchParams.get("token") ?? "";
    for (let i = 0; i < 3; i++) {
      const res = await app.call(`/api/auth/reset-password/check?token=${token}`);
      expect(res.json).toEqual({ status: "ok" }); // still usable after repeated checks
    }
    expect((await app.call("/api/auth/reset-password/check?token=nope")).json).toEqual({
      status: "invalid",
    });
    const done = await app.call("/api/auth/reset-password", {
      body: { newPassword: "a brand new passphrase 77", token },
    });
    expect(done.status).toBe(200);
    // Used: indistinguishable from unknown.
    expect((await app.call(`/api/auth/reset-password/check?token=${token}`)).json).toEqual({
      status: "invalid",
    });
  });

  it("is rate limited per IP with the stable rate_limited code", async () => {
    stubFetch();
    const app = createApp();
    const ip = { "cf-connecting-ip": "203.0.113.200" };
    for (let i = 0; i < 30; i++) {
      expect(
        (await app.call("/api/auth/reset-password/check?token=x", { headers: ip })).status,
      ).toBe(200);
    }
    const blocked = await app.call("/api/auth/reset-password/check?token=x", { headers: ip });
    expect(blocked.status).toBe(429);
    expect(blocked.json.code).toBe("rate_limited");
  });
});
