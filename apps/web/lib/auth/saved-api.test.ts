import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiResult } from "./api";
import {
  listSaved,
  parseSavedList,
  parseSavedResource,
  saveResource,
  unsaveResource,
} from "./saved-api";

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

function mockFetch(response: Response) {
  const fn = vi.fn(async (..._args: unknown[]) => response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("parsing", () => {
  it("reads a saved row and rejects bad shapes", () => {
    expect(parseSavedResource({ resourceId: "a", savedAt: 5 })).toEqual({
      resourceId: "a",
      savedAt: 5,
    });
    for (const bad of [null, [], {}, { resourceId: "", savedAt: 1 }, { resourceId: "a" }]) {
      expect(parseSavedResource(bad)).toBeUndefined();
    }
    expect(parseSavedResource({ resourceId: "a", savedAt: "5" })).toBeUndefined();
  });

  it("drops unreadable rows but needs a list", () => {
    expect(parseSavedList({ saved: [{ resourceId: "a", savedAt: 2 }, { nope: 1 }, null] })).toEqual(
      [{ resourceId: "a", savedAt: 2 }],
    );
    expect(parseSavedList({ saved: "x" })).toBeUndefined();
    expect(parseSavedList(null)).toBeUndefined();
  });
});

describe("calls", () => {
  it("lists with GET and the session cookie", async () => {
    const fn = mockFetch(json({ saved: [{ resourceId: "a", savedAt: 9 }] }));
    const result = await listSaved();
    expect(result).toEqual({ ok: true, data: [{ resourceId: "a", savedAt: 9 }] });
    const [path, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/me/saved");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
  });

  it("saves with PUT and encodes the id", async () => {
    const fn = mockFetch(json({ saved: { resourceId: "a-b", savedAt: 3 } }));
    expect(await saveResource("a-b")).toEqual({
      ok: true,
      data: { resourceId: "a-b", savedAt: 3 },
    });
    const [path, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/me/saved/a-b");
    expect(init.method).toBe("PUT");
    expect(init.body).toBeUndefined();
    await saveResource("a/../b");
    expect((fn.mock.calls[1] as [string])[0]).toBe("/api/me/saved/a%2F..%2Fb");
  });

  it("removes with DELETE", async () => {
    const fn = mockFetch(json({ removed: true }));
    expect(await unsaveResource("a")).toEqual({ ok: true, data: true });
    expect((fn.mock.calls[0] as [string, RequestInit])[1].method).toBe("DELETE");
  });

  it("reports an unreadable success body as invalid_response", async () => {
    mockFetch(json({ saved: 1 }));
    const result = await saveResource("a");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_response");
  });

  it("maps saved_limit, rate_limited and 5xx answers", async () => {
    mockFetch(json({ code: "saved_limit", message: "full" }, { status: 409 }));
    let r: ApiResult<unknown> = await saveResource("a");
    expect(!r.ok && r.code).toBe("saved_limit");
    mockFetch(
      json({ code: "rate_limited", message: "slow", retryAfterSeconds: 30 }, { status: 429 }),
    );
    r = await saveResource("a");
    expect(!r.ok && r.code).toBe("rate_limited");
    expect(!r.ok && r.retryAfterSeconds).toBe(30);
    mockFetch(new Response("boom", { status: 500 }));
    r = await unsaveResource("a");
    expect(!r.ok && r.code).toBe("unknown_error");
  });

  it("answers network_error when fetch fails", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });
    const r = await listSaved();
    expect(!r.ok && r.code).toBe("network_error");
  });
});
