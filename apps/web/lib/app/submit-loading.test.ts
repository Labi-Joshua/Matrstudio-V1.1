import { describe, expect, it } from "vitest";
import { SKELETON_MIN_MS, skeletonHoldMs } from "./submit-loading";

describe("skeletonHoldMs", () => {
  it("keeps a fresh skeleton up for the minimum time", () => {
    expect(skeletonHoldMs(1000, 1000)).toBe(SKELETON_MIN_MS);
    expect(skeletonHoldMs(1000, 1100)).toBe(SKELETON_MIN_MS - 100);
  });
  it("releases it once the minimum has passed", () => {
    expect(skeletonHoldMs(1000, 1000 + SKELETON_MIN_MS)).toBe(0);
    expect(skeletonHoldMs(1000, 9000)).toBe(0);
  });
});
