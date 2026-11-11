import { describe, expect, it } from "vitest";
import { LEVEL_TEXT } from "../pages/browse-library";
import { aboutText, nextOpenState, openMode, reportLinkMailto, resourceHost } from "./detail-state";
import type { LibraryItem } from "./library-data";

const item: LibraryItem = {
  id: "res-1",
  title: "Turning research into insights",
  url: "https://www.nngroup.com/articles/x",
  sourceSlug: "nng",
  sourceName: "Nielsen Norman Group",
  format: "article",
  lengthLabel: "8 min read",
  topicName: "Product",
  level: "beginner",
  kind: "article",
  topicSlug: null,
  sample: false,
};

describe("resourceHost", () => {
  it("drops www and the path", () => expect(resourceHost(item.url)).toBe("nngroup.com"));
  it("is empty for no or a bad url", () => {
    expect(resourceHost("")).toBe("");
    expect(resourceHost("nope")).toBe("");
  });
});

describe("aboutText", () => {
  it("describes an article with the right article word", () => {
    expect(aboutText(item, (l) => LEVEL_TEXT[l])).toBe(
      "A beginner article on Product, from Nielsen Norman Group. Length: 8 min read.",
    );
  });
  it("uses an before a vowel and skips the missing level", () => {
    const text = aboutText({ ...item, level: null }, (l) => LEVEL_TEXT[l]);
    expect(text.startsWith("An article on Product")).toBe(true);
  });
  it("says tools are free", () => {
    const tool = { ...item, kind: "tool" as const, level: "advanced" as const };
    expect(aboutText(tool, (l) => LEVEL_TEXT[l])).toContain("An advanced tool");
    expect(aboutText(tool, (l) => LEVEL_TEXT[l])).toContain("Free to use.");
  });
});

describe("openMode", () => {
  it("opens the reading window only for articles on wide screens", () => {
    expect(openMode("article", true)).toBe("window");
    expect(openMode("article", false)).toBe("tab");
    expect(openMode("video", true)).toBe("tab");
    expect(openMode("tool", true)).toBe("tab");
  });
});

describe("nextOpenState", () => {
  it("moves between idle, window and tab", () => {
    expect(nextOpenState("idle", "open-window")).toBe("window");
    expect(nextOpenState("window", "close-window")).toBe("idle");
    expect(nextOpenState("idle", "open-tab")).toBe("tab");
    expect(nextOpenState("tab", "close-window")).toBe("tab");
  });
});

describe("reportLinkMailto", () => {
  it("builds a mailto with the resource and no raw newlines", () => {
    const href = reportLinkMailto(item, "a@b.co");
    expect(href.startsWith("mailto:")).toBe(true);
    expect(href).not.toMatch(/\n/);
    expect(decodeURIComponent(href)).toContain("Link: https://www.nngroup.com/articles/x");
    expect(decodeURIComponent(href)).toContain("Reply to: a@b.co");
  });
});
