import { waitlistSignupSchema } from "@matr/types";
import { describe, expect, it } from "vitest";
import {
  readVerifyToken,
  signVerifyToken,
  VERIFY_TTL_SECONDS,
  verifyVerifyToken,
} from "../src/lib/token";

describe("verification tokens", () => {
  it("round-trips an email", async () => {
    const token = await signVerifyToken("secret", "a@example.com");
    expect(await verifyVerifyToken("secret", token)).toBe("a@example.com");
  });

  it("rejects a wrong secret, a tampered payload and an expired token", async () => {
    const token = await signVerifyToken("secret", "a@example.com");
    expect(await verifyVerifyToken("other", token)).toBeNull();
    expect(await verifyVerifyToken("secret", `x${token}`)).toBeNull();
    const expired = await signVerifyToken("secret", "a@example.com", -10);
    expect(await verifyVerifyToken("secret", expired)).toBeNull();
  });
});

describe("readVerifyToken", () => {
  it("reads an expired token but flags it, so the page can offer a new link", async () => {
    const expired = await signVerifyToken("secret", "a@example.com", -10);
    const info = await readVerifyToken("secret", expired);
    expect(info?.email).toBe("a@example.com");
    expect(info?.expired).toBe(true);
  });

  it("returns null for a forged token, expired or not", async () => {
    const token = await signVerifyToken("secret", "a@example.com");
    expect(await readVerifyToken("other", token)).toBeNull();
    expect(await readVerifyToken("secret", "a.b.c")).toBeNull();
  });

  it("defaults to the 24-hour link lifetime", async () => {
    const before = Math.floor(Date.now() / 1000);
    const info = await readVerifyToken("secret", await signVerifyToken("secret", "a@example.com"));
    expect(VERIFY_TTL_SECONDS).toBe(24 * 3600);
    expect((info?.exp ?? 0) - before).toBeGreaterThanOrEqual(VERIFY_TTL_SECONDS - 1);
    expect(info?.expired).toBe(false);
  });
});

describe("waitlistSignupSchema", () => {
  it("lowercases and trims the email", () => {
    const parsed = waitlistSignupSchema.parse({ email: "  Ada@Example.COM " });
    expect(parsed.email).toBe("ada@example.com");
  });

  it("rejects malformed emails and referral codes", () => {
    expect(waitlistSignupSchema.safeParse({ email: "nope" }).success).toBe(false);
    expect(waitlistSignupSchema.safeParse({ email: "a@b.co", referralCode: "lower" }).success).toBe(
      false,
    );
  });
});
