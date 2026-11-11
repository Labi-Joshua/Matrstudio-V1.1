import { describe, expect, it } from "vitest";
import { dueShort, formatDate, initials, lastActive, slaLine, whenLabel } from "./format";
import {
  batchLine,
  clampInvite,
  deleteConfirmed,
  inviteRangeLine,
  remindableBatch,
  ticketStatus,
  toCsv,
} from "./logic";
import {
  parseAccess,
  parseBatches,
  parseSupportList,
  parseTicketDetail,
  parseUserDetail,
  parseUserList,
  parseWaitlist,
} from "./parse";

const now = new Date(2026, 10, 11, 12, 0, 0);
const at = (days: number, h = 9) => new Date(2026, 10, 11 - days, h, 14).toISOString();

describe("format", () => {
  it("formats dates and relative days", () => {
    expect(formatDate(new Date(2026, 2, 12).toISOString())).toBe("12 Mar 2026");
    expect(formatDate(null)).toBe("—");
    expect(lastActive(at(0), now)).toBe("Today");
    expect(lastActive(at(1), now)).toBe("Yesterday");
    expect(lastActive(at(5), now)).toBe("5 days ago");
    expect(lastActive(at(21), now)).toBe("3 weeks ago");
    expect(lastActive(null, now)).toBe("—");
    expect(whenLabel(at(0), now)).toBe("Today, 09:14");
  });
  it("words the reply deadline", () => {
    const due = new Date(now.getTime() + 6 * 3_600_000).toISOString();
    const past = new Date(now.getTime() - 2 * 3_600_000).toISOString();
    expect(dueShort(due, false, now)).toBe("6 h");
    expect(dueShort(past, true, now)).toBe("Overdue 2 h");
    expect(slaLine(due, false, now)).toBe("First reply due in 6 hours");
    expect(slaLine(past, true, now)).toBe("Overdue by 2 hours");
    expect(slaLine(null, false, now)).toBeNull();
  });
  it("makes initials", () => {
    expect(initials("Ada Obi")).toBe("AO");
    expect(initials("Quick")).toBe("Q");
    expect(initials("  ")).toBe("?");
  });
});

describe("logic", () => {
  it("accepts the typed delete confirmation only when it matches", () => {
    expect(deleteConfirmed(" ADA.obi@example.com ", "ada.obi@example.com")).toBe(true);
    expect(deleteConfirmed("ada.obi@example.co", "ada.obi@example.com")).toBe(false);
    expect(deleteConfirmed("", "")).toBe(false);
  });
  it("clamps the invite batch", () => {
    expect(clampInvite(100, 3412)).toBe(100);
    expect(clampInvite(100, 40)).toBe(40);
    expect(clampInvite(9999, 9999)).toBe(500);
    expect(clampInvite(Number.NaN, 10)).toBe(0);
    expect(clampInvite(-5, 10)).toBe(0);
  });
  it("describes the oldest-first range", () => {
    const e = (id: string, d: string) => ({
      id,
      email: `${id}@x.com`,
      joinedAt: d,
      source: null,
      status: "waiting" as const,
    });
    const entries = [
      e("a", "2026-09-02T10:00:00"),
      e("b", "2026-09-05T10:00:00"),
      e("c", "2026-09-09T10:00:00"),
    ];
    expect(inviteRangeLine(3, entries, null)).toBe(
      "The oldest 3 on the waitlist, who joined between 2 Sep and 9 Sep.",
    );
    expect(inviteRangeLine(100, entries, null)).toBe(
      "The oldest 100 on the waitlist, who joined from 2 Sep.",
    );
    expect(inviteRangeLine(5, [], null)).toBe("The oldest 5 on the waitlist.");
  });
  it("finds the batch to remind", () => {
    const b = (id: string, sentAt: string, notJoined: number, reminderSentAt: string | null) => ({
      id,
      sentAt,
      invited: 100,
      created: 60,
      confirmed: 50,
      notJoined,
      reminderSentAt,
    });
    const list = [
      b("old", "2026-10-01T00:00:00Z", 5, "2026-10-09T00:00:00Z"),
      b("new", "2026-10-25T00:00:00Z", 36, null),
    ];
    expect(remindableBatch(list)?.id).toBe("new");
    expect(remindableBatch([b("x", "2026-10-25T00:00:00Z", 0, null)])).toBeUndefined();
    expect(batchLine(list[1] as never)).toContain(
      "100 invited → 60 created an account → 50 confirmed",
    );
  });
  it("labels ticket statuses", () => {
    expect(ticketStatus("open", { isNew: true, logged: false }).label).toBe("New");
    expect(ticketStatus("open", { isNew: false, logged: false }).label).toBe("Open");
    expect(ticketStatus("open", { isNew: false, logged: true }).label).toBe("Logged for the team");
    expect(ticketStatus("replied", { isNew: false, logged: false }).label).toBe("Waiting on user");
    expect(ticketStatus("cant_reproduce", { isNew: false, logged: false }).label).toBe(
      "Can’t reproduce",
    );
  });
  it("escapes CSV and neutralises formulas", () => {
    expect(toCsv(["a", "b"], [['x,"y"', "=SUM(A1)"]])).toBe('a,b\r\n"x,""y""",\'=SUM(A1)');
  });
});

describe("parsers", () => {
  it("parses a user list and rejects bad rows", () => {
    const ok = parseUserList({
      users: [{ id: "1", email: "a@x.com", status: "active", joinedAt: "2026-03-12T00:00:00Z" }],
      totals: { learners: 10, waitlist: 4 },
    });
    expect(ok?.users[0]?.name).toBe("a@x.com");
    expect(ok?.totals.waitlist).toBe(4);
    expect(parseUserList({ users: [{ id: "1" }] })).toBeUndefined();
    expect(parseUserList(null)).toBeUndefined();
  });
  it("parses user detail with defaults", () => {
    const d = parseUserDetail({
      user: {
        id: "1",
        email: "a@x.com",
        status: "suspended",
        joinedAt: "2026-03-12T00:00:00Z",
        suspension: { at: "2026-11-11T00:00:00Z", reason: "spam" },
      },
    });
    expect(d?.paths).toEqual([]);
    expect(d?.authMethod).toBe("password");
    expect(d?.suspension?.reason).toBe("spam");
    expect(
      parseUserDetail({ user: { id: "1", email: "a@x.com", status: "nope", joinedAt: "x" } }),
    ).toBeUndefined();
  });
  it("parses waitlist, batches, support and access", () => {
    expect(
      parseWaitlist({ entries: [{ id: "1", email: "a@x.com", joinedAt: "x", status: "waiting" }] })
        ?.entries,
    ).toHaveLength(1);
    expect(parseWaitlist({ entries: [{ id: "1" }] })).toBeUndefined();
    expect(
      parseBatches({ batches: [{ id: "b", sentAt: "x", invited: 100 }] })?.[0]?.notJoined,
    ).toBe(0);
    expect(
      parseSupportList({
        tickets: [
          { id: "t", subject: "s", status: "open", createdAt: "x", requester: { name: "A" } },
        ],
      })?.tickets[0]?.requester.name,
    ).toBe("A");
    expect(
      parseSupportList({ tickets: [{ id: "t", subject: "s", status: "weird", createdAt: "x" }] }),
    ).toBeUndefined();
    const t = parseTicketDetail({
      ticket: {
        id: "t",
        subject: "s",
        status: "waiting_on_user",
        createdAt: "x",
        messages: [{ id: "m", author: "note", body: "hi", at: "x" }],
        issue: { id: 214, title: "T", severity: "high" },
      },
    });
    expect(t?.messages[0]?.author).toBe("note");
    expect(t?.issue?.severity).toBe("high");
    expect(
      parseAccess({
        role: { id: "super_admin" },
        permissions: { users_waitlist: "manage", support_inbox: "view" },
      }),
    ).toEqual({ superAdmin: true, users: "manage", support: "view" });
    expect(parseAccess({})).toBeUndefined();
  });
});
