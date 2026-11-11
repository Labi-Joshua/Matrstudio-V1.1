import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkUsername,
  getOwnProfile,
  getPublicProfile,
  parseOwnProfile,
  parsePublicProfile,
  parseUsernameCheck,
  removeAvatar,
  updateProfile,
  uploadAvatar,
} from "./profile-api";

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

function mockFetch(response: Response) {
  const fn = vi.fn(async (..._args: unknown[]) => response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

const own = {
  username: "ada",
  displayName: "Ada",
  bio: "Hi",
  avatarUrl: "/api/avatars/u1?v=3",
  isPublic: true,
  visibility: { stats: false, paths: true, submissions: true },
  createdAt: "2026-09-02T10:00:00.000Z",
  updatedAt: "2026-09-03T10:00:00.000Z",
};

describe("parseOwnProfile", () => {
  it("reads a profile", () => {
    expect(parseOwnProfile(own)).toEqual(own);
  });

  it("only trusts same-origin avatar urls", () => {
    expect(
      parseOwnProfile({ ...own, avatarUrl: "https://evil.example/x.png" })?.avatarUrl,
    ).toBeNull();
    expect(parseOwnProfile({ ...own, avatarUrl: "javascript:alert(1)" })?.avatarUrl).toBeNull();
    expect(parseOwnProfile({ ...own, avatarUrl: null })?.avatarUrl).toBeNull();
  });

  it("rejects bad shapes", () => {
    for (const bad of [null, [], {}, { ...own, username: "" }, { ...own, createdAt: "x" }])
      expect(parseOwnProfile(bad)).toBeUndefined();
  });

  it("defaults missing visibility flags to shown", () => {
    expect(parseOwnProfile({ ...own, visibility: undefined })?.visibility).toEqual({
      stats: true,
      paths: true,
      submissions: true,
    });
  });
});

describe("parsePublicProfile", () => {
  const pub = {
    username: "ada",
    displayName: "Ada",
    bio: "",
    avatarUrl: null,
    level: "beginner",
    topics: ["ui-ux", 4],
    joinedAt: "2026-09-02T10:00:00.000Z",
    stats: null,
    completedPaths: null,
    submissions: [
      { title: "Grid", url: "https://example.com", topic: null, approvedAt: null },
      { title: "Bad", url: "javascript:alert(1)", topic: null, approvedAt: null },
      { title: "NoUrl" },
    ],
  };

  it("keeps hidden sections null and only web links in submissions", () => {
    const p = parsePublicProfile(pub);
    expect(p?.stats).toBeNull();
    expect(p?.completedPaths).toBeNull();
    expect(p?.topics).toEqual(["ui-ux"]);
    expect(p?.submissions).toEqual([
      { title: "Grid", url: "https://example.com", topic: null, approvedAt: null },
    ]);
  });

  it("reads stats and paths when present", () => {
    const p = parsePublicProfile({
      ...pub,
      stats: { pathsFinished: 1, lessonsDone: 14, minutesLearned: 720, streakDays: 5 },
      completedPaths: [{ slug: "ux", completedAt: "2026-10-03T00:00:00.000Z" }, { slug: 1 }],
    });
    expect(p?.stats).toEqual({
      pathsFinished: 1,
      lessonsDone: 14,
      minutesLearned: 720,
      streakDays: 5,
    });
    expect(p?.completedPaths).toEqual([{ slug: "ux", completedAt: "2026-10-03T00:00:00.000Z" }]);
  });

  it("rejects bad shapes", () => {
    expect(parsePublicProfile({ ...pub, joinedAt: "x" })).toBeUndefined();
    expect(parsePublicProfile(null)).toBeUndefined();
  });
});

describe("parseUsernameCheck", () => {
  it("reads both answers", () => {
    expect(parseUsernameCheck({ available: true })).toEqual({ available: true });
    expect(parseUsernameCheck({ available: false, reason: "taken" })).toEqual({
      available: false,
      reason: "taken",
    });
    expect(parseUsernameCheck({ available: false })).toEqual({
      available: false,
      reason: "invalid",
    });
    expect(parseUsernameCheck({ available: "yes" })).toBeUndefined();
  });
});

describe("calls", () => {
  it("GET /api/me/profile", async () => {
    const fetchMock = mockFetch(json({ profile: own }));
    const r = await getOwnProfile();
    expect(r.ok && r.data.username).toBe("ada");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/me/profile");
  });

  it("PATCH sends only what it is given", async () => {
    const fetchMock = mockFetch(json({ profile: own }));
    await updateProfile({ bio: "x", visibility: { stats: false } });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ bio: "x", visibility: { stats: false } });
  });

  it("surfaces username_taken as a 409 with the field message", async () => {
    mockFetch(
      json(
        {
          code: "username_taken",
          message: "That username is taken.",
          fieldErrors: { username: "taken" },
        },
        { status: 409 },
      ),
    );
    const r = await updateProfile({ username: "ada" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(409);
      expect(r.fieldErrors?.username).toBe("taken");
    }
  });

  it("checks a username with the name url-encoded", async () => {
    const fetchMock = mockFetch(json({ available: true }));
    const r = await checkUsername("a b");
    expect(r.ok && r.data).toEqual({ available: true });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/me/profile/username-check?u=a%20b");
  });

  it("uploads the image as the raw body with its own type", async () => {
    const fetchMock = mockFetch(json({ profile: own }));
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" });
    const r = await uploadAvatar(blob);
    expect(r.ok).toBe(true);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(blob);
    expect((init.headers as Record<string, string>)["content-type"]).toBe("image/webp");
  });

  it("reports a photo the API refuses and a dropped connection", async () => {
    mockFetch(json({ code: "avatar_too_large", message: "big" }, { status: 413 }));
    const big = await uploadAvatar(new Blob(["x"], { type: "image/png" }));
    expect(!big.ok && big.status).toBe(413);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("offline"))),
    );
    const offline = await uploadAvatar(new Blob(["x"], { type: "image/png" }));
    expect(!offline.ok && offline.code).toBe("network_error");
  });

  it("removes the photo", async () => {
    const fetchMock = mockFetch(json({ profile: { ...own, avatarUrl: null } }));
    const r = await removeAvatar();
    expect(r.ok && r.data.avatarUrl).toBeNull();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("DELETE");
  });

  it("maps the public 404 to not_found and encodes the name", async () => {
    const fetchMock = mockFetch(json({ code: "not_found", message: "no" }, { status: 404 }));
    const r = await getPublicProfile("a/b");
    expect(!r.ok && r.code).toBe("not_found");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/profiles/a%2Fb");
  });
});
