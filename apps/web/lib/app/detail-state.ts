import type { Level } from "../catalogue/types";
import { buildMailto } from "./help-form";
import type { LibraryItem, LibraryKind } from "./library-data";

/**
 * Pure logic of the resource page: the "About this resource" line, where "open" goes on each
 * screen size, and the report-a-broken-link email.
 *
 * TODO(support-api): there is no support API, so "Report a broken link" opens the learner's email
 * app with a prefilled mailto: to hello@matrstudio.com (the same honest approach as the Help
 * screens, lib/app/help-form.ts). When the API exists, post { resourceId, url } instead.
 */

const KIND_NOUN: Record<LibraryKind, string> = {
  video: "video",
  article: "article",
  tool: "tool",
};

/** Host shown in the reading window's address bar: "nngroup.com", never the full URL. */
export function resourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * One factual sentence built only from what the catalogue knows. The design also has a written
 * description and a "Why it's here" line; the data has neither, so they are not invented.
 */
export function aboutText(item: LibraryItem, levelText: (level: Level) => string): string {
  const level = item.level ? `${levelText(item.level).toLowerCase()} ` : "";
  const noun = KIND_NOUN[item.kind];
  const article = /^[aeiou]/i.test(`${level}${noun}`) ? "an" : "a";
  const topic = item.topicName ? ` on ${item.topicName}` : "";
  const length = item.kind === "tool" ? "Free to use." : `Length: ${item.lengthLabel}.`;
  return `${article[0]?.toUpperCase()}${article.slice(1)} ${level}${noun}${topic}, from ${item.sourceName}. ${length}`;
}

/** Articles open in the in-app reading window on tablet and desktop, and in a new tab on phones. */
export type OpenMode = "window" | "tab";

export function openMode(kind: LibraryKind, wide: boolean): OpenMode {
  return kind === "article" && wide ? "window" : "tab";
}

/** What the source card shows: nothing opened yet, the reading window open, or opened in a tab. */
export type OpenState = "idle" | "window" | "tab";
export type OpenAction = "open-window" | "open-tab" | "close-window";

export function nextOpenState(state: OpenState, action: OpenAction): OpenState {
  if (action === "open-window") return "window";
  if (action === "open-tab") return "tab";
  return state === "window" ? "idle" : state;
}

export function reportLinkMailto(item: LibraryItem, accountEmail: string): string {
  return buildMailto(`Broken link: ${item.title}`, [
    "This resource link looks broken or wrong.",
    "",
    `Resource: ${item.title} (${item.id})`,
    item.url ? `Link: ${item.url}` : "",
    `Reply to: ${accountEmail}`,
  ]);
}
