import { ROUTES } from "../routes";

/**
 * The pages and actions the command palette can jump to. Data only: adding a page is one more
 * entry here, the palette and its search follow. Settings has no route constant yet (lib/routes.ts),
 * so it is not listed; add it with the settings pages.
 */
export type CommandIcon =
  | "home"
  | "paths"
  | "library"
  | "saved"
  | "help"
  | "profile"
  | "settings"
  | "submit"
  | "theme";

export type CommandAction =
  | { kind: "navigate"; href: string }
  | { kind: "submit" }
  | { kind: "theme"; value: "dark" | "light" | "system" }
  | { kind: "search"; query: string }
  | { kind: "clear-recent" };

export type CommandPage = {
  id: string;
  title: string;
  icon: CommandIcon;
  keywords: readonly string[];
  action: CommandAction;
  /** Listed under "Jump to" when the query is empty (theme actions only show when searched). */
  jump: boolean;
};

export const COMMAND_PAGES: readonly CommandPage[] = [
  {
    id: "home",
    title: "Home",
    icon: "home",
    keywords: ["dashboard", "start"],
    action: { kind: "navigate", href: ROUTES.dashboard },
    jump: true,
  },
  {
    id: "paths",
    title: "Paths",
    icon: "paths",
    keywords: ["learning paths", "courses", "roadmap"],
    action: { kind: "navigate", href: ROUTES.app.paths },
    jump: true,
  },
  {
    id: "library",
    title: "Library",
    icon: "library",
    keywords: ["resources", "videos", "articles", "tools", "browse"],
    action: { kind: "navigate", href: ROUTES.app.library },
    jump: true,
  },
  {
    id: "saved",
    title: "Saved",
    icon: "saved",
    keywords: ["bookmarks", "favourites"],
    action: { kind: "navigate", href: ROUTES.app.saved },
    jump: true,
  },
  {
    id: "help",
    title: "Help centre",
    icon: "help",
    keywords: ["support", "contact", "faq", "question"],
    action: { kind: "navigate", href: ROUTES.app.help },
    jump: true,
  },
  {
    id: "profile",
    title: "Profile",
    icon: "profile",
    keywords: ["account", "me", "public profile", "photo", "edit profile"],
    action: { kind: "navigate", href: ROUTES.profile },
    jump: true,
  },
  {
    id: "settings",
    title: "Settings",
    icon: "settings",
    keywords: ["account", "email", "password", "notifications", "preferences", "delete account"],
    action: { kind: "navigate", href: ROUTES.settingsAccount },
    jump: true,
  },
  {
    id: "requests",
    title: "Your requests",
    icon: "help",
    keywords: ["help requests", "tickets", "support requests", "conversations"],
    action: { kind: "navigate", href: ROUTES.app.help },
    jump: true,
  },
  {
    id: "submit",
    title: "Submit a resource",
    icon: "submit",
    keywords: ["suggest", "add", "recommend", "upload"],
    action: { kind: "submit" },
    jump: true,
  },
  {
    id: "theme-dark",
    title: "Theme: dark",
    icon: "theme",
    keywords: ["appearance", "night", "switch"],
    action: { kind: "theme", value: "dark" },
    jump: false,
  },
  {
    id: "theme-light",
    title: "Theme: light",
    icon: "theme",
    keywords: ["appearance", "day", "switch"],
    action: { kind: "theme", value: "light" },
    jump: false,
  },
  {
    id: "theme-system",
    title: "Theme: system",
    icon: "theme",
    keywords: ["appearance", "automatic", "switch"],
    action: { kind: "theme", value: "system" },
    jump: false,
  },
];
