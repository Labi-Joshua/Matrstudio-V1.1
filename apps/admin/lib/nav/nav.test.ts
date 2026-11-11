import { describe, expect, it } from "vitest";
import {
  ADMIN_AREAS,
  type AdminLevel,
  type AdminMe,
  type AdminPermissions,
} from "../session/types";
import { breadcrumbs } from "./breadcrumbs";
import { areaForPath, canOpenPath, homeFor, visibleSections } from "./menu";
import { ADMIN_ROUTES, safeNext } from "./routes";
import { flattenHits, hitHref, normaliseQuery, shownGroups } from "./search";

function access(levels: Partial<Record<(typeof ADMIN_AREAS)[number], AdminLevel>>) {
  const permissions = Object.fromEntries(
    ADMIN_AREAS.map((a) => [a, levels[a] ?? "none"]),
  ) as AdminPermissions;
  const menu = ADMIN_AREAS.filter((a) => permissions[a] !== "none");
  return { permissions, menu } satisfies Pick<AdminMe, "permissions" | "menu">;
}

const superAdmin = access({
  dashboard: "manage",
  metrics: "manage",
  resources: "manage",
  paths: "manage",
  review_queues: "manage",
  users_waitlist: "manage",
  support_inbox: "manage",
  admin_team: "manage",
  roles: "manage",
  audit_log: "view",
  settings: "manage",
});
const curator = access({
  dashboard: "view",
  metrics: "view",
  resources: "manage",
  paths: "manage",
  review_queues: "manage",
});
const support = access({
  dashboard: "view",
  metrics: "view",
  users_waitlist: "manage",
  support_inbox: "manage",
});

const labels = (me: ReturnType<typeof access>) =>
  visibleSections(me).flatMap((s) => s.items.map((i) => i.label));

describe("role-aware menu", () => {
  it("super admin sees all 11 items in the five sections", () => {
    expect(labels(superAdmin)).toHaveLength(11);
    expect(visibleSections(superAdmin).map((s) => s.label)).toEqual([
      "Overview",
      "Content",
      "Review",
      "People",
      "Admin",
    ]);
  });
  it("curator sees dashboard, metrics, resources, paths, review and Settings (home curation)", () => {
    expect(labels(curator)).toEqual([
      "Dashboard",
      "Metrics",
      "Resources",
      "Paths",
      "Review queues",
      "Settings",
    ]);
  });
  it("support sees dashboard, metrics, users and support inbox", () => {
    expect(labels(support)).toEqual([
      "Dashboard",
      "Metrics",
      "Users and waitlist",
      "Support inbox",
    ]);
  });
  it("gates pages by area", () => {
    expect(areaForPath("/review/submissions/detail")).toBe("review_queues");
    expect(canOpenPath(support, "/resources")).toBe(false);
    expect(canOpenPath(curator, "/settings/home-curation")).toBe(true);
    expect(canOpenPath(curator, "/team")).toBe(false);
    expect(canOpenPath(support, "/something-else")).toBe(true);
  });
  it("sends an admin without a dashboard to their first page", () => {
    expect(homeFor(access({ support_inbox: "view" }))).toBe("/support");
    expect(homeFor(superAdmin)).toBe("/dashboard");
  });
});

describe("breadcrumbs", () => {
  it("links every level except the last", () => {
    expect(breadcrumbs("/metrics/learners", superAdmin)).toEqual([
      { label: "Overview", href: "/dashboard" },
      { label: "Metrics", href: "/metrics" },
      { label: "Learners", href: null },
    ]);
  });
  it("names detail pages after their list", () => {
    const crumbs = breadcrumbs("/resources/detail", superAdmin);
    expect(crumbs.map((c) => c.label)).toEqual(["Content", "Resources", "Resource"]);
    expect(crumbs[1]?.href).toBe("/resources");
  });
  it("section crumb points at the first page the role can open", () => {
    expect(breadcrumbs("/paths", curator)[0]).toEqual({ label: "Content", href: "/resources" });
    expect(breadcrumbs("/users", support)[0]?.href).toBe("/users");
  });
  it("handles trailing slashes", () => {
    expect(breadcrumbs("/dashboard/").map((c) => c.label)).toEqual(["Overview", "Dashboard"]);
  });
});

describe("safeNext", () => {
  it("keeps same-site paths only", () => {
    expect(safeNext("/team?x=1")).toBe("/team?x=1");
    expect(safeNext("https://evil.example")).toBe(ADMIN_ROUTES.dashboard);
    expect(safeNext("//evil.example")).toBe(ADMIN_ROUTES.dashboard);
    expect(safeNext("/sign-in")).toBe(ADMIN_ROUTES.dashboard);
    expect(safeNext(null)).toBe(ADMIN_ROUTES.dashboard);
  });
});

describe("search model", () => {
  const data = {
    users: [{ group: "users" as const, id: "u1", title: "Ada Obi", detail: "ada@example.com" }],
    resources: [
      { group: "resources" as const, id: "r 1", title: "Adaptive layouts", detail: "live" },
    ],
    paths: [],
    submissions: [
      { group: "submissions" as const, id: "s1", title: "Colour tokens", detail: "in_review" },
    ],
  };
  it("hides groups the role cannot open and flattens in order", () => {
    const groups = shownGroups(data, curator);
    expect(groups.map((g) => g.id)).toEqual(["resources", "submissions"]);
    expect(flattenHits(groups).map((h) => h.id)).toEqual(["r 1", "s1"]);
  });
  it("builds deep links with encoded ids", () => {
    expect(hitHref(data.resources[0] as never)).toBe("/resources/detail?id=r%201");
  });
  it("normalises queries", () => {
    expect(normaliseQuery("  a   b ")).toBe("a b");
    expect(normaliseQuery("x".repeat(300))).toHaveLength(100);
  });
});
