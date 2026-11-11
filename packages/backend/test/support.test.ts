import { afterEach, describe, expect, it, vi } from "vitest";
import { renderAuthEmail } from "../src/lib/auth-email-templates";
import { createApp, stubFetch, type TestApp } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

async function setup(overrides = {}) {
  stubFetch();
  const app = createApp(overrides);
  const ada = (await app.signUpConfirmed("ada@example.com")).cookie as string;
  const bob = (await app.signUpConfirmed("bob@example.com")).cookie as string;
  return { app, ada, bob };
}

const valid = { kind: "support", message: "I cannot open lesson three." };
const create = (app: TestApp, cookie: string, body: unknown = valid, headers = {}) =>
  app.call("/api/me/support", { method: "POST", cookie, body, headers });
type Ticket = {
  id: string;
  status: string;
  subject: string;
  messageCount: number;
  messages?: Array<{ author: string; body: string; createdAt: string }>;
  context: Record<string, unknown> | null;
  createdAt: string;
};
const ticketOf = (json: Record<string, unknown>) => json.ticket as Ticket;
const lastLimitScope = (app: TestApp) =>
  JSON.parse(
    (
      app.sqlite
        .prepare("SELECT meta FROM audit_log WHERE action = 'rate_limit.hit' ORDER BY id DESC")
        .get() as { meta: string }
    ).meta,
  );

describe("POST /api/me/support", () => {
  it("creates a ticket with its first message, audits it and queues a confirmation", async () => {
    const { app, ada } = await setup();
    const res = await create(app, ada, {
      kind: "report",
      category: "bug",
      subject: "Video will not play",
      message: "The player stays black on the intro lesson.",
      context: { resource: "intro", where: "lesson page", link: "https://matrstudio.com/learn" },
    });
    expect(res.status).toBe(201);
    const t = ticketOf(res.json);
    expect(t).toMatchObject({
      kind: "report",
      category: "bug",
      subject: "Video will not play",
      status: "open",
      messageCount: 1,
      context: { resource: "intro", where: "lesson page", link: "https://matrstudio.com/learn" },
    });
    expect(t.messages).toEqual([
      expect.objectContaining({
        author: "you",
        body: "The player stays black on the intro lesson.",
      }),
    ]);
    expect(new Date(t.createdAt).toISOString()).toBe(t.createdAt);
    expect(app.last("support-received")).toMatchObject({
      to: "ada@example.com",
      subject: "Video will not play",
      kind: "report",
    });
    const audit = app.sqlite
      .prepare("SELECT actor, target, meta FROM audit_log WHERE action = 'support.created'")
      .all() as Array<{ target: string; meta: string }>;
    expect(audit.length).toBe(1);
    expect(audit[0]?.target).toBe(t.id);
    expect(JSON.stringify(audit)).not.toContain("black");
    expect(JSON.stringify(audit)).not.toContain("ada@example.com");
  });

  it("defaults the subject and has no context when none is sent", async () => {
    const { app, ada } = await setup();
    const t = ticketOf((await create(app, ada)).json);
    expect(t.subject).toBe("I cannot open lesson three.");
    expect(t.context).toBeNull();
    const r = ticketOf(
      (await create(app, ada, { kind: "report", message: "Something broke here." })).json,
    );
    expect(r.subject).toBe("Report");
  });

  it("validates the body with fieldErrors", async () => {
    const { app, ada } = await setup();
    const bad: unknown[] = [
      null,
      {},
      { ...valid, kind: "other" },
      { ...valid, message: "short" },
      { ...valid, message: "x".repeat(2001) },
      { ...valid, subject: "s".repeat(121) },
      { ...valid, extra: true },
      { ...valid, context: { link: "http://insecure.example" } },
      { ...valid, context: { link: "javascript:alert(1)" } },
      { ...valid, context: { link: `https://x.example/${"a".repeat(500)}` } },
      { ...valid, context: { resource: "r".repeat(201) } },
      { ...valid, context: { where: "w".repeat(201) } },
    ];
    for (const body of bad) {
      const r = await create(app, ada, body);
      expect(r.status, JSON.stringify(body)?.slice(0, 80)).toBe(400);
      expect(r.json.code).toBe("invalid_request");
    }
    const r = await create(app, ada, { ...valid, message: "short" });
    expect(r.json.fieldErrors).toEqual({ message: "Check this field." });
    expect(app.sqlite.prepare("SELECT id FROM support_tickets").all().length).toBe(0);
    const edge = { ...valid, message: "x".repeat(2000), subject: "s".repeat(120) };
    expect((await create(app, ada, edge)).status).toBe(201);
  });

  it("requires a captcha when Turnstile is configured", async () => {
    stubFetch((url, init) => {
      if (!url.includes("challenges.cloudflare.com")) return undefined;
      const token = (init?.body as FormData | undefined)?.get("response");
      return Response.json({ success: token === "good" });
    });
    const app = createApp();
    const ada = (await app.signUpConfirmed("ada@example.com")).cookie as string;
    app.env.TURNSTILE_SECRET = "secret";
    const missing = await create(app, ada);
    expect(missing.status).toBe(400);
    expect(missing.json.code).toBe("captcha_required");
    const wrong = await create(app, ada, valid, { "x-captcha-response": "bad" });
    expect(wrong.status).toBe(400);
    expect(wrong.json.code).toBe("captcha_failed");
    expect(app.sqlite.prepare("SELECT id FROM support_tickets").all().length).toBe(0);
    expect((await create(app, ada, valid, { "x-captcha-response": "good" })).status).toBe(201);
  });

  it("fails closed with captcha_unavailable in production without a secret", async () => {
    const { app, ada } = await setup();
    app.env.ENVIRONMENT = "production";
    const r = await create(app, ada);
    expect(r.status).toBe(503);
    expect(r.json.code).toBe("captcha_unavailable");
  });

  it("allows 10 an hour per user, then 429 with Retry-After", async () => {
    const { app, ada, bob } = await setup();
    for (let i = 0; i < 10; i++) expect((await create(app, ada)).status, String(i)).toBe(201);
    const r = await create(app, ada);
    expect(r.status).toBe(429);
    expect(r.json.code).toBe("rate_limited");
    expect(r.json.retryAfterSeconds).toBeGreaterThan(0);
    expect(r.headers.get("retry-after")).toBeTruthy();
    expect(lastLimitScope(app)).toEqual({ scope: "support_user" });
    // The tests share one network address, so bob is stopped by the network limit instead.
    expect((await create(app, bob)).status).toBe(429);
    expect(lastLimitScope(app)).toEqual({ scope: "support_ip" });
  });
});

describe("GET /api/me/support and /:id", () => {
  it("lists only own tickets, newest first, without messages", async () => {
    const { app, ada, bob } = await setup();
    const first = ticketOf((await create(app, ada, { ...valid, subject: "first" })).json);
    const second = ticketOf((await create(app, ada, { ...valid, subject: "second" })).json);
    await create(app, bob, { ...valid, subject: "bobs" });
    app.sqlite.prepare("UPDATE support_tickets SET created_at = 1000 WHERE id = ?").run(first.id);
    const res = await app.call("/api/me/support", { cookie: ada });
    const tickets = res.json.tickets as Ticket[];
    expect(tickets.map((t) => t.id)).toEqual([second.id, first.id]);
    expect(tickets[0]).not.toHaveProperty("messages");
    expect(tickets[0]?.messageCount).toBe(1);
  });

  it("returns 404 for another user's or an unknown ticket, 400 for a bad id", async () => {
    const { app, ada, bob } = await setup();
    const t = ticketOf((await create(app, ada)).json);
    expect((await app.call(`/api/me/support/${t.id}`, { cookie: ada })).status).toBe(200);
    for (const id of [t.id, "no-such-ticket"]) {
      const r = await app.call(`/api/me/support/${id}`, { cookie: bob });
      expect(r.status).toBe(404);
      expect(r.json.code).toBe("not_found");
    }
    const bad = await app.call("/api/me/support/Not%20Valid", { cookie: ada });
    expect(bad.status).toBe(400);
    expect(bad.json.code).toBe("invalid_request");
  });
});

describe("POST /api/me/support/:id/messages", () => {
  const send = (app: TestApp, cookie: string, id: string, message: unknown = "Any news on this?") =>
    app.call(`/api/me/support/${id}/messages`, { method: "POST", cookie, body: { message } });

  it("adds a follow-up, reopens a replied ticket and keeps the order", async () => {
    const { app, ada } = await setup();
    const t = ticketOf((await create(app, ada)).json);
    app.sqlite.prepare("UPDATE support_tickets SET status = 'replied'").run();
    const r = await send(app, ada, t.id);
    expect(r.status).toBe(201);
    const got = ticketOf(r.json);
    expect(got.status).toBe("open");
    expect(got.messageCount).toBe(2);
    expect(got.messages?.map((m) => m.body)).toEqual([
      "I cannot open lesson three.",
      "Any news on this?",
    ]);
    const audits = app.sqlite
      .prepare("SELECT action FROM audit_log WHERE action = 'support.message'")
      .all();
    expect(audits.length).toBe(1);
  });

  it("answers ticket_closed (409) for resolved, fixed and cant_reproduce tickets", async () => {
    const { app, ada } = await setup();
    const t = ticketOf((await create(app, ada)).json);
    for (const status of ["resolved", "fixed", "cant_reproduce"]) {
      app.sqlite.prepare("UPDATE support_tickets SET status = ?").run(status);
      const r = await send(app, ada, t.id);
      expect(r.status, status).toBe(409);
      expect(r.json.code).toBe("ticket_closed");
    }
    expect(app.sqlite.prepare("SELECT id FROM support_messages").all().length).toBe(1);
  });

  it("is object-scoped: 404 for someone else's ticket, and it changes nothing", async () => {
    const { app, ada, bob } = await setup();
    const t = ticketOf((await create(app, ada)).json);
    const r = await send(app, bob, t.id);
    expect(r.status).toBe(404);
    expect(r.json.code).toBe("not_found");
    expect(app.sqlite.prepare("SELECT id FROM support_messages").all().length).toBe(1);
  });

  it("validates the message and the id before spending the rate limit", async () => {
    const { app, ada } = await setup();
    const t = ticketOf((await create(app, ada)).json);
    for (const m of ["", "   ", "x".repeat(2001), 5, null]) {
      expect((await send(app, ada, t.id, m)).status, String(m)).toBe(400);
    }
    expect((await send(app, ada, "Bad_Id")).status).toBe(400);
    const spent = app.sqlite
      .prepare("SELECT count FROM rate_limits WHERE key LIKE 'support-message:%'")
      .all();
    expect(spent).toEqual([]);
  });

  it("allows 30 follow-ups an hour per user, then 429", async () => {
    const { app, ada } = await setup();
    const t = ticketOf((await create(app, ada)).json);
    for (let i = 0; i < 30; i++) expect((await send(app, ada, t.id)).status, String(i)).toBe(201);
    const r = await send(app, ada, t.id);
    expect(r.status).toBe(429);
    expect(r.json.code).toBe("rate_limited");
  }, 30000);
});

describe("access", () => {
  const routes = [
    ["GET", "/api/me/support"],
    ["GET", "/api/me/support/abc"],
    ["POST", "/api/me/support"],
    ["POST", "/api/me/support/abc/messages"],
  ] as const;

  it("answers 401 signed out and 503 without a good auth secret", async () => {
    const { app } = await setup();
    for (const [m, p] of routes) {
      const r = await app.call(p, { method: m });
      expect(r.status, p).toBe(401);
      expect(r.json.code).toBe("unauthorized");
    }
    for (const secret of [undefined, "short"]) {
      const bare = createApp({ BETTER_AUTH_SECRET: secret as string });
      for (const [m, p] of routes) {
        const r = await bare.call(p, { method: m });
        expect(r.status, p).toBe(503);
        expect(r.json.code).toBe("auth_unavailable");
      }
    }
  });

  it("refuses foreign origins; deleting the account removes the user's tickets only", async () => {
    const { app, ada, bob } = await setup();
    const t = ticketOf((await create(app, bob)).json);
    await create(app, ada);
    const evil = await app.call("/api/me/support", {
      method: "POST",
      cookie: ada,
      body: valid,
      origin: "https://evil.example",
    });
    expect(evil.status).toBe(403);
    expect((await app.call("/api/me", { method: "DELETE", cookie: ada })).status).toBe(200);
    expect(app.sqlite.prepare("SELECT id FROM support_tickets").all()).toEqual([{ id: t.id }]);
    expect(app.sqlite.prepare("SELECT ticket_id FROM support_messages").all().length).toBe(1);
  });
});

describe("support emails", () => {
  const web = "https://matrstudio.com";

  it("escape user text, link only to the website and carry no codes", () => {
    const nasty = `<script>alert(1)</script> "x" & <b>y</b>`;
    const to = "a@example.com";
    const msgs = [
      { type: "support-received", to, subject: nasty, kind: "support" },
      { type: "support-reply", to, subject: nasty, message: nasty },
      { type: "support-closed", to, subject: nasty, status: "fixed" },
      { type: "support-closed", to, subject: nasty, status: "cant_reproduce" },
      { type: "support-closed", to, subject: nasty, status: "resolved" },
    ] as const;
    for (const m of msgs) {
      const { html, text, subject } = renderAuthEmail(web, m);
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("<b>y</b>");
      expect(html).toContain("&#60;script&#62;");
      expect(subject).not.toContain("<");
      expect(text.length).toBeGreaterThan(20);
      const links = [...html.matchAll(/href="([^"]+)"/g)].map((x) => x[1] as string);
      for (const l of links)
        expect(l.startsWith(web) || l.startsWith("mailto:support@matrstudio.com"), l).toBe(true);
      expect(html).not.toMatch(/token=|code=/);
    }
  });

  it("keeps line breaks out of the subject line quoted in the body", () => {
    const { html } = renderAuthEmail(web, {
      type: "support-received",
      to: "a@example.com",
      subject: "line one\nline two",
      kind: "report",
    });
    expect(html).toContain("line one line two");
  });
});
