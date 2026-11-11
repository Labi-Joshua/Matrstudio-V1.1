import { describe, expect, it } from "vitest";
import { bookmarkLabel, failureToast, removedToast, savedToast } from "./saved-toast";

describe("toasts", () => {
  it("confirms a save with a link to Saved", () => {
    expect(savedToast()).toMatchObject({
      title: "Saved to your library",
      action: "view-saved",
      tone: "success",
    });
  });

  it("names the removed resource, offers Undo and clips long titles", () => {
    const t = removedToast("Mapping user flows");
    expect(t.body).toBe("“Mapping user flows” is no longer saved.");
    expect(t.action).toBe("undo");
    expect(removedToast("x".repeat(100)).body.length).toBeLessThan(90);
    expect(removedToast(undefined).body).toBe("It is no longer saved.");
  });

  it("offers Retry for plain failures only", () => {
    expect(failureToast("unknown_error", "save")).toMatchObject({
      title: "Couldn’t save that",
      action: "retry",
    });
    expect(failureToast("network_error", "remove")).toMatchObject({
      title: "Couldn’t remove that",
      body: "Check your connection and try again.",
      action: "retry",
    });
    expect(failureToast("unknown_error", "load").title).toBe("Couldn’t load your saved list");
    for (const code of ["saved_limit", "rate_limited", "unauthorized"] as const) {
      expect(failureToast(code, "save").action).toBeNull();
    }
    expect(failureToast("saved_limit", "save").body).toMatch(/500/);
  });

  it("labels the bookmark with the resource name", () => {
    expect(bookmarkLabel("Auto layout", false)).toBe("Save Auto layout");
    expect(bookmarkLabel("Auto layout", true)).toBe("Remove Auto layout from saved");
  });
});
