import { describe, expect, it } from "vitest";
import { auditQueryString } from "./api";
import { actionLabel, humanizeAction, rangeFrom } from "./audit";
import { agoLabel, endOfDayIso, expiresLabel, initials, toMs, whenLabel } from "./format";
import {
  accessSummary,
  columnEnabled,
  diffPermissions,
  emptyPermissions,
  MATRIX_ROWS,
  menuPreview,
  rowCaption,
  rowLevel,
  setRowLevel,
} from "./matrix";
import { parseAuditPage, parseMembers, parseRoleDetail, parseRoles } from "./parse";

const row = (key: string) => {
  const r = MATRIX_ROWS.find((x) => x.key === key);
  if (!r) throw new Error(key);
  return r;
};

describe("format", () => {
  const now = new Date(2026, 10, 11, 12, 0).getTime();
  it("reads seconds, ms and ISO", () => {
    expect(toMs(1_700_000_000)).toBe(1_700_000_000_000);
    expect(toMs(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(toMs("2026-11-11T10:00:00Z")).toBe(Date.parse("2026-11-11T10:00:00Z"));
    expect(toMs("nope")).toBeNull();
  });
  it("labels dates", () => {
    expect(whenLabel(new Date(2026, 10, 11, 10, 42).getTime(), now)).toBe("Today, 10:42");
    expect(whenLabel(new Date(2026, 10, 10, 16, 3).getTime(), now)).toBe("Yesterday, 16:03");
    expect(whenLabel(new Date(2026, 10, 2, 14, 8).getTime(), now)).toBe("2 Nov, 14:08");
    expect(agoLabel(now - 2 * 3_600_000, now)).toBe("2h ago");
    expect(agoLabel(null, now)).toBe("Never");
    expect(expiresLabel(now + 3 * 86_400_000, now)).toBe("Expires in 3 days");
    expect(expiresLabel(now - 1, now)).toBe("Expired");
    expect(initials("Seyi Ade")).toBe("SA");
    expect(endOfDayIso("2026-11-30")).toMatch(/^2026-11-(30|29)T/);
  });
});

describe("matrix", () => {
  it("sets both areas of a grouped row and clamps to the ceiling", () => {
    const p = setRowLevel(emptyPermissions(), row("dashboard_metrics"), "view");
    expect(p.dashboard).toBe("view");
    expect(p.metrics).toBe("view");
    expect(setRowLevel(emptyPermissions(), row("team"), "manage").admin_team).toBe("view");
    expect(setRowLevel(emptyPermissions(), row("audit"), "manage").audit_log).toBe("view");
  });
  it("reports mixed rows and the Home curation caption", () => {
    const p = { ...emptyPermissions(), resources: "manage" as const };
    expect(rowLevel(p, row("resources_paths"))).toBe("mixed");
    expect(rowCaption(p, row("settings"))).toMatch(/Home curation/);
  });
  it("never lets Edit be picked and gates Manage by ceiling", () => {
    expect(columnEnabled(row("review"), "edit")).toBe(false);
    expect(columnEnabled(row("roles"), "manage")).toBe(false);
    expect(columnEnabled(row("roles"), "view")).toBe(true);
  });
  it("diffs by row and previews the menu", () => {
    const a = emptyPermissions();
    const b = setRowLevel(a, row("review"), "view");
    expect(diffPermissions(a, b)).toEqual([
      { label: "Review queues", before: "None", after: "View" },
    ]);
    expect(menuPreview(b).map((i) => i.label)).toEqual(["Review queues"]);
    const c = setRowLevel(a, row("resources_paths"), "manage");
    expect(menuPreview(c).at(-1)?.note).toBe("Home curation only");
    expect(accessSummary(a)).toBe("No access yet");
  });
});

describe("parsers", () => {
  it("parses members tolerantly", () => {
    const m = parseMembers({
      members: [
        {
          id: "1",
          email: "a@b.c",
          name: "A",
          roleId: "curator",
          roleName: "Curator",
          status: "active",
          lastSignInAt: 1_700_000_000,
          mfaEnrolled: true,
        },
        { nope: true },
      ],
    });
    expect(m).toHaveLength(1);
    expect(m?.[0]?.twoStep).toBe(true);
    expect(parseMembers({})).toBeUndefined();
  });
  it("parses roles and role detail", () => {
    const list = parseRoles({
      roles: [
        {
          id: "curator",
          name: "Curator",
          isSystem: true,
          members: 2,
          permissions: { resources: "manage" },
        },
      ],
    });
    expect(list?.roles[0]?.builtIn).toBe(true);
    expect(list?.roles[0]?.permissions.paths).toBe("none");
    const d = parseRoleDetail({
      role: { id: "x", name: "X", members: [{ id: "1", name: "A" }], permissions: {} },
    });
    expect(d?.members).toBe(1);
    expect(d?.memberList[0]?.name).toBe("A");
  });
  it("parses audit pages", () => {
    const p = parseAuditPage({
      entries: [
        {
          id: "1",
          at: "2026-11-11T10:42:00Z",
          actor: { name: "T", role: "Super admin" },
          action: "admin.role.assigned",
        },
      ],
      nextCursor: "c",
    });
    expect(p?.entries[0]?.actorRole).toBe("Super admin");
    expect(p?.nextCursor).toBe("c");
    expect(parseAuditPage(null)).toBeUndefined();
  });
});

describe("audit helpers", () => {
  it("labels actions and builds queries", () => {
    expect(actionLabel("admin.role.assigned")).toBe("Changed role");
    expect(humanizeAction("admin.some_thing.happened")).toBe("Some thing happened");
    expect(rangeFrom("all")).toBeUndefined();
    expect(rangeFrom("24h", 86_400_000 * 2)).toBe(new Date(86_400_000).toISOString());
    expect(auditQueryString({ actor: "a", action: "", from: "x" })).toBe("?actor=a&from=x");
  });
});
