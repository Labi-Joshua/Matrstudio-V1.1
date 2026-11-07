import { describe, expect, it } from "vitest";
import { checkLink, findInLibrary, normaliseUrlKey, stripHttpsPrefix } from "./submit-url";

describe("checkLink", () => {
  it("accepts a link typed without the prefix and one with https://", () => {
    expect(checkLink("youtube.com/watch?v=abc")).toEqual({
      ok: true,
      url: "https://youtube.com/watch?v=abc",
    });
    expect(checkLink("  https://Example.com/a ")).toEqual({
      ok: true,
      url: "https://example.com/a",
    });
  });

  it("refuses an empty link", () => {
    expect(checkLink("   ")).toEqual({ ok: false, problem: "empty" });
  });

  it("refuses anything that is not https", () => {
    for (const bad of [
      "http://example.com",
      "javascript:alert(1)",
      "ftp://x.com/a",
      "data:text/html,hi",
    ]) {
      expect(checkLink(bad)).toEqual({ ok: false, problem: "scheme" });
    }
  });

  it("does not mistake host:port for a scheme", () => {
    expect(checkLink("example.com:8080/x").ok).toBe(true);
  });

  it("refuses credentials in the link", () => {
    expect(checkLink("https://user:pw@example.com/a")).toEqual({
      ok: false,
      problem: "credentials",
    });
  });

  it("refuses hosts that cannot be public", () => {
    for (const bad of [
      "localhost/a",
      "192.168.0.1/a",
      "intranet/a",
      "https://[::1]/a",
      "nas.local/a",
    ]) {
      expect(checkLink(bad)).toEqual({ ok: false, problem: "invalid" });
    }
  });

  it("refuses spaces and very long links", () => {
    expect(checkLink("exa mple.com")).toEqual({ ok: false, problem: "invalid" });
    expect(checkLink(`example.com/${"a".repeat(2100)}`)).toEqual({
      ok: false,
      problem: "too_long",
    });
  });
});

describe("stripHttpsPrefix", () => {
  it("removes a pasted https:// so the field never shows it twice", () => {
    expect(stripHttpsPrefix("https://a.com/x")).toBe("a.com/x");
    expect(stripHttpsPrefix("HTTPS://a.com")).toBe("a.com");
    expect(stripHttpsPrefix("a.com")).toBe("a.com");
  });
});

describe("normaliseUrlKey", () => {
  it("is equal for spellings of the same page", () => {
    const a = normaliseUrlKey("https://www.YouTube.com/watch/?v=1&utm_source=x#t=3");
    const b = normaliseUrlKey("youtube.com/watch?v=1");
    expect(a).toBe(b);
    expect(a).toBe("youtube.com/watch?v=1");
  });

  it("keeps meaningful parameters apart and sorts them", () => {
    expect(normaliseUrlKey("a.com/p?b=2&a=1")).toBe("a.com/p?a=1&b=2");
    expect(normaliseUrlKey("a.com/p?v=1")).not.toBe(normaliseUrlKey("a.com/p?v=2"));
  });

  it("returns null for an unusable link", () => {
    expect(normaliseUrlKey("http://a.com")).toBeNull();
  });
});

describe("findInLibrary", () => {
  const sources = [{ slug: "figma", name: "Figma" }];
  const resources = [
    {
      title: "Auto layout, explained",
      url: "https://www.figma.com/blog/auto-layout/",
      sourceSlug: "figma",
    },
    { title: "No link yet", url: "", sourceSlug: "figma" },
  ];

  it("matches a resource by normalised link and names its source", () => {
    expect(findInLibrary("figma.com/blog/auto-layout?utm_medium=a", resources, sources)).toEqual({
      title: "Auto layout, explained",
      sourceName: "Figma",
    });
  });

  it("never matches when nothing has a link or the link differs", () => {
    expect(findInLibrary("figma.com/other", resources, sources)).toBeNull();
    expect(findInLibrary("figma.com/blog/auto-layout", [], sources)).toBeNull();
    expect(findInLibrary("", resources, sources)).toBeNull();
  });
});
