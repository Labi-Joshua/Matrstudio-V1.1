import { describe, expect, it } from "vitest";
import {
  MESSAGES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordRules,
  validateCurrentPassword,
  validateEmail,
  validateFullName,
  validateNewPassword,
  validatePasswordConfirmation,
  validateTerms,
} from "./validation";

describe("validateEmail", () => {
  it("accepts ordinary addresses and trims spaces", () => {
    expect(validateEmail("ada@example.com")).toBeNull();
    expect(validateEmail("  ada+tag@mail.example.co.uk ")).toBeNull();
  });
  it("uses the Figma wording for bad ones", () => {
    for (const bad of ["", "ada", "ada@example", "ada@", "@example.com", "a b@example.com"]) {
      expect(validateEmail(bad)).toBe("Enter a valid email address, like name@example.com.");
    }
  });
  it("rejects absurdly long addresses", () => {
    expect(validateEmail(`${"a".repeat(250)}@example.com`)).toBe(MESSAGES.email);
  });
});

describe("passwords", () => {
  it("matches the server limits", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
    expect(validateNewPassword("a".repeat(11))).toBe(MESSAGES.passwordTooShort);
    expect(validateNewPassword("a".repeat(12))).toBeNull();
    expect(validateNewPassword("a".repeat(128))).toBeNull();
    expect(validateNewPassword("a".repeat(129))).toBe(MESSAGES.passwordTooLong);
    expect(validateNewPassword("")).toBe(MESSAGES.passwordRequired);
  });
  it("only needs a value to sign in", () => {
    expect(validateCurrentPassword("x")).toBeNull();
    expect(validateCurrentPassword("")).toBe(MESSAGES.passwordRequired);
  });
  it("checks the confirmation", () => {
    expect(validatePasswordConfirmation("abc", "abc")).toBeNull();
    expect(validatePasswordConfirmation("abc", "abd")).toBe(MESSAGES.passwordMismatch);
    expect(validatePasswordConfirmation("abc", "")).toBe(MESSAGES.confirmRequired);
  });
  it("lists the length rule as met only in range", () => {
    expect(passwordRules("short")[0]?.met).toBe(false);
    expect(passwordRules("a".repeat(12))[0]?.met).toBe(true);
    expect(passwordRules("a".repeat(129))[0]?.met).toBe(false);
  });
});

describe("other fields", () => {
  it("validates name and terms with the Figma wording", () => {
    expect(validateFullName("  ")).toBe("Enter your full name.");
    expect(validateFullName("Ada Lovelace")).toBeNull();
    expect(validateTerms(false)).toBe(
      "Agree to the Terms of Service and Privacy Policy to continue.",
    );
    expect(validateTerms(true)).toBeNull();
  });
});
