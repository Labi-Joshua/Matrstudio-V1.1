import type { PathProgress } from "../auth/progress-api";
import type { BrowsePath } from "../pages/browse-paths";
import { ROUTES } from "../routes";
import { SITE_URL } from "../site";
import { isCompleted } from "./progress-logic";

/**
 * Sharing a finished path (Figma "Finish: share achievement") and the "Keep going" picks of the
 * completion card. There is no hosted achievement page or image, so what is shared is the path's
 * public page on the site (the learner's own app pages are private); nothing here invents a link.
 */

/** The public page of the path's topic, which is where anyone can follow the link. */
export const shareUrl = (path: BrowsePath, siteUrl: string = SITE_URL) =>
  `${siteUrl}${ROUTES.topic(path.topicSlug)}`;

export const shareText = (path: BrowsePath) => `I finished ${path.title} on Matr Studio.`;

export const linkedInUrl = (url: string) =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

/** The link as the card shows it, without the scheme ("matrstudio.com/paths/product"). */
export const displayUrl = (url: string) => url.replace(/^https?:\/\//, "");

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

type ShareEnv = {
  share?: (data: { title: string; text: string; url: string }) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
};

/**
 * "More options": the system share sheet when the browser has one, else the link is copied. A
 * dismissed sheet is not an error.
 */
export async function shareOrCopy(
  path: BrowsePath,
  url: string,
  env: ShareEnv,
): Promise<ShareOutcome> {
  if (env.share) {
    try {
      await env.share({ title: path.title, text: shareText(path), url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  return copyLink(url, env);
}

export async function copyLink(
  url: string,
  env: Pick<ShareEnv, "writeText">,
): Promise<ShareOutcome> {
  if (!env.writeText) return "failed";
  try {
    await env.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Up to two paths to try next: same topic first, never the one just finished or one already done. */
export function keepGoing(
  all: readonly BrowsePath[],
  entries: readonly PathProgress[],
  current: BrowsePath,
  limit = 2,
): BrowsePath[] {
  const done = new Set(entries.filter(isCompleted).map((e) => e.slug));
  const others = all.filter((p) => p.slug !== current.slug && !done.has(p.slug));
  const same = others.filter((p) => p.topicSlug === current.topicSlug);
  const rest = others.filter((p) => p.topicSlug !== current.topicSlug);
  return [...same, ...rest].slice(0, limit);
}
