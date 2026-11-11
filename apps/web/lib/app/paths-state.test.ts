import { describe, expect, it } from "vitest";
import { SAMPLE_PATHS } from "../pages/browse-paths";
import {
  filterMine,
  GATE_IDLE,
  gateStep,
  type MyPath,
  mineCountLabel,
  mineEmptyCopy,
  percentDone,
  progressLabel,
  STAR_HINT,
  STARRED_HINT,
  showMineFilters,
  starToastCopy,
} from "./paths-state";

const [a, b, c] = SAMPLE_PATHS;
if (!a || !b || !c) throw new Error("sample paths missing");
const items: MyPath[] = [
  { path: { ...a, lessons: 10 }, starred: false, done: 4 },
  { path: { ...b, lessons: 12 }, starred: true, done: null },
  { path: { ...c, lessons: 9 }, starred: true, done: 9 },
];

describe("skeleton gate", () => {
  it("stays hidden for a fast response", () => {
    const first = gateStep(GATE_IDLE, true, 1000);
    expect(first.show).toBe(false);
    expect(first.wakeIn).toBe(150);
    const done = gateStep(first.gate, false, 1100);
    expect(done.show).toBe(false);
    expect(done.gate).toEqual(GATE_IDLE);
  });

  it("shows after the delay and holds for the minimum", () => {
    const first = gateStep(GATE_IDLE, true, 0);
    const shown = gateStep(first.gate, true, 160);
    expect(shown.show).toBe(true);
    const early = gateStep(shown.gate, false, 200);
    expect(early.show).toBe(true);
    expect(early.wakeIn).toBe(260);
    expect(gateStep(early.gate, false, 460).show).toBe(false);
  });
});

describe("my paths", () => {
  it("filters by tab", () => {
    expect(filterMine(items, "all")).toHaveLength(3);
    expect(filterMine(items, "in-progress").map((i) => i.done)).toEqual([4]);
    expect(filterMine(items, "starred")).toHaveLength(2);
    expect(filterMine(items, "completed").map((i) => i.done)).toEqual([9]);
  });

  it("labels progress", () => {
    const first = items[0] as MyPath;
    expect(progressLabel(first)).toBe("Lesson 5 of 10 · 40%");
    expect(percentDone(first)).toBe(40);
    expect(progressLabel(items[1] as MyPath)).toBeNull();
    expect(progressLabel(items[2] as MyPath)).toBeNull();
  });

  it("has an empty state for every tab", () => {
    expect(mineEmptyCopy("all").title).toBe("Your paths will live here");
    expect(mineEmptyCopy("completed").action.to).toBe("in-progress");
    expect(mineEmptyCopy("starred").action.to).toBe("explore");
  });

  it("shows tab filters only once there are paths", () => {
    expect(showMineFilters([])).toBe(false);
    expect(showMineFilters(items)).toBe(true);
    expect(mineCountLabel(1)).toBe("1 path");
    expect(mineCountLabel(3)).toBe("3 paths");
  });
});

describe("starred state", () => {
  it("has the hints of the unstarred and starred buttons", () => {
    expect(STAR_HINT).toBe("Not sure it’s for you? Star it and it’ll wait in Your paths.");
    expect(STARRED_HINT).toBe("Saved to Your paths. Start whenever you’re ready.");
  });

  it("builds the toast copy", () => {
    const copy = starToastCopy("Product Design Essentials");
    expect(copy.title).toBe("Saved to Your paths");
    expect(copy.body).toBe(
      "Product Design Essentials is in your sidebar. Start whenever you’re ready.",
    );
  });
});
