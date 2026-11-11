import type { BrowsePath } from "../pages/browse-paths";
import { plural } from "./paths-catalogue";

/**
 * State of the Paths screens that does not depend on React: when a loading skeleton may show,
 * what "My paths" lists and says in each tab, and the starred toast copy.
 *
 * Items come from the learner’s path progress (lib/app/progress-logic.ts buildMine).
 */

// ---------------------------------------------------------------------------------------------
// Skeleton timing
// ---------------------------------------------------------------------------------------------

export const SKELETON_DELAY_MS = 150;
export const SKELETON_MIN_MS = 300;

export type Gate = { pendingSince: number | null; shownAt: number | null };
export const GATE_IDLE: Gate = { pendingSince: null, shownAt: null };

/**
 * Whether the skeleton shows, and how long until this should be asked again (null: never). Fast
 * responses never show it (it waits `delay`), and once shown it stays at least `min`, so it
 * cannot flash.
 */
export function gateStep(
  gate: Gate,
  pending: boolean,
  now: number,
  delay = SKELETON_DELAY_MS,
  min = SKELETON_MIN_MS,
): { gate: Gate; show: boolean; wakeIn: number | null } {
  if (pending) {
    const pendingSince = gate.pendingSince ?? now;
    if (gate.shownAt !== null)
      return { gate: { pendingSince, shownAt: gate.shownAt }, show: true, wakeIn: null };
    const left = delay - (now - pendingSince);
    return left <= 0
      ? { gate: { pendingSince, shownAt: now }, show: true, wakeIn: null }
      : { gate: { pendingSince, shownAt: null }, show: false, wakeIn: left };
  }
  if (gate.shownAt !== null) {
    const left = min - (now - gate.shownAt);
    if (left > 0)
      return { gate: { pendingSince: null, shownAt: gate.shownAt }, show: true, wakeIn: left };
  }
  return { gate: GATE_IDLE, show: false, wakeIn: null };
}

// ---------------------------------------------------------------------------------------------
// My paths
// ---------------------------------------------------------------------------------------------

export type MineFilter = "all" | "in-progress" | "starred" | "completed";
export const MINE_FILTERS: { value: MineFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in-progress", label: "In progress" },
  { value: "starred", label: "Starred" },
  { value: "completed", label: "Completed" },
];

export type MyPath = {
  path: BrowsePath;
  starred: boolean;
  /** Lessons finished; null when the path has not been started. */
  done: number | null;
  /** The server marked the path complete. Absent: derived from done and the lesson count. */
  completed?: boolean;
};

export type MineState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: MyPath[] };

export const isCompleted = (item: MyPath) =>
  item.completed ?? (item.done !== null && item.path.lessons > 0 && item.done >= item.path.lessons);
export const isInProgress = (item: MyPath) => item.done !== null && !isCompleted(item);

export function filterMine(items: readonly MyPath[], filter: MineFilter): MyPath[] {
  return items.filter((item) =>
    filter === "all"
      ? true
      : filter === "starred"
        ? item.starred
        : filter === "completed"
          ? isCompleted(item)
          : isInProgress(item),
  );
}

export const percentDone = (item: MyPath) =>
  item.path.lessons > 0 && item.done !== null
    ? Math.min(100, Math.round((item.done / item.path.lessons) * 100))
    : 0;

/** "Lesson 5 of 10 · 40%" for a started path; null when not started or finished. */
export function progressLabel(item: MyPath): string | null {
  if (!isInProgress(item) || item.done === null) return null;
  return `Lesson ${Math.min(item.done + 1, item.path.lessons)} of ${item.path.lessons} · ${percentDone(item)}%`;
}

export type MineEmpty = {
  title: string;
  body: string;
  /** Where the button goes: the Explore tab, or another My paths tab. */
  action: { label: string; to: "explore" | MineFilter };
};

/** The empty state of a tab (Figma "New account, no paths" and "Completed, none yet"). */
export function mineEmptyCopy(filter: MineFilter): MineEmpty {
  switch (filter) {
    case "in-progress":
      return {
        title: "Nothing in progress",
        body: "Paths you have started will show up here with your progress.",
        action: { label: "Explore paths", to: "explore" },
      };
    case "starred":
      return {
        title: "No starred paths",
        body: "Star a path to keep it close, and it will wait for you here.",
        action: { label: "Explore paths", to: "explore" },
      };
    case "completed":
      return {
        title: "No completed paths yet",
        body: "Mark every lesson in a path as done and it’ll show up here.",
        action: { label: "See paths in progress", to: "in-progress" },
      };
    default:
      return {
        title: "Your paths will live here",
        body: "Paths you start or star will appear here with your progress.",
        action: { label: "Explore paths", to: "explore" },
      };
  }
}

export const mineCountLabel = (n: number) => `${n} ${plural(n, "path", "paths")}`;

/** The tab filters only make sense once there is something to filter. */
export const showMineFilters = (items: readonly MyPath[]) => items.length > 0;

// ---------------------------------------------------------------------------------------------
// Starred toast (Figma "Path detail starred")
// ---------------------------------------------------------------------------------------------

export function starToastCopy(pathTitle: string): { title: string; body: string } {
  return {
    title: "Saved to Your paths",
    body: `${pathTitle} is in your sidebar. Start whenever you’re ready.`,
  };
}

export const STAR_HINT = "Not sure it’s for you? Star it and it’ll wait in Your paths.";
export const STARRED_HINT = "Saved to Your paths. Start whenever you’re ready.";
