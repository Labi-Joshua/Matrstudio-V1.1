import type { AdminMe } from "../session/types";
import { canOpenArea, NAV_SECTIONS, type NavSection } from "./menu";
import { normalisePath } from "./routes";

export type Crumb = { label: string; href: string | null };

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  metrics: "Metrics",
  learners: "Learners",
  paths: "Paths",
  library: "Library",
  emails: "Emails",
  support: "Support",
  resources: "Resources",
  review: "Review queues",
  submissions: "Submissions",
  "link-reports": "Link reports",
  "profile-reports": "Profile reports",
  users: "Users and waitlist",
  waitlist: "Waitlist",
  team: "Admin team",
  invites: "Pending invites",
  roles: "Roles and permissions",
  audit: "Audit log",
  settings: "Settings",
  topics: "Topics and tags",
  "home-curation": "Home curation",
  "email-templates": "Email templates",
  "nudge-rules": "Nudge rules",
  "queue-targets": "Queue targets",
};

const LABEL_BY_ROOT: Record<string, string> = {
  dashboard: "Dashboard",
  metrics: "Metrics",
  resources: "Resources",
  paths: "Paths",
  review: "Review queues",
  users: "Users and waitlist",
  support: "Support inbox",
  team: "Admin team",
  roles: "Roles and permissions",
  audit: "Audit log",
  settings: "Settings",
};

const sectionOf = (root: string): NavSection | undefined =>
  NAV_SECTIONS.find((s) => s.items.some((item) => item.href === `/${root}`));

const singular = (label: string) => (label.endsWith("s") ? label.slice(0, -1) : label);

function labelFor(segment: string, parentLabel: string | undefined, isRoot: boolean): string {
  if (isRoot && LABEL_BY_ROOT[segment]) return LABEL_BY_ROOT[segment];
  if (segment === "detail") return parentLabel ? singular(parentLabel) : "Detail";
  if (segment === "new") return parentLabel ? `New ${singular(parentLabel).toLowerCase()}` : "New";
  if (segment === "edit") return "Edit";
  const known = SEGMENT_LABELS[segment];
  if (known) return known;
  const words = decodeURIComponent(segment).replace(/[-_]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The trail for a path, every level a link except the page you are on ("Overview / Metrics /
 * Learners"). The first crumb is the menu section (it links to the first page of that section the
 * admin may open). Paths outside the menu get a plain trail from their segments.
 */
export function breadcrumbs(pathname: string, me?: Pick<AdminMe, "permissions" | "menu">): Crumb[] {
  const parts = normalisePath(pathname).split("/").filter(Boolean);
  if (parts.length === 0) return [{ label: "Dashboard", href: null }];
  const crumbs: Crumb[] = [];
  const section = sectionOf(parts[0] as string);
  if (section) {
    const target =
      section.items.find((item) => (me ? canOpenArea(me, item.id) : true)) ?? section.items[0];
    crumbs.push({ label: section.label, href: target?.href ?? null });
  }
  let href = "";
  let parent: string | undefined;
  parts.forEach((segment, index) => {
    href += `/${segment}`;
    const label = labelFor(segment, parent, index === 0);
    parent = label;
    crumbs.push({ label, href });
  });
  // The page you are on is plain text; every level above it stays a link.
  const last = crumbs.length - 1;
  return crumbs.map((crumb, index) => {
    if (index === last) return { ...crumb, href: null };
    return crumb;
  });
}
