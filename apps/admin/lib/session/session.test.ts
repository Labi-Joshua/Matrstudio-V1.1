import { describe, expect, it } from "vitest";
import { parseNotifications, parseSearch } from "./api";
import { isSixDigits, passwordProblem, problemFrom } from "./auth-copy";
import { idleState } from "./idle";
import { encodeQr, formatBits, versionBits } from "./qr";
import { formatWait, isToday, relativeTime } from "./time";
import { initials, parseMe } from "./types";

const meBody = {
  id: "a1",
  email: "tolu@example.com",
  name: "Tolu Adeyemi",
  role: { id: "super_admin", name: "Super admin" },
  permissions: { dashboard: "manage", audit_log: "view", bogus: "manage" },
  menu: ["dashboard", "audit_log", "nope"],
  mfaEnrolled: true,
  lastReauthAt: 100,
  fresh: false,
  sessionExpiresAt: 2000,
  sessionAbsoluteExpiresAt: 9000,
  badges: { review: 12 },
  unreadNotifications: 3,
};

describe("parseMe", () => {
  it("reads a /me answer, fills missing areas with none and drops unknown ones", () => {
    const me = parseMe(meBody);
    expect(me?.permissions.resources).toBe("none");
    expect(me?.menu).toEqual(["dashboard", "audit_log"]);
    expect(me?.reviewBadge).toBe(12);
    expect(me?.unreadNotifications).toBe(3);
  });
  it("tolerates a /me without badges", () => {
    const me = parseMe({ ...meBody, badges: undefined, unreadNotifications: undefined });
    expect(me?.reviewBadge).toBe(0);
  });
  it("rejects a wrong shape", () => {
    expect(parseMe(null)).toBeUndefined();
    expect(parseMe({ ...meBody, role: "x" })).toBeUndefined();
  });
  it("makes initials", () => {
    expect(initials({ name: "Tolu Adeyemi", email: "t@x.co" })).toBe("TA");
    expect(initials({ name: "", email: "kemi@x.co" })).toBe("KE");
  });
});

describe("notifications and search parsers", () => {
  it("parses notifications and drops bad rows and unsafe links", () => {
    const parsed = parseNotifications({
      unread: 1,
      notifications: [
        {
          id: 4,
          kind: "x",
          title: "12 submissions waiting",
          body: "b",
          href: "/review",
          createdAt: "2026-11-01T10:00:00Z",
          read: false,
        },
        { id: 5, title: "Bad link", href: "https://evil.example", read: true },
        { nope: true },
      ],
    });
    expect(parsed?.notifications).toHaveLength(2);
    expect(parsed?.notifications[1]?.href).toBeNull();
    expect(parseNotifications({})).toBeUndefined();
  });
  it("parses search groups", () => {
    const data = parseSearch({
      users: [{ id: "u", name: "Ada", email: "a@x" }],
      resources: [{ id: 3, title: "T", status: "live" }],
    });
    expect(data?.users[0]?.detail).toBe("a@x");
    expect(data?.resources[0]?.id).toBe("3");
    expect(data?.paths).toEqual([]);
  });
});

describe("sign-in copy", () => {
  const f = (code: string, extra = {}) => ({ ok: false as const, code, message: "m", ...extra });
  it("sorts failures", () => {
    expect(problemFrom(f("invalid_credentials")).kind).toBe("wrong");
    expect(problemFrom(f("too_many_attempts", { retryAfterSeconds: 900 }))).toEqual({
      kind: "paused",
      retryAfterSeconds: 900,
    });
    expect(problemFrom(f("network_error")).kind).toBe("offline");
    expect(problemFrom(f("unauthorized")).kind).toBe("session");
    expect(problemFrom(f("boom")).kind).toBe("server");
  });
  it("checks passwords and codes", () => {
    expect(passwordProblem("short1!")).toMatch(/12/);
    expect(passwordProblem("longenoughpassword!")).toMatch(/number/);
    expect(passwordProblem("longenoughpassword1")).toMatch(/symbol/);
    expect(passwordProblem("longenoughpassword1!")).toBeNull();
    expect(isSixDigits("123456")).toBe(true);
    expect(isSixDigits("12345a")).toBe(false);
  });
});

describe("idle handling", () => {
  const me = { sessionExpiresAt: 1000, sessionAbsoluteExpiresAt: 5000 };
  it("is ok well before the end", () => expect(idleState(me, 500, 10).kind).toBe("ok"));
  it("refreshes quietly for an active admin", () =>
    expect(idleState(me, 900, 10).kind).toBe("refresh"));
  it("warns an idle admin", () =>
    expect(idleState(me, 900, 600)).toEqual({ kind: "warn", secondsLeft: 100 }));
  it("expires at the idle end and at the hard cap", () => {
    expect(idleState(me, 1000, 0).kind).toBe("expired");
    expect(idleState({ ...me, sessionAbsoluteExpiresAt: 800 }, 800, 0).kind).toBe("expired");
  });
  it("never refreshes near the absolute cap", () => {
    const capped = { sessionExpiresAt: 1000, sessionAbsoluteExpiresAt: 950 };
    expect(idleState(capped, 900, 5).kind).toBe("warn");
  });
});

describe("time helpers", () => {
  const now = Date.parse("2026-11-11T12:00:00Z");
  it("formats relative times", () => {
    expect(relativeTime("2026-11-11T11:50:00Z", now)).toBe("10m ago");
    expect(relativeTime("2026-11-11T10:00:00Z", now)).toBe("2h ago");
    expect(relativeTime("2026-11-10T11:00:00Z", now)).toBe("Yesterday");
  });
  it("splits today from earlier", () => {
    expect(isToday(new Date(now).toISOString(), now)).toBe(true);
    expect(isToday("2026-11-01T12:00:00Z", now)).toBe(false);
  });
  it("formats waits", () => {
    expect(formatWait(900)).toBe("15 minutes");
    expect(formatWait(60)).toBe("1 minute");
    expect(formatWait(30)).toBe("30 seconds");
  });
});

describe("QR encoder", () => {
  it("draws finder patterns and the fixed dark module", () => {
    const m = encodeQr(
      "otpauth://totp/Matr%20Studio:ada%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Matr%20Studio",
    );
    const n = m.length;
    expect((n - 17) % 4).toBe(0);
    for (const [r, c] of [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ] as const) {
      expect(m[r]?.[c]).toBe(true);
      expect(m[r + 3]?.[c + 3]).toBe(true);
      expect(m[r + 1]?.[c + 1]).toBe(false);
    }
    expect(m[n - 8]?.[8]).toBe(true);
  });
  it("matches known format and version words", () => {
    expect(formatBits(0).toString(2).padStart(15, "0")).toBe("101010000010010");
    expect(versionBits(7)).toBe(0x07c94);
  });
  it("grows with the text and refuses what does not fit", () => {
    expect(encodeQr("hi").length).toBe(21);
    expect(encodeQr("x".repeat(100)).length).toBe(41);
    expect(() => encodeQr("x".repeat(300))).toThrow();
  });
});
