import { describe, expect, it } from "vitest";
import { confirmEmail } from "../src/lib/email-templates";

const input = {
  link: "https://api.example.com/api/waitlist/verify?token=abc.123&x=1",
  email: "alex@example.com",
  webUrl: "https://example.com",
  expiresIn: "7 days",
};

describe("confirmEmail", () => {
  it("uses the Figma subject and preview text", () => {
    const { subject, html } = confirmEmail(input);
    expect(subject).toBe("Confirm your email to join Matr Studio");
    expect(html).toContain("One click and your spot on the waitlist is saved.");
  });

  it("links the button and the fallback to the verification URL (HTML-escaped)", () => {
    const { html } = confirmEmail(input);
    const escaped = "https://api.example.com/api/waitlist/verify?token=abc.123&#38;x=1";
    expect(html.split(`href="${escaped}"`).length - 1).toBe(2);
  });

  it("escapes the recipient address and states the expiry", () => {
    const { html, text } = confirmEmail({ ...input, email: `<b>"x"</b>@example.com` });
    expect(html).not.toContain("<b>");
    expect(html).toContain("This link expires in 7 days.");
    expect(text).toContain(input.link);
  });

  it("serves images from the website as PNG", () => {
    const { html } = confirmEmail(input);
    expect(html).toContain('src="https://example.com/images/email/logo.png"');
    expect(html).not.toMatch(/\.svg"/);
  });
});
