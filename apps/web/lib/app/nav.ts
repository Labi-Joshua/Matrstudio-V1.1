import { getCatalogue } from "../catalogue/data";
import { ROUTES } from "../routes";

/**
 * Navigation model of the learner app shell (Figma "Navigation and notification": Learn group,
 * Support group). Pure data plus two helpers, so the sidebar, the rail and the phone drawer all
 * render the same items and the active rule is tested once.
 *
 * Every item links to a page inside the app (ROUTES.app, under /learn), never to the public
 * marketing pages. An item with `href: null` renders disabled with a "coming soon" title (none do today).
 */
export type NavIcon = "home" | "paths" | "library" | "saved" | "help" | "settings";

export type NavItem = {
  id: string;
  label: string;
  icon: NavIcon;
  /** null = no destination yet: rendered disabled. */
  href: string | null;
};

/** The settings pages all live under this path ("/settings" redirects to the account page). */
const SETTINGS_BASE = "/settings";

export const LEARN_NAV: readonly NavItem[] = [
  { id: "home", label: "Home", icon: "home", href: ROUTES.dashboard },
  { id: "paths", label: "Paths", icon: "paths", href: ROUTES.app.paths },
  { id: "library", label: "Library", icon: "library", href: ROUTES.app.library },
  { id: "saved", label: "Saved", icon: "saved", href: ROUTES.app.saved },
];

export const SUPPORT_NAV: readonly NavItem[] = [
  { id: "help", label: "Help centre", icon: "help", href: ROUTES.app.help },
  { id: "settings", label: "Settings", icon: "settings", href: SETTINGS_BASE },
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

export type Crumb = {
  label: string /** null = the current page (not a link). */;
  href: string | null;
};

const SETTINGS_SECTIONS: Record<string, string> = {
  account: "Account",
  notifications: "Notifications",
  learning: "Learning",
  appearance: "Appearance",
  "confirm-email": "Confirm email",
};

const HELP_PAGES: Record<string, string> = {
  contact: "Contact support",
  report: "Report a problem",
  request: "Your request",
};

/**
 * The full breadcrumb trail for a page: every crumb except the last links to its page, so the
 * trail navigates up through the sub pages, not just the side menu. The trail is built from the
 * URL; the only names looked up are topics (a topic slug is a readable name already known here).
 */
export function breadcrumbs(pathname: string): Crumb[] {
  const here = normalisePath(pathname);
  const parts = here.split("/").filter(Boolean);
  const learn = (href: string | null): Crumb => ({ label: "Learn", href });
  const trail = (...crumbs: Crumb[]): Crumb[] =>
    crumbs.map((crumb, index) => (index === crumbs.length - 1 ? { ...crumb, href: null } : crumb));
  const home = ROUTES.dashboard;

  if (parts[0] === "learn") {
    const [, area, second, third] = parts;
    if (area === "paths") {
      const paths = { label: "Paths", href: ROUTES.app.paths };
      if (!second) return trail(learn(home), paths);
      const topic = { label: topicName(second), href: ROUTES.app.pathTopic(second) };
      if (!third) return trail(learn(home), paths, topic);
      return trail(learn(home), paths, topic, { label: "Lesson", href: null });
    }
    if (area === "library") {
      const library = { label: "Library", href: ROUTES.app.library };
      return second
        ? trail(learn(home), library, { label: "Resource", href: null })
        : trail(learn(home), library);
    }
    if (area === "saved") return trail(learn(home), { label: "Saved", href: null });
    if (area === "submit") return trail(learn(home), { label: "Submit a resource", href: null });
    if (area === "help") {
      const help = { label: "Help centre", href: ROUTES.app.help };
      const page = second ? HELP_PAGES[second] : undefined;
      return page
        ? trail(learn(home), help, { label: page, href: null })
        : trail(learn(home), help);
    }
  }
  if (parts[0] === "profile") {
    const profile = { label: "Profile", href: ROUTES.profile };
    return parts[1] === "edit"
      ? trail(learn(home), profile, { label: "Edit profile", href: null })
      : trail(learn(home), profile);
  }
  if (parts[0] === "settings") {
    const settings = { label: "Settings", href: ROUTES.settingsAccount };
    const section = parts[1] ? SETTINGS_SECTIONS[parts[1]] : undefined;
    return section
      ? trail(learn(home), settings, { label: section, href: null })
      : trail(learn(home), settings);
  }
  return trail(learn(null), { label: "Home", href: null });
}

function topicName(slug: string): string {
  return getCatalogue().topics.find((topic) => topic.slug === slug)?.name ?? slug;
}
