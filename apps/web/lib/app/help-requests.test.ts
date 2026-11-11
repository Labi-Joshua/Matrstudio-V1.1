import { describe, expect, it } from "vitest";
import type { ApiFailure } from "../auth/api";
import type { Ticket } from "../auth/support-api";
import { validateContact } from "./help-form";
import {
  contactTicket,
  isClosed,
  messageStamp,
  parseRequestId,
  reportTicket,
  requestHref,
  requestsSummary,
  sendFailureCopy,
  sortTickets,
  subjectFrom,
  ticketMeta,
} from "./help-requests";

const now = new Date(2026, 10, 11, 14, 0, 0);
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0, 0).toISOString();
const ticket = (over: Partial<Ticket> & { id: string }): Ticket => ({
  kind: "support",
  category: "Account and sign-in",
  subject: "s",
  status: "open",
  createdAt: at(10, 9),
  updatedAt: at(11, 12),
  messageCount: 1,
  context: null,
  ...over,
});
const failure = (over: Partial<ApiFailure> & Pick<ApiFailure, "code">): ApiFailure => ({
  ok: false,
  message: "x",
  ...over,
});

describe("statuses", () => {
  it("treats resolved, fixed and can't reproduce as closed", () => {
    expect(["open", "replied"].map((s) => isClosed(s as Ticket["status"]))).toEqual([false, false]);
    expect(
      ["resolved", "fixed", "cant_reproduce"].every((s) => isClosed(s as Ticket["status"])),
    ).toBe(true);
  });

  it("summarises and sorts requests", () => {
    const list = [
      ticket({ id: "a", status: "replied" }),
      ticket({ id: "b", status: "fixed", updatedAt: at(8, 1) }),
      ticket({ id: "c", status: "open", updatedAt: at(11, 13) }),
    ];
    expect(requestsSummary(list)).toBe("3 requests · 2 open");
    expect(requestsSummary([list[1] as Ticket])).toBe("1 request");
    expect(sortTickets(list).map((t) => t.id)).toEqual(["c", "a", "b"]);
  });

  it("words each request's last activity", () => {
    expect(ticketMeta(ticket({ id: "a", status: "replied" }), now)).toBe(
      "Contact support · Account and sign-in · Support replied 2h ago",
    );
    expect(
      ticketMeta(ticket({ id: "b", kind: "report", category: null, status: "fixed" }), now),
    ).toBe("Report a problem · Fixed 2h ago");
  });
});

describe("request page url", () => {
  it("builds and reads the id", () => {
    expect(requestHref("abc-1")).toBe("/learn/help/request?id=abc-1");
    expect(parseRequestId("?id=abc-1")).toBe("abc-1");
    expect(parseRequestId("")).toBeNull();
    expect(parseRequestId("?id=../x")).toBeNull();
    expect(parseRequestId(`?id=${"a".repeat(65)}`)).toBeNull();
  });

  it("stamps today's messages with Today", () => {
    expect(messageStamp(at(11, 9), now)).toMatch(/^Today, /);
    expect(messageStamp(at(3, 9), now)).toMatch(/^3 Nov, /);
    expect(messageStamp("nope", now)).toBe("");
  });
});

describe("request bodies", () => {
  it("takes the first line as the subject, clipped", () => {
    expect(subjectFrom("\n  Hello   there \nsecond")).toBe("Hello there");
    expect(subjectFrom("x".repeat(300))).toHaveLength(120);
  });

  it("builds a support ticket from the topic and message", () => {
    expect(contactTicket({ topic: "Billing", message: "  I need help with this  " })).toEqual({
      kind: "support",
      category: "Billing",
      subject: "I need help with this",
      message: "I need help with this",
    });
  });

  it("builds a report with the context chip and the typed link", () => {
    const body = reportTicket(
      { kind: "link", detail: "The link is dead", link: "example.com/a" },
      { title: "Auto layout", where: "Lesson 2", link: "https://other.test/x" },
    );
    expect(body.kind).toBe("report");
    expect(body.context).toEqual({
      resource: "Auto layout",
      where: "Lesson 2",
      link: "https://example.com/a",
    });
    expect(
      reportTicket({ kind: "other", detail: "Something odd here", link: "" }, null).context,
    ).toBeUndefined();
  });

  it("asks for at least 10 characters", () => {
    expect(validateContact({ topic: "Billing", message: "short" }).message).toMatch(/at least 10/);
  });
});

describe("failure copy", () => {
  it("asks for the check again for captcha codes", () => {
    for (const code of ["captcha_required", "captcha_failed"] as const) {
      expect(sendFailureCopy(failure({ code }), "message").captcha).toBe(true);
    }
  });

  it("says how long to wait when rate limited", () => {
    const copy = sendFailureCopy(
      failure({ code: "rate_limited", retryAfterSeconds: 600 }),
      "report",
    );
    expect(copy.description).toContain("10 minutes");
    expect(copy.title).toBe("Your report didn’t send");
    expect(sendFailureCopy(failure({ code: "rate_limited" }), "message").description).toContain(
      "a little while",
    );
  });

  it("says nothing was lost on a network failure, and does not offer retry for a closed ticket", () => {
    expect(sendFailureCopy(failure({ code: "network_error" }), "reply").description).toContain(
      "kept your reply",
    );
    expect(sendFailureCopy(failure({ code: "ticket_closed" }), "reply").retry).toBe(false);
    expect(sendFailureCopy(failure({ code: "unknown_error" }), "message").retry).toBe(true);
  });
});
