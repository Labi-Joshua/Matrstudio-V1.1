import type { SettingsAccess } from "./api";
import { KIND_LABEL, type SettingsTab, type TaxonomyItem, WEEKDAYS, type Weekday } from "./types";

export const TABS: { id: SettingsTab; label: string; short: string }[] = [
  { id: "topics", label: "Topics and tags", short: "Tags" },
  { id: "home", label: "Home curation", short: "Home" },
  { id: "templates", label: "Email templates", short: "Emails" },
  { id: "nudges", label: "Nudge rules", short: "Nudges" },
  { id: "targets", label: "Queue targets", short: "Targets" },
];

export type TabAccess = {
  /** Tabs this admin may open, in order. */
  tabs: SettingsTab[];
  /** Tabs this admin may change (view-only otherwise). */
  editable: SettingsTab[];
};

/**
 * Admin-only tabs need the settings area; Home curation also opens for anyone who can manage
 * resources (a Curator sees only that tab) and is written with resources:manage.
 */
export function accessFor(access: Pick<SettingsAccess, "settings" | "resources">): TabAccess {
  const settingsAny = access.settings === "view" || access.settings === "manage";
  const curator = access.resources === "manage";
  const tabs: SettingsTab[] = [];
  const editable: SettingsTab[] = [];
  for (const tab of TABS) {
    if (tab.id === "home") {
      if (settingsAny || curator) tabs.push("home");
      if (curator) editable.push("home");
    } else if (settingsAny) {
      tabs.push(tab.id);
      if (access.settings === "manage") editable.push(tab.id);
    }
  }
  return { tabs, editable };
}

/** The tab named by `?tab=`, when allowed; otherwise the first allowed one. */
export function tabFromSearch(search: string, allowed: SettingsTab[]): SettingsTab | undefined {
  const wanted = new URLSearchParams(search).get("tab");
  return allowed.find((t) => t === wanted) ?? allowed[0];
}

export function move<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length)
    return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export const removeAt = <T>(list: readonly T[], index: number): T[] =>
  list.filter((_, i) => i !== index);

export const isDirty = (a: unknown, b: unknown): boolean => JSON.stringify(a) !== JSON.stringify(b);

/** Why a taxonomy name cannot be used, or null. Names are unique per kind, ignoring case. */
export function taxonomyNameError(
  name: string,
  kind: TaxonomyItem["kind"],
  items: readonly TaxonomyItem[],
  selfId?: string,
): string | null {
  const clean = name.trim();
  if (!clean) return "Enter a name.";
  if (clean.length > 60) return "Use 60 characters or fewer.";
  const clash = items.some(
    (i) =>
      i.id !== selfId && i.kind === kind && i.name.trim().toLowerCase() === clean.toLowerCase(),
  );
  return clash ? `A ${KIND_LABEL[kind].toLowerCase()} called “${clean}” already exists.` : null;
}

export const optionLabel = (item: TaxonomyItem) => `${item.name} (${item.kind})`;

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

/** Sample data for the template preview. */
export const SAMPLE: Record<string, string> = {
  first_name: "Ada",
  name: "Ada Obi",
  path_name: "UI/UX Foundations",
  next_lesson: "lesson 10",
  progress: "38%",
  minutes: "15",
  reason: "the link no longer opens",
  title: "Figma auto layout guide",
  link: "https://matrstudio.com",
};

const VARIABLE = /\{([a-z_][a-z0-9_]*)\}/gi;

/** Fills `{variable}` placeholders; unknown ones stay as written so the gap is visible. */
export function renderTemplate(text: string, sample: Record<string, string> = SAMPLE): string {
  return text.replace(VARIABLE, (whole, name: string) => sample[name] ?? whole);
}

/** Variables used in `text` that the template does not offer. */
export function unknownVariables(text: string, allowed: readonly string[]): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(VARIABLE)) {
    const name = match[1] as string;
    if (!allowed.includes(name)) found.add(name);
  }
  return [...found];
}

/** Text with `{variable}` put in place of the selection; also returns where the caret goes. */
export function insertVariable(text: string, start: number, end: number, name: string) {
  const token = `{${name}}`;
  const a = Math.max(0, Math.min(start, text.length));
  const b = Math.max(a, Math.min(end, text.length));
  return { text: text.slice(0, a) + token + text.slice(b), caret: a + token.length };
}

export const FIRST_NUDGE_DAYS = [2, 3, 4, 5, 7];
export const SECOND_NUDGE_DAYS = [5, 7, 10, 14];
export const MAX_PER_WEEK = [1, 2, 3];

export const dayLabel = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
export const perWeekLabel = (n: number) => `${n} a week`;

export function nudgeError(first: number, second: number): string | null {
  return second > first ? null : "The second nudge has to come after the first one.";
}

export const nudgeTimeline = (first: number, second: number) => [
  "No activity",
  `Day ${first}: first nudge`,
  `Day ${second}: last nudge`,
  "Then stop",
];

export const REVIEW_DAYS = [1, 2, 3, 5, 7, 10];
export const LINK_REPORT_DAYS = [1, 2, 3, 5, 7];
export const FIRST_REPLY_DAYS = [1, 2, 3, 4, 5];
export const AUTO_RESOLVE_DAYS = [3, 5, 7, 10, 14];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export function toggleDay(days: readonly Weekday[], day: Weekday): Weekday[] {
  const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
  return WEEKDAYS.filter((d) => next.includes(d));
}

export const targetsError = (days: readonly Weekday[]) =>
  days.length === 0 ? "Pick at least one working day." : null;

/** Keeps a stored value selectable even when it is not one of the usual options. */
export function withCurrent(options: readonly number[], current: number): number[] {
  return options.includes(current) ? [...options] : [...options, current].sort((a, b) => a - b);
}
