import { describe, expect, it } from "vitest";
import {
  INITIAL_SAVED,
  insertEntry,
  isPendingId,
  isSavedId,
  isValidResourceId,
  resolveSaved,
  type SavedEntry,
  type SavedState,
  savedCountText,
  savedReducer,
  sortNewestFirst,
} from "./saved-state";

const e = (resourceId: string, savedAt: number): SavedEntry => ({ resourceId, savedAt });
const ready = (entries: SavedEntry[], pending: string[] = []): SavedState => ({
  status: "ready",
  entries,
  pending,
});

describe("ordering", () => {
  it("sorts newest first and keeps arrival order for equal times", () => {
    expect(
      sortNewestFirst([e("a", 1), e("b", 3), e("c", 3), e("d", 2)]).map((x) => x.resourceId),
    ).toEqual(["b", "c", "d", "a"]);
  });

  it("inserts at the right place and replaces the same id", () => {
    const list = [e("c", 30), e("a", 10)];
    expect(insertEntry(list, e("b", 20)).map((x) => x.resourceId)).toEqual(["c", "b", "a"]);
    expect(insertEntry(list, e("a", 40))).toEqual([e("a", 40), e("c", 30)]);
    expect(list).toHaveLength(2);
  });
});

describe("loading", () => {
  it("goes loading -> ready (sorted) or error, and back to loading on reload", () => {
    expect(INITIAL_SAVED.status).toBe("loading");
    const loaded = savedReducer(INITIAL_SAVED, { type: "loaded", entries: [e("a", 1), e("b", 2)] });
    expect(loaded.status).toBe("ready");
    expect(loaded.entries.map((x) => x.resourceId)).toEqual(["b", "a"]);
    const failed = savedReducer(INITIAL_SAVED, { type: "load-failed" });
    expect(failed.status).toBe("error");
    expect(savedReducer(failed, { type: "load" }).status).toBe("loading");
  });
});

describe("optimistic changes", () => {
  it("adds at the top, marks pending, then settles with the server time", () => {
    let s = ready([e("a", 10)]);
    s = savedReducer(s, { type: "add", entry: e("b", 20) });
    expect(s.entries.map((x) => x.resourceId)).toEqual(["b", "a"]);
    expect(isSavedId(s, "b")).toBe(true);
    expect(isPendingId(s, "b")).toBe(true);
    s = savedReducer(s, { type: "settled", resourceId: "b", entry: e("b", 25) });
    expect(s.entries[0]).toEqual(e("b", 25));
    expect(isPendingId(s, "b")).toBe(false);
  });

  it("rolls a failed save back", () => {
    let s = ready([e("a", 10)]);
    s = savedReducer(s, { type: "add", entry: e("b", 20) });
    s = savedReducer(s, { type: "rollback-add", resourceId: "b" });
    expect(s).toEqual(ready([e("a", 10)]));
  });

  it("drops at once and rolls a failed remove back to the same place", () => {
    const start = ready([e("c", 30), e("b", 20), e("a", 10)]);
    let s = savedReducer(start, { type: "drop", resourceId: "b" });
    expect(s.entries.map((x) => x.resourceId)).toEqual(["c", "a"]);
    expect(isPendingId(s, "b")).toBe(true);
    s = savedReducer(s, { type: "rollback-drop", entry: e("b", 20) });
    expect(s).toEqual(start);
  });

  it("settles a remove without bringing the entry back", () => {
    let s = savedReducer(ready([e("a", 10)]), { type: "drop", resourceId: "a" });
    s = savedReducer(s, { type: "settled", resourceId: "a" });
    expect(s).toEqual(ready([]));
  });

  it("does not list an id twice as pending", () => {
    let s = savedReducer(ready([]), { type: "add", entry: e("a", 1) });
    s = savedReducer(s, { type: "add", entry: e("a", 2) });
    expect(s.pending).toEqual(["a"]);
    expect(s.entries).toEqual([e("a", 2)]);
  });
});

describe("resolving against the catalogue", () => {
  it("keeps saved order and skips ids that no longer exist", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(resolveSaved(["c", "gone", "a"], items)).toEqual([{ id: "c" }, { id: "a" }]);
    expect(resolveSaved([], items)).toEqual([]);
  });
});

describe("text and ids", () => {
  it("counts in plain words", () => {
    expect(savedCountText(1)).toBe("1 saved resource");
    expect(savedCountText(12)).toBe("12 saved resources");
  });

  it("matches the API's id pattern", () => {
    for (const ok of ["a", "sample-3", "9-lives", "a".repeat(64)])
      expect(isValidResourceId(ok)).toBe(true);
    for (const bad of ["", "-a", "A", "a_b", "a.b", "a".repeat(65), "a b"])
      expect(isValidResourceId(bad)).toBe(false);
  });
});
