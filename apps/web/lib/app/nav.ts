import { ROUTES } from "../routes";

/**
 * Navigation model of the learner app shell (Figma "Navigation and notification": Learn group,
 * Support group). Pure data plus two helpers, so the sidebar, the rail and the phone drawer all
 * render the same items and the active rule is tested once.
 *
 * Paths, Library and Saved have no screens inside the app yet, so they link to the marketing
 * pages (the closest existing pages). Settings has no destination at all: it is `href: null` and
 * renders disabled with a "coming soon" title.
 */
export type NavIcon = "home" | "paths" | "library" | "saved" | "help" | "settings";

export type NavItem = {
  id: string;
  label: string;
  icon: NavIcon;
  /** null = no destination yet: rendered disabled. */
  href: string | null;
};

export const LEARN_NAV: readonly NavItem[] = [
  { id: "home", label: "Home", icon: "home", href: ROUTES.dashboard },
  { id: "paths", label: "Paths", icon: "paths", href: ROUTES.paths },
  { id: "library", label: "Library", icon: "library", href: ROUTES.library },
  { id: "saved", label: "Saved", icon: "saved", href: ROUTES.saved },
];

export const SUPPORT_NAV: readonly NavItem[] = [
  { id: "help", label: "Help centre", icon: "help", href: ROUTES.help },
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

/** The breadcrumb's last crumb ("Learn / Home"). Falls back to Home for pages not in the model. */
export function currentLabel(pathname: string): string {
  return LEARN_NAV.find((item) => isNavActive(item, pathname))?.label ?? "Home";
}
