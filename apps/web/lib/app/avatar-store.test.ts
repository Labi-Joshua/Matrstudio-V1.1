import { describe, expect, it } from "vitest";
import { createAvatarStore } from "./avatar-store";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("avatar store", () => {
  it("reads once for an owner and shares the answer", async () => {
    let calls = 0;
    const store = createAvatarStore(async () => {
      calls += 1;
      return "/api/avatars/u1?v=1";
    });
    store.load("a@x.com");
    store.load("a@x.com");
    await tick();
    store.load("a@x.com");
    expect(calls).toBe(1);
    expect(store.getSnapshot()).toEqual({ owner: "a@x.com", url: "/api/avatars/u1?v=1" });
  });

  it("falls back to no photo when the read fails or throws", async () => {
    const store = createAvatarStore(async () => {
      throw new Error("offline");
    });
    store.load("a@x.com");
    await tick();
    expect(store.getSnapshot()).toEqual({ owner: "a@x.com", url: null });
  });

  it("starts over for another learner and ignores a stale answer", async () => {
    const urls: Record<string, string> = { a: "/api/avatars/a", b: "/api/avatars/b" };
    let current = "a";
    const store = createAvatarStore(async () => {
      const mine = current;
      await tick();
      return urls[mine] ?? null;
    });
    store.load("a");
    current = "b";
    store.load("b");
    await tick();
    await tick();
    expect(store.getSnapshot()).toEqual({ owner: "b", url: "/api/avatars/b" });
  });

  it("reads again after refresh, with the new URL", async () => {
    let version = 1;
    const store = createAvatarStore(async () => `/api/avatars/u1?v=${version}`);
    store.load("a");
    await tick();
    version = 2;
    store.refresh();
    await tick();
    expect(store.getSnapshot().url).toBe("/api/avatars/u1?v=2");
  });
});
