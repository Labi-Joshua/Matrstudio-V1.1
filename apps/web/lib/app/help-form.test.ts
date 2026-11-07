import { describe, expect, it } from "vitest";
import {
  buildMailto,
  CONTACT_TOPICS,
  contactMailto,
  normaliseReportLink,
  reportMailto,
  validateContact,
  validateReport,
} from "./help-form";

describe("validateContact", () => {
  const good = { topic: CONTACT_TOPICS[0] ?? "", message: "Help please", replyTo: "" };

  it("accepts a topic and a message; reply-to is optional", () => {
    expect(validateContact(good)).toEqual({});
  });

  it("flags a missing topic and a blank message", () => {
    const errors = validateContact({ topic: "", message: "   ", replyTo: "" });
    expect(Object.keys(errors)).toEqual(["topic", "message"]);
  });

  it("validates a reply-to address only when given", () => {
    expect(validateContact({ ...good, replyTo: "nope" }).replyTo).toBeDefined();
    expect(validateContact({ ...good, replyTo: "a@b.co" }).replyTo).toBeUndefined();
  });
});

describe("validateReport and links", () => {
  it("needs a kind and details", () => {
    expect(Object.keys(validateReport({ kind: "", detail: "", link: "" }))).toEqual([
      "kind",
      "detail",
    ]);
    expect(validateReport({ kind: "broken", detail: "It broke", link: "" })).toEqual({});
  });

  it("accepts https links with or without the prefix and refuses the rest", () => {
    expect(normaliseReportLink("")).toBeNull();
    expect(normaliseReportLink("matrstudio.com/a")).toBe("https://matrstudio.com/a");
    expect(normaliseReportLink("http://a.com")).toBeUndefined();
    expect(normaliseReportLink("javascript:alert(1)")).toBeUndefined();
    expect(normaliseReportLink("https://u:p@a.com")).toBeUndefined();
    expect(validateReport({ kind: "link", detail: "x", link: "ftp://a.com" }).link).toBeDefined();
  });
});

describe("mailto", () => {
  it("goes to hello@matrstudio.com with an encoded subject and body", () => {
    const href = buildMailto("Hi & bye", ["line one", "line two"]);
    expect(href.startsWith("mailto:hello@matrstudio.com?subject=Hi%20%26%20bye&body=")).toBe(true);
    expect(href).toContain("line%20one%0Aline%20two");
  });

  it("strips line breaks from the subject so it cannot inject headers", () => {
    const subject = buildMailto("a\r\nBcc: x@y.z", []).split("&body")[0] ?? "";
    expect(subject).not.toContain("%0D");
    expect(subject).not.toContain("%0A");
  });

  it("falls back to the account email for the reply address", () => {
    const draft = { topic: "Something else", message: "Hello", replyTo: "" };
    expect(decodeURIComponent(contactMailto(draft, "me@x.com"))).toContain("Reply to: me@x.com");
    expect(
      decodeURIComponent(contactMailto({ ...draft, replyTo: "o@x.com" }, "me@x.com")),
    ).toContain("Reply to: o@x.com");
  });

  it("includes the cleaned link in a report", () => {
    const text = decodeURIComponent(
      reportMailto({ kind: "link", detail: "dead", link: "a.com/x" }, "me@x.com"),
    );
    expect(text).toContain("Problem report: Broken link");
    expect(text).toContain("Page or link: https://a.com/x");
  });
});
