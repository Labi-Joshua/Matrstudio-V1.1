import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTicket,
  getTicket,
  listTickets,
  parseTicket,
  parseTicketList,
  replyToTicket,
} from "./support-api";

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

function mockFetch(response: Response) {
  const fn = vi.fn(async (..._args: unknown[]) => response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

const ticket = {
  id: "t1",
  kind: "support",
  category: "Account and sign-in",
  subject: "Can’t change my email",
  status: "replied",
  createdAt: "2026-11-10T10:00:00.000Z",
  updatedAt: "2026-11-11T10:00:00.000Z",
  messageCount: 2,
  context: null,
};

describe("parsing", () => {
  it("reads a ticket and its messages, dropping unreadable messages", () => {
    const parsed = parseTicket({
      ...ticket,
      context: { resource: "Lesson 4", where: null, link: "https://x.test/a" },
      messages: [
        { id: "m1", author: "you", body: "Hi", createdAt: "2026-11-10T10:00:00.000Z" },
        { id: "m2", author: "robot", body: "x", createdAt: "2026-11-10T10:00:00.000Z" },
      ],
    });
    expect(parsed?.context).toEqual({
      resource: "Lesson 4",
      where: null,
      link: "https://x.test/a",
    });
    expect(parsed?.messages).toHaveLength(1);
    expect(parsed?.status).toBe("replied");
  });

  it("rejects unknown statuses, kinds and times", () => {
    expect(parseTicket({ ...ticket, status: "weird" })).toBeUndefined();
    expect(parseTicket({ ...ticket, kind: "x" })).toBeUndefined();
    expect(parseTicket({ ...ticket, createdAt: "nope" })).toBeUndefined();
    expect(parseTicket(null)).toBeUndefined();
  });

  it("drops unreadable list rows but needs a list", () => {
    expect(parseTicketList({ tickets: [ticket, { nope: 1 }] })).toHaveLength(1);
    expect(parseTicketList({ tickets: 3 })).toBeUndefined();
  });
});

describe("calls", () => {
  it("posts a ticket with the captcha header and no token in the body", async () => {
    const fn = mockFetch(json({ ticket }, { status: 201 }));
    const result = await createTicket({
      kind: "support",
      message: "Hello there, I need help",
      captchaToken: "tok",
    });
    expect(result.ok).toBe(true);
    const [path, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/me/support");
    expect(new Headers(init.headers).get("x-captcha-response")).toBe("tok");
    expect(JSON.parse(String(init.body))).toEqual({
      kind: "support",
      message: "Hello there, I need help",
    });
  });

  it("maps failures to codes", async () => {
    mockFetch(json({ code: "captcha_required", message: "x" }, { status: 400 }));
    expect(await createTicket({ kind: "report", message: "long enough text" })).toMatchObject({
      ok: false,
      code: "captcha_required",
    });
    mockFetch(json({ code: "rate_limited", message: "x", retryAfterSeconds: 90 }, { status: 429 }));
    expect(await listTickets()).toMatchObject({ code: "rate_limited", retryAfterSeconds: 90 });
    mockFetch(json({ code: "ticket_closed", message: "x" }, { status: 409 }));
    expect(await replyToTicket("t1", "more")).toMatchObject({ ok: false, code: "ticket_closed" });
  });

  it("encodes the id and reads the detail", async () => {
    const fn = mockFetch(json({ ticket }));
    const result = await getTicket("a/b");
    expect(result.ok).toBe(true);
    expect(fn.mock.calls[0]?.[0]).toBe("/api/me/support/a%2Fb");
  });
});
