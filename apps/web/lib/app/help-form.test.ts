import { describe, expect, it } from "vitest";
import {
  buildMailto,
  CONTACT_TOPICS,
  contactMailto,
  linkWithoutScheme,
  MESSAGE_MAX,
  normaliseReportLink,
  parseReportContext,
  reportMailto,
  validateContact,
  validateReport,
} from "./help-form";

describe("validateContact", () => {
  const good = { topic: CONTACT_TOPICS[0] ?? "", message: "Help please" };

  it("accepts a topic and a message", () => {
    expect(validateContact(good)).toEqual({});
  });

  it("flags a missing topic and a blank message", () => {
    const errors = validateContact({ topic: "", message: "   " });
    expect(Object.keys(errors)).toEqual(["topic", "message"]);
  });

  it("refuses a message over the limit", () => {
    expect(
      validateContact({ ...good, message: "x".repeat(MESSAGE_MAX + 1) }).message,
    ).toBeDefined();
    expect(validateContact({ ...good, message: "x".repeat(MESSAGE_MAX) })).toEqual({});
  });
});

describe("validateReport and links", () => {
  it("needs a kind and details", () => {
    expect(Object.keys(validateReport({ kind: "", detail: "", link: "" }))).toEqual([
      "kind",
      "detail",
    ]);
    expect(validateReport({ kind: "broken", detail: "It broke badly", link: "" })).toEqual({});
  });

  it("accepts https links with or without the prefix and refuses the rest", () => {
    expect(normaliseReportLink("")).toBeNull();
    expect(normaliseReportLink("matrstudio.com/a")).toBe("https://matrstudio.com/a");
    expect(normaliseReportLink("http://a.com")).toBeUndefined();
    expect(normaliseReportLink("javascript:alert(1)")).toBeUndefined();
    expect(normaliseReportLink("https://u:p@a.com")).toBeUndefined();
    expect(
      validateReport({ kind: "link", detail: "A dead link here", link: "ftp://a.com" }).link,
    ).toBeDefined();
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

  it("replies to the account email", () => {
    const draft = { topic: "Something else", message: "Hello" };
    expect(decodeURIComponent(contactMailto(draft, "me@x.com"))).toContain("Reply to: me@x.com");
  });

  it("names the resource a report is about", () => {
    const context = { title: "Mapping user flows", where: "Lesson 5", link: "" };
    const text = decodeURIComponent(
      reportMailto({ kind: "link", detail: "dead", link: "" }, "me@x.com", context),
    );
    expect(text).toContain("About: Mapping user flows (Lesson 5)");
  });

  it("includes the cleaned link in a report", () => {
    const text = decodeURIComponent(
      reportMailto({ kind: "link", detail: "dead", link: "a.com/x" }, "me@x.com"),
    );
    expect(text).toContain("Problem report: Broken link");
    expect(text).toContain("Page or link: https://a.com/x");
  });
});

describe("parseReportContext", () => {
  it("needs a resource title", () => {
    expect(parseReportContext("")).toBeNull();
    expect(parseReportContext("?link=https://a.com")).toBeNull();
    expect(parseReportContext("?resource=%20%20")).toBeNull();
  });

  it("reads the title, where and a safe link", () => {
    const search =
      "?resource=Mapping%20user%20flows&where=Lesson%205&link=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3D1";
    const context = parseReportContext(search);
    expect(context).toEqual({
      title: "Mapping user flows",
      where: "Lesson 5",
      link: "https://youtube.com/watch?v=1",
    });
    expect(linkWithoutScheme(context?.link ?? "")).toBe("youtube.com/watch?v=1");
  });

  it("drops unsafe links and caps long text", () => {
    expect(parseReportContext("?resource=A&link=javascript:alert(1)")?.link).toBe("");
    expect(parseReportContext("?resource=A&link=http://a.com")?.link).toBe("");
    expect(parseReportContext(`?resource=${"x".repeat(500)}`)?.title.length).toBe(120);
  });
});
