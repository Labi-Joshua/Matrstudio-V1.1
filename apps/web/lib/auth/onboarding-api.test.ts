import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOnboardingPaths, SAMPLE_PATHS } from "../pages/onboarding-content";
import { parseOnboardingResponse, saveOnboarding } from "./onboarding-api";

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

describe("parseOnboardingResponse", () => {
  it("reads the onboarding block", () => {
    expect(
      parseOnboardingResponse({
        onboarding: { goal: "switch_careers", level: null, topics: ["seo", 5], completed: false },
      }),
    ).toEqual({
      goal: "switch_careers",
      level: null,
      topics: ["seo"],
      completed: false,
      completedAt: null,
    });
  });

  it("rejects payloads without an onboarding object", () => {
    expect(parseOnboardingResponse(null)).toBeUndefined();
    expect(parseOnboardingResponse({})).toBeUndefined();
    expect(parseOnboardingResponse({ onboarding: [] })).toBeUndefined();
  });
});

describe("saveOnboarding", () => {
  it("posts only what it is given, with credentials", async () => {
    const fetchMock = vi.fn(async () => json({ onboarding: { goal: "grow_in_role", topics: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await saveOnboarding({ goal: "grow_in_role" });
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/me/onboarding");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.body).toBe(JSON.stringify({ goal: "grow_in_role" }));
  });

  it("maps 401 to unauthorized and 400 to invalid_request", async () => {
    vi.stubGlobal("fetch", async () =>
      json({ code: "unauthorized", message: "no" }, { status: 401 }),
    );
    expect(await saveOnboarding({ level: "beginner" })).toMatchObject({
      ok: false,
      code: "unauthorized",
    });
    vi.stubGlobal("fetch", async () =>
      json({ code: "invalid_request", message: "bad" }, { status: 400 }),
    );
    expect(await saveOnboarding({ level: "beginner" })).toMatchObject({
      ok: false,
      code: "invalid_request",
    });
  });

  it("reports network failures and unreadable answers", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    expect(await saveOnboarding({ topics: ["seo"] })).toMatchObject({
      ok: false,
      code: "network_error",
    });
    vi.stubGlobal("fetch", async () => json({ nope: true }));
    expect(await saveOnboarding({ topics: ["seo"] })).toMatchObject({
      ok: false,
      code: "invalid_response",
    });
  });
});

describe("buildOnboardingPaths", () => {
  const empty = { topics: [], sources: [], resources: [], paths: [], pathLessons: [] };

  it("falls back to the design samples only when asked to and the catalogue is empty", () => {
    expect(buildOnboardingPaths(empty, true)).toBe(SAMPLE_PATHS);
    expect(buildOnboardingPaths(empty, false)).toEqual([]);
  });

  it("uses published catalogue paths, with their first lessons, instead of samples", () => {
    const catalogue = {
      topics: [{ slug: "seo" as const, name: "SEO" }],
      sources: [{ slug: "youtube", name: "YouTube", domain: "youtube.com" }],
      resources: [
        {
          id: "r1",
          title: "Intro",
          url: "https://example.com",
          sourceSlug: "youtube",
          format: "video" as const,
          lengthMinutes: 12,
          topicSlug: "seo" as const,
          status: "live" as const,
        },
        {
          id: "r2",
          title: "Guide",
          url: "https://example.com/2",
          sourceSlug: "youtube",
          format: "article" as const,
          lengthMinutes: 8,
          topicSlug: "seo" as const,
          status: "live" as const,
        },
      ],
      paths: [
        {
          slug: "seo-1",
          title: "SEO 1",
          description: "",
          topicSlug: "seo" as const,
          level: "beginner" as const,
          status: "published" as const,
        },
        {
          slug: "seo-2",
          title: "Draft",
          description: "",
          topicSlug: "seo" as const,
          level: "beginner" as const,
          status: "draft" as const,
        },
      ],
      pathLessons: [
        { pathSlug: "seo-1", resourceId: "r2", position: 1 },
        { pathSlug: "seo-1", resourceId: "r1", position: 0 },
      ],
    };
    const [only, ...rest] = buildOnboardingPaths(catalogue, true);
    expect(rest).toEqual([]);
    expect(only).toMatchObject({ slug: "seo-1", lessons: 2, sample: false });
    expect(only?.firstLessons).toEqual([
      { title: "Intro", meta: "YouTube · 12 min" },
      { title: "Guide", meta: "Article · 8 min" },
    ]);
  });
});
