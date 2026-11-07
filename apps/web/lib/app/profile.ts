import type { Me } from "../auth/api";
import { isLevelId, LEVEL_OPTIONS } from "../pages/onboarding-content";

/** Display helpers for the signed-in learner. Pure, so the shell and the dashboard share them. */

/** First word of the name, or null when there is no usable name. */
export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

/** "Welcome to Matr Studio, Ada" (no name: no comma, no placeholder). */
export function welcomeTitle(name: string | null | undefined): string {
  const first = firstName(name);
  return first ? `Welcome to Matr Studio, ${first}` : "Welcome to Matr Studio";
}

/** One or two letters for the avatar: name initials, else the email's first letter, else "?". */
export function initials(me: Pick<Me, "name" | "email">): string {
  const words = me.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  if (first) {
    return `${first.charAt(0)}${last ? last.charAt(0) : ""}`.toUpperCase();
  }
  const letter = me.email.trim().charAt(0);
  return letter ? letter.toUpperCase() : "?";
}

/** Name for menus: the name, else the email. */
export function displayName(me: Pick<Me, "name" | "email">): string {
  return me.name?.trim() || me.email;
}

/** "UI/UX", "UI/UX and Brand", "UI/UX, Brand and SEO". Empty list gives an empty string. */
export function joinWithAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The onboarding level as a label for the profile badge ("Beginner"), or null when unknown. */
export function levelBadge(level: string | null | undefined): string | null {
  if (!isLevelId(level)) return null;
  return LEVEL_OPTIONS.find((option) => option.id === level)?.title ?? null;
}
