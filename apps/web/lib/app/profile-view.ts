import { LEVEL_OPTIONS, TOPIC_OPTIONS } from "../pages/onboarding-content";

/** Words for the profile header and the public page. Pure. */

/** "September 2026" for an ISO time; empty when it cannot be read. */
export function monthYear(iso: string, locale = "en-GB"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
}

/** "3 Oct" for an ISO time. */
export function dayMonth(iso: string, locale = "en-GB"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
}

export const levelTitle = (level: string | null): string | null =>
  LEVEL_OPTIONS.find((o) => o.id === level)?.title ?? null;

/** Interest chips: the short topic names, in the order stored; unknown slugs are dropped. */
export function topicChips(topics: readonly string[]): string[] {
  return topics.flatMap((slug) => {
    const option = TOPIC_OPTIONS.find((o) => o.id === slug);
    return option ? [option.short] : [];
  });
}

/** "@ada · Beginner · Joined September 2026" (own view) or "... · Learning on Matr Studio since ..." (visitor). */
export function metaLine(input: {
  username: string;
  level: string | null;
  joinedAt: string;
  visitor?: boolean;
}): string {
  const month = monthYear(input.joinedAt);
  const parts = [`@${input.username}`];
  const level = levelTitle(input.level);
  if (level) parts.push(level);
  if (month)
    parts.push(input.visitor ? `Learning on Matr Studio since ${month}` : `Joined ${month}`);
  return parts.join(" · ");
}

/** "45 min", "12 hrs" or "2 hrs 10 min". */
export function learnedTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hrs` : `${hours} hrs ${rest} min`;
}
