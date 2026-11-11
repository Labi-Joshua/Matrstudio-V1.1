import { describe, expect, it } from "vitest";
import { trapTarget } from "./submit-dialog";

describe("trapTarget", () => {
  it("wraps forwards from the last element", () => {
    expect(trapTarget(3, 2, false)).toBe(0);
  });
  it("wraps backwards from the first element", () => {
    expect(trapTarget(3, 0, true)).toBe(2);
  });
  it("pulls stray focus back in", () => {
    expect(trapTarget(3, -1, false)).toBe(0);
    expect(trapTarget(3, -1, true)).toBe(2);
  });
  it("leaves the middle alone and handles an empty list", () => {
    expect(trapTarget(3, 1, false)).toBeNull();
    expect(trapTarget(3, 1, true)).toBeNull();
    expect(trapTarget(0, -1, false)).toBeNull();
  });
});
