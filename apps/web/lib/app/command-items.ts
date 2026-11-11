import { ROUTES } from "../routes";

/**
 * The pages and actions the command palette can jump to. Data only: adding a page (Profile,
 * Settings, Your requests) is one more entry here, the palette, its search and its icons follow.
 * Settings has no destination yet (see nav.ts), so it is not listed.
 */
export type CommandIcon = "home" | "paths" | "library" | "saved" | "help" | "submit" | "theme";

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
