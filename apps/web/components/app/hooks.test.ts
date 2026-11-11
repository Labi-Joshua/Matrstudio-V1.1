import { describe, expect, it } from "vitest";
import { SKELETON_DELAY_MS, SKELETON_MIN_MS, skeletonRemainingMs } from "./hooks";

describe("skeleton timing", () => {
  it("waits about 150 ms before showing and keeps about 300 ms once shown", () => {
    expect(SKELETON_DELAY_MS).toBe(150);
    expect(SKELETON_MIN_MS).toBe(300);
  });

  it("holds the skeleton for the rest of its minimum time", () => {
    expect(skeletonRemainingMs(1000, 1100)).toBe(200);
    expect(skeletonRemainingMs(1000, 1300)).toBe(0);
    expect(skeletonRemainingMs(1000, 5000)).toBe(0);
  });
});
