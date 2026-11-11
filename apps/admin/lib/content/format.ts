/** "18 min", "1 h 5 min", or "" when unknown. */
export function durationLabel(minutes: number | null | undefined, type?: string): string {
  if (!minutes || minutes <= 0) return "";
  const unit = type === "article" ? "min read" : "min";
  if (minutes < 120) return `${minutes} ${unit}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "YouTube · Figma Academy · 18 min" with empty parts dropped. */
export function metaLine(parts: (string | null | undefined)[]): string {
  return parts.filter((p): p is string => Boolean(p)).join(" · ");
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en")} ${n === 1 ? one : many}`;
}

/** "Today", "Yesterday", "3 days ago", "1 week ago", else "12 Oct". Local time. */
export function relativeDay(iso: string | null, now = new Date()): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const day = 86_400_000;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(then)) / day);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  if (diff < 14) return "1 week ago";
  if (diff < 31) return `${Math.floor(diff / 7)} weeks ago`;
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "2 min ago", "just now", else a date. */
export function savedAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return "not saved yet";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "not saved yet";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function dateTimeLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${relativeDay(iso)}, ${time}`;
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function parseMinutes(text: string): number | null {
  const n = Number.parseInt(text.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
