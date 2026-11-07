import { afterEach, describe, expect, it, vi } from "vitest";
import { normaliseFailure } from "./api";
import {
  createSubmission,
  listSubmissions,
  parseSubmission,
  parseSubmissionList,
  updateSubmission,
} from "./submissions-api";

const row = {
  id: "s1",
  url: "https://a.com/x",
  title: "T",
  note: null,
  topic: "ui-ux",
  status: "in_review",
  curatorNote: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

function mockFetch(response: Response) {
  const fn = vi.fn(async (..._args: unknown[]) => response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("parsing", () => {
  it("reads a submission and fills the optional fields with null", () => {
    expect(
      parseSubmission({
        id: "1",
        url: "https://a.com",
        status: "declined",
        createdAt: "a",
        updatedAt: "b",
      }),
    ).toMatchObject({ title: null, topic: null, curatorNote: null, status: "declined" });
  });

  it("rejects an unknown status or a missing field", () => {
    expect(parseSubmission({ ...row, status: "weird" })).toBeUndefined();
    expect(parseSubmission({ ...row, url: undefined })).toBeUndefined();
    expect(parseSubmission(null)).toBeUndefined();
  });

  it("drops unreadable rows but needs a list", () => {
    expect(parseSubmissionList({ submissions: [row, { nope: 1 }] })).toHaveLength(1);
    expect(parseSubmissionList({})).toBeUndefined();
  });
});

describe("normaliseFailure for submissions", () => {
  it("keeps the new codes and field errors", () => {
    const f = normaliseFailure(400, {
      code: "invalid_request",
      fieldErrors: { title: ["Too long"], url: "Bad", n: 3 },
    });
    expect(f.code).toBe("invalid_request");
    expect(f.fieldErrors).toEqual({ title: "Too long", url: "Bad" });
    expect(normaliseFailure(409, { code: "already_submitted" }).code).toBe("already_submitted");
    expect(normaliseFailure(409, { code: "not_editable" }).code).toBe("not_editable");
    expect(normaliseFailure(400, { code: "invalid_url" }).code).toBe("invalid_url");
  });
});

describe("calls", () => {
  it("POSTs the submission with the captcha header and omits empty fields", async () => {
    const fetchMock = mockFetch(json({ submission: row }, { status: 201 }));
    const result = await createSubmission({
      url: "https://a.com/x",
      title: "T",
      captchaToken: "tok",
    });
    expect(result.ok && result.data.id).toBe("s1");
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/me/submissions");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>)["x-captcha-response"]).toBe("tok");
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://a.com/x", title: "T" });
  });

  it("surfaces already_submitted and rate limits", async () => {
    mockFetch(json({ code: "already_submitted", message: "x" }, { status: 409 }));
    const dup = await createSubmission({ url: "https://a.com/x" });
    expect(!dup.ok && dup.code).toBe("already_submitted");
    mockFetch(json({ code: "rate_limited", retryAfterSeconds: 90 }, { status: 429 }));
    const limited = await createSubmission({ url: "https://a.com/x" });
    expect(!limited.ok && limited.retryAfterSeconds).toBe(90);
  });

  it("GETs the list", async () => {
    const fetchMock = mockFetch(json({ submissions: [row] }));
    const result = await listSubmissions();
    expect(result.ok && result.data).toHaveLength(1);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("/api/me/submissions");
  });

  it("PATCHes one submission by encoded id", async () => {
    const fetchMock = mockFetch(json({ submission: row }));
    await updateSubmission("a/b", { title: "New", note: undefined });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/me/submissions/a%2Fb");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ title: "New" });
  });

  it("reports a network failure as a result, not a throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const result = await listSubmissions();
    expect(!result.ok && result.code).toBe("network_error");
  });

  it("treats an answer without a list as invalid", async () => {
    mockFetch(json({ nope: true }));
    const result = await listSubmissions();
    expect(!result.ok && result.code).toBe("invalid_response");
  });
});
