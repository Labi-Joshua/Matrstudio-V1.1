import { waitlistSignupSchema } from "@matr/types";
import { describe, expect, it } from "vitest";
import { signVerifyToken, verifyVerifyToken } from "../src/lib/token";

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
