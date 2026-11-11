import type { Stat } from "./types";

const MINUS = "−";

export const formatCount = (n: number): string => Math.round(n).toLocaleString("en-US");

/** "9h 40m", "20m", "9h", "11h 05m". */
export function formatMinutes(total: number): string {
  const minutes = Math.round(Math.abs(total));
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}

export const formatPercent = (n: number): string => `${Math.round(n)}%`;

export function formatStatValue(stat: Pick<Stat, "value" | "unit">): string {
  if (stat.unit === "percent") return formatPercent(stat.value);
  if (stat.unit === "minutes") return formatMinutes(stat.value);
  return formatCount(stat.value);
}

export type Delta = { text: string; tone: "good" | "bad" | "neutral"; spoken: string };

const trim = (n: number) => String(Math.round(n * 10) / 10);

/** The chip beside a stat: "+12%", "-2", "+5 pts", "-20m"; undefined when there is nothing to compare. */
export function computeDelta(stat: Stat): Delta | undefined {
  if (stat.previous === null) return undefined;
  const diff = stat.value - stat.previous;
  const dir = diff > 0 ? "up" : "down";
  let body: string;
  let spoken: string;
  if (diff === 0) {
    body = stat.compare === "relative" ? "0%" : "0";
    spoken = "no change";
  } else if (stat.compare === "relative") {
    if (stat.previous === 0) {
      body = "New";
      spoken = "new this period";
    } else {
      const pct = Math.round((Math.abs(diff) / Math.abs(stat.previous)) * 100);
      body = `${pct}%`;
      spoken = `${dir} ${pct}%`;
    }
  } else if (stat.unit === "percent") {
    body = `${trim(Math.abs(diff))} pts`;
    spoken = `${dir} ${trim(Math.abs(diff))} points`;
  } else if (stat.unit === "minutes") {
    body = formatMinutes(diff);
    spoken = `${dir} ${body}`;
  } else {
    body = trim(Math.abs(diff));
    spoken = `${dir} ${body}`;
  }
  const text = diff === 0 || body === "New" ? body : `${diff > 0 ? "+" : MINUS}${body}`;
  let tone: Delta["tone"] = "neutral";
  if (diff !== 0 && stat.better !== "neutral") {
    tone = diff > 0 === (stat.better === "up") ? "good" : "bad";
  }
  return { text, tone, spoken };
}

/** "10m ago", "3h ago", "yesterday", "12 Oct". `now` is injectable for tests. */
export function relativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "Today, 10:12", "Yesterday", else "12 Oct". */
export function lastSearched(iso: string | null, now = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (day(d) === day(now)) {
    return `Today, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  if (day(d) === day(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const percentOf = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;
