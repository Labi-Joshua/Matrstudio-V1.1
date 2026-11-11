import type { OwnProfile, ProfileVisibility } from "../auth/profile-api";

/**
 * "Choose what shows" (Figma "Public profile: choose what shows"): three sections the owner can
 * switch on or off for a public profile. The name, photo, bio and interests are always part of a
 * public profile; email, saved items and paths in progress are never shared.
 */
export type VisibilityKey = keyof ProfileVisibility;

export const VISIBILITY_OPTIONS: ReadonlyArray<{
  key: VisibilityKey;
  title: string;
  description: string;
  /** Short noun for the "Anyone with the link can see your ..." sentence. */
  noun: string;
}> = [
  {
    key: "stats",
    title: "Learning stats",
    description: "Paths finished, lessons done, time learned and streak",
    noun: "stats",
  },
  {
    key: "paths",
    title: "Completed paths",
    description: "Paths you’ve finished, with dates",
    noun: "completed paths",
  },
  {
    key: "submissions",
    title: "Approved submissions",
    description: "Resources you shared that are in the library",
    noun: "approved submissions",
  },
];

export const ALWAYS_PRIVATE = "Your email, saved items and paths in progress are never shown.";

export const DEFAULT_VISIBILITY: ProfileVisibility = {
  stats: true,
  paths: true,
  submissions: true,
};

export const toggleVisibility = (v: ProfileVisibility, key: VisibilityKey): ProfileVisibility => ({
  ...v,
  [key]: !v[key],
});

export const sameVisibility = (a: ProfileVisibility, b: ProfileVisibility) =>
  a.stats === b.stats && a.paths === b.paths && a.submissions === b.submissions;

/** "your stats, completed paths and approved submissions", or "your name, photo and bio" when none. */
export function sharedSummary(v: ProfileVisibility): string {
  const nouns = VISIBILITY_OPTIONS.filter((o) => v[o.key]).map((o) => o.noun);
  if (nouns.length === 0) return "your name, photo and bio";
  const last = nouns[nouns.length - 1];
  const joined = nouns.length === 1 ? last : `${nouns.slice(0, -1).join(", ")} and ${last}`;
  return `your ${joined}`;
}

/** Where a public profile lives. A plain path: a Worker rewrite serves /@name from the /u page. */
export const publicProfilePath = (username: string) => `/@${username}`;

/** The link as people read it: matrstudio.com/@ada. */
export const publicLinkText = (username: string) => `matrstudio.com/@${username}`;

export const publicLinkHref = (origin: string, username: string) =>
  `${origin}${publicProfilePath(username)}`;

/** The sentence under the "Public profile" switch. */
export function publicRowText(profile: Pick<OwnProfile, "isPublic" | "username" | "visibility">) {
  return profile.isPublic
    ? `On. Anyone with the link can see ${sharedSummary(profile.visibility)}.`
    : `Off. Only you can see this page. Turn it on to share it at ${publicLinkText(profile.username)}.`;
}

/** The username in a public page address: "/@ada" or "/u?name=ada". Null when there is none. */
export function usernameFromLocation(pathname: string, search: string): string | null {
  const fromPath = /^\/@([A-Za-z0-9_]{1,64})\/?$/.exec(pathname)?.[1];
  if (fromPath) return fromPath.toLowerCase();
  const name = new URLSearchParams(search).get("name")?.replace(/^@/, "").trim();
  return name ? name.toLowerCase().slice(0, 64) : null;
}
