import { describe, expect, it } from "vitest";
import {
  agoLabel,
  canSendChange,
  changeMessage,
  firstName,
  hideMessage,
  initialsOf,
  safeHref,
  shortUrl,
  waitingLabel,
} from "./format";

describe("labels", () => {
  it("formats waiting and ago", () => {
    expect(waitingLabel(0)).toBe("Today");
    expect(waitingLabel(1)).toBe("1 day");
    expect(waitingLabel(4)).toBe("4 days");
    expect(agoLabel(0)).toBe("today");
    expect(agoLabel(4)).toBe("4 days ago");
  });
  it("names", () => {
    expect(firstName("Kemi Bello")).toBe("Kemi");
    expect(firstName("")).toBe("them");
    expect(initialsOf("Kemi Bello")).toBe("KB");
    expect(initialsOf("quick")).toBe("Q");
    expect(initialsOf("")).toBe("?");
  });
});

describe("links", () => {
  it("allows only http(s)", () => {
    expect(safeHref("https://figma.com/blog")).toBe("https://figma.com/blog");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("nope")).toBeNull();
    expect(safeHref(null)).toBeNull();
  });
  it("shortens", () => {
    expect(shortUrl("https://www.figma.com/blog/x")).toBe("figma.com/blog/x");
    expect(shortUrl("https://example.com/a-very-long-path-that-goes-on", 20)).toHaveLength(20);
  });
});

describe("messages", () => {
  it("builds the change message", () => {
    expect(changeMessage(["A", "B"], " note ")).toBe("- A\n- B\n\nnote");
    expect(changeMessage([], "only")).toBe("only");
    expect(canSendChange([], "  ")).toBe(false);
    expect(canSendChange(["A"], "")).toBe(true);
  });
  it("writes the hide message", () => {
    expect(hideMessage("spam")).toContain("(spam)");
  });
});
