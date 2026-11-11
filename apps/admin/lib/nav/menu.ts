import type { AdminArea, AdminLevel, AdminMe } from "../session/types";
import { ADMIN_ROUTES, normalisePath } from "./routes";

/**
 * The side menu (Figma Nav 1): sections OVERVIEW, CONTENT, REVIEW, PEOPLE, ADMIN, each item tied
 * to a permission area. `visibleItems` mirrors `menuFor()` in packages/backend/src/auth/admin-perms.ts
 * (an area is shown when its level is above none) with one design rule on top: the Curator view
 * shows Settings although `settings` is none, because Home curation is guarded by resources:manage.
 */
export type NavIconName =
  | "dashboard"
  | "metrics"
  | "resources"
  | "paths"
  | "review"
  | "users"
  | "support"
  | "team"
  | "roles"
  | "audit"
  | "settings";

export type NavItem = {
  id: AdminArea;
  label: string;
  href: string;
  icon: NavIconName;
  /** Other path prefixes that keep this item highlighted. */
  also?: readonly string[];
};

export type NavSectionId = "overview" | "content" | "review" | "people" | "admin";
export type NavSection = { id: NavSectionId; label: string; items: readonly NavItem[] };

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", href: ADMIN_ROUTES.dashboard, icon: "dashboard" },
      { id: "metrics", label: "Metrics", href: ADMIN_ROUTES.metrics, icon: "metrics" },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { id: "resources", label: "Resources", href: ADMIN_ROUTES.resources, icon: "resources" },
      { id: "paths", label: "Paths", href: ADMIN_ROUTES.paths, icon: "paths" },
    ],
  },
  {
    id: "review",
    label: "Review",
    items: [
      { id: "review_queues", label: "Review queues", href: ADMIN_ROUTES.review, icon: "review" },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      {
        id: "users_waitlist",
        label: "Users and waitlist",
        href: ADMIN_ROUTES.users,
        icon: "users",
      },
      { id: "support_inbox", label: "Support inbox", href: ADMIN_ROUTES.support, icon: "support" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { id: "admin_team", label: "Admin team", href: ADMIN_ROUTES.team, icon: "team" },
      { id: "roles", label: "Roles and permissions", href: ADMIN_ROUTES.roles, icon: "roles" },
      { id: "audit_log", label: "Audit log", href: ADMIN_ROUTES.audit, icon: "audit" },
      { id: "settings", label: "Settings", href: ADMIN_ROUTES.settings, icon: "settings" },
    ],
  },
];

const RANK: Record<AdminLevel, number> = { none: 0, view: 1, manage: 2 };

type Access = Pick<AdminMe, "permissions" | "menu">;

/** True when the admin may open this area (same rule as the backend's menuFor). */
export function canOpenArea(me: Access, area: AdminArea): boolean {
  if (area === "settings" && RANK[me.permissions.resources] >= RANK.manage) return true;
  return RANK[me.permissions[area]] > 0 && me.menu.includes(area);
}

/** The sections and items this admin sees; sections with no items are left out. */
export function visibleSections(me: Access): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canOpenArea(me, item.id)),
  })).filter((section) => section.items.length > 0);
}

export const isNavActive = (item: NavItem, pathname: string): boolean => {
  const here = normalisePath(pathname);
  return [item.href, ...(item.also ?? [])].some(
    (prefix) => here === prefix || here.startsWith(`${prefix}/`),
  );
};

const AREA_BY_PREFIX: readonly [string, AdminArea][] = NAV_SECTIONS.flatMap((s) =>
  s.items.map((item): [string, AdminArea] => [item.href, item.id]),
);

/** The permission area a path belongs to, or null for pages outside the menu (no gate). */
export function areaForPath(pathname: string): AdminArea | null {
  const here = normalisePath(pathname);
  for (const [prefix, area] of AREA_BY_PREFIX) {
    if (here === prefix || here.startsWith(`${prefix}/`)) return area;
  }
  return null;
}

/** Whether the admin may see this path. Unknown paths are left to the page (a 404 is not a 403). */
export function canOpenPath(me: Access, pathname: string): boolean {
  const area = areaForPath(pathname);
  return area === null ? true : canOpenArea(me, area);
}

/** First page an admin lands on (the dashboard when allowed, otherwise their first menu item). */
export function homeFor(me: Access): string {
  const first = visibleSections(me)[0]?.items[0];
  return canOpenArea(me, "dashboard")
    ? ADMIN_ROUTES.dashboard
    : (first?.href ?? ADMIN_ROUTES.signIn);
}
