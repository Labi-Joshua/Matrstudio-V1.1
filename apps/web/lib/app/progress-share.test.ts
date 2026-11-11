import { describe, expect, it, vi } from "vitest";
import { SAMPLE_PATHS } from "../pages/browse-paths";
import { emptyEntry } from "./progress-logic";
import {
  copyLink,
  displayUrl,
  keepGoing,
  linkedInUrl,
  shareOrCopy,
  shareText,
  shareUrl,
} from "./progress-share";

const [first, second, third] = SAMPLE_PATHS;
if (!first || !second || !third) throw new Error("sample paths missing");

describe("share links", () => {
  it("points at the public topic page, never an invented URL", () => {
    expect(shareUrl(second, "https://matrstudio.com")).toBe("https://matrstudio.com/paths/product");
    expect(displayUrl("https://matrstudio.com/paths/product")).toBe("matrstudio.com/paths/product");
    expect(shareText(second)).toBe("I finished Product Design Essentials on Matr Studio.");
    expect(linkedInUrl("https://matrstudio.com/paths/a b")).toBe(
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fmatrstudio.com%2Fpaths%2Fa%20b",
    );
  });
});

describe("share or copy", () => {
  it("uses the share sheet when there is one", async () => {
    const share = vi.fn(async () => {});
    const writeText = vi.fn(async () => {});
    expect(await shareOrCopy(second, "u", { share, writeText })).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: second.title, text: shareText(second), url: "u" });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("treats a dismissed sheet as cancelled, not as a failure", async () => {
    const share = vi.fn(async () => {
      throw new DOMException("no", "AbortError");
    });
    const writeText = vi.fn(async () => {});
    expect(await shareOrCopy(second, "u", { share, writeText })).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the link when sharing is missing or breaks", async () => {
    const writeText = vi.fn(async () => {});
    expect(await shareOrCopy(second, "u", { writeText })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("u");
    const broken = vi.fn(async () => {
      throw new Error("x");
    });
    expect(await shareOrCopy(second, "u", { share: broken, writeText })).toBe("copied");
  });

  it("reports a copy that is not possible", async () => {
    expect(await copyLink("u", {})).toBe("failed");
    expect(
      await copyLink("u", {
        writeText: async () => {
          throw new Error("denied");
        },
      }),
    ).toBe("failed");
  });
});

describe("keep going", () => {
  it("suggests the same topic first and skips the finished path and completed ones", () => {
    const picks = keepGoing(SAMPLE_PATHS, [], first);
    expect(picks).toHaveLength(2);
    expect(picks[0]?.topicSlug).toBe(first.topicSlug);
    expect(picks.map((p) => p.slug)).not.toContain(first.slug);
    const done = { ...emptyEntry(picks[0]?.slug ?? ""), completedAt: "2024-01-01T00:00:00.000Z" };
    expect(keepGoing(SAMPLE_PATHS, [done], first).map((p) => p.slug)).not.toContain(done.slug);
    expect(keepGoing([first], [], first)).toEqual([]);
  });
});
