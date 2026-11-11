import { normaliseCommandQuery } from "./command-match";

/** Recent searches, kept on this device only. */
export const RECENT_KEY = "matr:recent-searches";
export const MAX_RECENT = 5;

/** Reads the stored value defensively: anything that is not a list of strings gives an empty list. */
export function parseRecent(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const clean = value
      .filter((v): v is string => typeof v === "string")
      .map(normaliseCommandQuery)
      .filter(Boolean);
    return [...new Set(clean)].slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** Puts a search first, drops a repeat (case-insensitive) and keeps at most MAX_RECENT. */
export function addRecent(list: readonly string[], query: string): string[] {
  const q = normaliseCommandQuery(query);
  if (!q) return [...list];
  const rest = list.filter((entry) => entry.toLowerCase() !== q.toLowerCase());
  return [q, ...rest].slice(0, MAX_RECENT);
}

export function readRecent(): string[] {
  try {
    return parseRecent(localStorage.getItem(RECENT_KEY));
  } catch {
    return [];
  }
}

export function writeRecent(list: readonly string[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(RECENT_KEY);
    else localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Storage can be blocked; the list still works for this visit.
  }
}

/**
 * Next active row for an arrow/Home/End key. `current` is null while nothing is active. Arrows
 * wrap around; with no rows nothing can be active.
 */
export function moveActive(
  current: number | null,
  count: number,
  key: "ArrowDown" | "ArrowUp" | "Home" | "End",
): number | null {
  if (count <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (current === null) return key === "ArrowDown" ? 0 : count - 1;
  return key === "ArrowDown" ? (current + 1) % count : (current - 1 + count) % count;
}
