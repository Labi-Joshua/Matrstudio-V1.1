import { afterEach, describe, expect, it, vi } from "vitest";
import { approveSubmission, getSubmission, listSubmissions } from "./api";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async (_url: string) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}
afterEach(() => vi.unstubAllGlobals());

describe("review api", () => {
  it("parses a submissions page and sends filters", async () => {
    const fn = mockFetch(200, {
      items: [
        {
          id: "s1",
          title: "Spacing",
          source: "figma.com/blog",
          submitter: { id: "u", name: "Kemi", submitted: 12, approved: 9 },
          check: { status: "pass", label: "Passed" },
          ageDays: 4,
          assignedTo: { id: "a1", name: "Tobi" },
        },
      ],
      counts: { submissions: 7, linkReports: 3, profileReports: 2 },
    });
    const res = await listSubmissions({ assignee: "me", olderThanDays: 3 });
    expect(fn.mock.calls[0]?.[0]).toBe("/api/admin/review/submissions?assignee=me&olderThanDays=3");
    expect(res.ok && res.data.items[0]?.assignedTo?.name).toBe("Tobi");
    expect(res.ok && res.data.counts?.linkReports).toBe(3);
  });

  it("rejects a bad list shape", async () => {
    mockFetch(200, { nope: true });
    const res = await listSubmissions({});
    expect(!res.ok && res.code).toBe("invalid_response");
  });

  it("surfaces 409 already_reviewed", async () => {
    mockFetch(409, { code: "already_reviewed", message: "Tobi approved this." });
    const res = await approveSubmission("s1", {
      record: {
        title: "a",
        creator: "b",
        type: "article",
        topic: "ui-ux",
        level: "beginner",
        intro: "x",
        placement: "library",
      },
      credit: true,
    });
    expect(!res.ok && res.status).toBe(409);
    expect(!res.ok && res.code).toBe("already_reviewed");
  });

  it("reads detail with defaults", async () => {
    mockFetch(200, {
      id: "s1",
      title: "T",
      submitter: { name: "Kemi" },
      autoChecks: [{ label: "Link works", status: "pass" }],
    });
    const res = await getSubmission("s 1");
    expect(res.ok && res.data.autoChecks[0]?.status).toBe("pass");
    expect(res.ok && res.data.duplicateOf).toBeNull();
  });
});
