import { ROUTES } from "../routes";

/**
 * Navigation model of the learner app shell (Figma "Navigation and notification": Learn group,
 * Support group). Pure data plus two helpers, so the sidebar, the rail and the phone drawer all
 * render the same items and the active rule is tested once.
 *
 * Every item links to a page inside the app (ROUTES.app, under /learn), never to the public
 * marketing pages. Settings has no destination yet: it is `href: null` and renders disabled with a
 * "coming soon" title.
 */
export type NavIcon = "home" | "paths" | "library" | "saved" | "help" | "settings";

export type NavItem = {
  id: string;
  label: string;
  icon: NavIcon;
  /** null = no destination yet: rendered disabled. */
  href: string | null;
};

/** The settings pages (no ROUTES entry yet; they are built separately). */
const SETTINGS_BASE = "/settings";

export const LEARN_NAV: readonly NavItem[] = [
  { id: "home", label: "Home", icon: "home", href: ROUTES.dashboard },
  { id: "paths", label: "Paths", icon: "paths", href: ROUTES.app.paths },
  { id: "library", label: "Library", icon: "library", href: ROUTES.app.library },
  { id: "saved", label: "Saved", icon: "saved", href: ROUTES.app.saved },
];

export const SUPPORT_NAV: readonly NavItem[] = [
  { id: "help", label: "Help centre", icon: "help", href: ROUTES.app.help },
  { id: "settings", label: "Settings", icon: "settings", href: null },
];

/** Drops a trailing slash (static export serves /dashboard/), keeping "/" as is. */
export function normalisePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/**
 * Whether an item is the current page. Only items that live inside the app can be current: the
 * marketing pages they link to have their own layout, so in practice this is Home on /dashboard.
 */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.href === null) return false;
  const here = normalisePath(pathname);
  const target = normalisePath(item.href);
  return here === target || (target !== "/" && here.startsWith(`${target}/`));
}

/**
 * In-app pages that are not menu items (or that deserve a more exact label than their menu item),
 * most specific first. Lesson pages (/learn/paths/{topic}/{path}/lessons/{lesson}) stay under
 * "Paths": the path's title is not known without the catalogue, so the breadcrumb does not guess.
 */
const OTHER_PAGES: readonly { href: string; label: string }[] = [
  { href: ROUTES.app.submit, label: "Submit a resource" },
  { href: `${ROUTES.app.help}/request`, label: "Your request" },
  { href: `${ROUTES.profile}/edit`, label: "Edit profile" },
  { href: ROUTES.profile, label: "Profile" },
  { href: SETTINGS_BASE, label: "Settings" },
];

const under = (here: string, href: string) => here === href || here.startsWith(`${href}/`);

/** The breadcrumb's last crumb ("Learn / Home"). Falls back to Home for pages not in the model. */
export function currentLabel(pathname: string): string {
  const here = normalisePath(pathname);
  const other = OTHER_PAGES.find((page) => under(here, page.href));
  if (other) return other.label;
  const item = [...LEARN_NAV, ...SUPPORT_NAV].find((entry) => isNavActive(entry, pathname));
  return item?.label ?? "Home";
}
