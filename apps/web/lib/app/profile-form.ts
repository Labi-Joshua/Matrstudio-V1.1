import type { OwnProfile, ProfileEdit } from "../auth/profile-api";

/**
 * Edit profile form logic. The limits mirror packages/types (USERNAME_MIN/MAX, DISPLAY_NAME_MAX,
 * BIO_MAX, RESERVED_USERNAMES): the web app does not depend on that package, so keep them in step.
 * The API is the authority; this only answers sooner.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const DISPLAY_NAME_MAX = 60;
export const BIO_MAX = 200;

export const RESERVED_USERNAMES: readonly string[] = [
  "about",
  "account",
  "admin",
  "administrator",
  "api",
  "app",
  "assets",
  "auth",
  "billing",
  "blog",
  "contact",
  "dashboard",
  "help",
  "home",
  "invite",
  "learn",
  "library",
  "login",
  "logout",
  "mail",
  "matr",
  "matrstudio",
  "me",
  "mission",
  "moderator",
  "null",
  "official",
  "onboarding",
  "paths",
  "privacy",
  "profile",
  "register",
  "root",
  "saved",
  "security",
  "settings",
  "signin",
  "signout",
  "signup",
  "staff",
  "submit",
  "support",
  "system",
  "team",
  "terms",
  "undefined",
  "user",
  "users",
  "verify",
  "www",
];

/** Usernames are case-insensitive and stored lower-case. */
export const normaliseUsername = (value: string) => value.trim().toLowerCase();

export type UsernameProblem = "empty" | "short" | "long" | "characters" | "reserved";

/** Why a username cannot be used, or null when it is fine to ask the API about. */
export function usernameProblem(raw: string): UsernameProblem | null {
  const name = normaliseUsername(raw);
  if (name === "") return "empty";
  if (!/^[a-z0-9_]+$/.test(name)) return "characters";
  if (name.length < USERNAME_MIN) return "short";
  if (name.length > USERNAME_MAX) return "long";
  if (RESERVED_USERNAMES.includes(name)) return "reserved";
  return null;
}

export const USERNAME_HELP = "Letters, numbers and underscores. Used for your public profile link.";

const USERNAME_MESSAGES: Record<UsernameProblem, string> = {
  empty: "Enter a username.",
  short: `Use at least ${USERNAME_MIN} characters.`,
  long: `Use at most ${USERNAME_MAX} characters.`,
  characters: "Use only letters, numbers and underscores.",
  reserved: "That username isn’t available.",
};

export const usernameMessage = (problem: UsernameProblem) => USERNAME_MESSAGES[problem];

/** Up to two alternatives to offer when a username is taken (not checked against the API). */
export function usernameSuggestions(taken: string, displayName: string): string[] {
  const base = normaliseUsername(taken);
  const fromName = displayName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const candidates = [fromName, `${base}_design`, `${base}_studio`];
  const out: string[] = [];
  for (const candidate of candidates) {
    if (candidate === base || out.includes(candidate)) continue;
    if (usernameProblem(candidate) !== null) continue;
    out.push(candidate);
    if (out.length === 2) break;
  }
  return out;
}

export function takenMessage(taken: string, displayName: string): string {
  const options = usernameSuggestions(taken, displayName);
  if (options.length === 0) return "That username is taken. Try another.";
  return `That username is taken. Try ${options.join(" or ")}.`;
}

export type NameProblem = "empty" | "long" | "control";

export function nameProblem(raw: string): NameProblem | null {
  const name = raw.trim();
  if (name === "") return "empty";
  if (name.length > DISPLAY_NAME_MAX) return "long";
  if ([...name].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127)) return "control";
  return null;
}

export const nameMessage = (problem: NameProblem) =>
  problem === "empty"
    ? "Enter your name."
    : `Use up to ${DISPLAY_NAME_MAX} characters, no symbols.`;

export const bioLength = (raw: string) => raw.trim().length;
export const bioCounter = (raw: string) => `${bioLength(raw)} / ${BIO_MAX}`;
export const bioTooLong = (raw: string) => bioLength(raw) > BIO_MAX;

export type ProfileDraft = { displayName: string; username: string; bio: string };

export const draftFromProfile = (profile: OwnProfile): ProfileDraft => ({
  displayName: profile.displayName,
  username: profile.username,
  bio: profile.bio,
});

/** Field messages for the draft; empty when everything can be sent. */
export function draftErrors(draft: ProfileDraft): Partial<Record<keyof ProfileDraft, string>> {
  const errors: Partial<Record<keyof ProfileDraft, string>> = {};
  const name = nameProblem(draft.displayName);
  if (name) errors.displayName = nameMessage(name);
  const user = usernameProblem(draft.username);
  if (user) errors.username = usernameMessage(user);
  if (bioTooLong(draft.bio)) errors.bio = `Keep your bio to ${BIO_MAX} characters.`;
  return errors;
}

/** Only the fields that changed, trimmed and normalised the way the API stores them. */
export function draftChanges(profile: OwnProfile, draft: ProfileDraft): ProfileEdit {
  const changes: ProfileEdit = {};
  const displayName = draft.displayName.trim();
  const username = normaliseUsername(draft.username);
  const bio = draft.bio.trim();
  if (displayName !== profile.displayName) changes.displayName = displayName;
  if (username !== profile.username) changes.username = username;
  if (bio !== profile.bio) changes.bio = bio;
  return changes;
}

export const hasChanges = (changes: ProfileEdit) => Object.keys(changes).length > 0;

/** The username check only matters once the name differs from the one you already have. */
export const needsAvailabilityCheck = (profile: OwnProfile, raw: string) =>
  usernameProblem(raw) === null && normaliseUsername(raw) !== profile.username;
