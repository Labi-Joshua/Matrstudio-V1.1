import { describe, expect, it } from "vitest";
import { isProfilePath } from "./profile-path";

describe("isProfilePath", () => {
  it("matches /@name only", () => {
    expect(isProfilePath("/@ada")).toBe(true);
    expect(isProfilePath("/@Ada_9/")).toBe(true);
    for (const no of ["/@", "/ada", "/@ada/x", "/@a-b", "/u", "/api/@ada"])
      expect(isProfilePath(no), no).toBe(false);
  });
});
