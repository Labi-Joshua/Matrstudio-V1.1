import { describe, expect, it } from "vitest";
import type { OwnProfile } from "../auth/profile-api";
import {
  AVATAR_INPUT_MAX_BYTES,
  AVATAR_MAX_BYTES,
  AVATAR_MAX_PX,
  checkAvatarFile,
  cropBox,
  encodeAttempts,
} from "./profile-avatar";
import {
  bioCounter,
  bioTooLong,
  draftChanges,
  draftErrors,
  hasChanges,
  nameProblem,
  needsAvailabilityCheck,
  normaliseUsername,
  takenMessage,
  usernameProblem,
  usernameSuggestions,
} from "./profile-form";
import { learnedTime, levelTitle, metaLine, monthYear, topicChips } from "./profile-view";
import {
  publicLinkHref,
  publicLinkText,
  publicRowText,
  sameVisibility,
  sharedSummary,
  toggleVisibility,
  usernameFromLocation,
} from "./profile-visibility";

const profile: OwnProfile = {
  username: "ada",
  displayName: "Ada Lovelace",
  bio: "Designer",
  avatarUrl: null,
  isPublic: false,
  visibility: { stats: true, paths: true, submissions: true },
  createdAt: "2026-09-02T10:00:00.000Z",
  updatedAt: "2026-09-02T10:00:00.000Z",
};

describe("username rules", () => {
  it("accepts 3 to 30 letters, digits and underscores, any case", () => {
    for (const ok of ["abc", "Ada_Dev", "a".repeat(30), "user_123"])
      expect(usernameProblem(ok), ok).toBeNull();
  });

  it("explains what is wrong", () => {
    expect(usernameProblem("")).toBe("empty");
    expect(usernameProblem("  ")).toBe("empty");
    expect(usernameProblem("ab")).toBe("short");
    expect(usernameProblem("a".repeat(31))).toBe("long");
    for (const bad of ["has space", "dash-ed", "dot.ted", "émile", "ada!"])
      expect(usernameProblem(bad), bad).toBe("characters");
  });

  it("blocks reserved words in any case", () => {
    for (const word of ["admin", "Admin", "SUPPORT", "matrstudio"])
      expect(usernameProblem(word), word).toBe("reserved");
  });

  it("normalises like the API", () => {
    expect(normaliseUsername("  Ada_Dev ")).toBe("ada_dev");
  });

  it("suggests valid alternatives that differ from the taken name", () => {
    const list = usernameSuggestions("ada", "Ada Lovelace");
    expect(list).toEqual(["ada_lovelace", "ada_design"]);
    expect(usernameSuggestions("ada_lovelace", "Ada Lovelace")).not.toContain("ada_lovelace");
    expect(takenMessage("ada", "Ada Lovelace")).toBe(
      "That username is taken. Try ada_lovelace or ada_design.",
    );
    expect(takenMessage("x".repeat(30), "")).toBe("That username is taken. Try another.");
  });

  it("only asks the API when the name changed and is valid", () => {
    expect(needsAvailabilityCheck(profile, "ADA")).toBe(false);
    expect(needsAvailabilityCheck(profile, "ada2")).toBe(true);
    expect(needsAvailabilityCheck(profile, "a")).toBe(false);
    expect(needsAvailabilityCheck(profile, "admin")).toBe(false);
  });
});

describe("the form draft", () => {
  const draft = { displayName: "Ada Lovelace", username: "ada", bio: "Designer" };

  it("sends only what changed, trimmed and lower-cased", () => {
    expect(hasChanges(draftChanges(profile, draft))).toBe(false);
    expect(
      draftChanges(profile, { displayName: " Ada L ", username: "Ada_Dev", bio: " Hi " }),
    ).toEqual({ displayName: "Ada L", username: "ada_dev", bio: "Hi" });
    expect(draftChanges(profile, { ...draft, bio: "" })).toEqual({ bio: "" });
  });

  it("reports field errors", () => {
    expect(draftErrors(draft)).toEqual({});
    const errors = draftErrors({ displayName: " ", username: "a b", bio: "x".repeat(201) });
    expect(Object.keys(errors).sort()).toEqual(["bio", "displayName", "username"]);
  });

  it("checks the name and counts the bio", () => {
    expect(nameProblem("Ada")).toBeNull();
    expect(nameProblem("")).toBe("empty");
    expect(nameProblem("n".repeat(61))).toBe("long");
    expect(nameProblem("bad\u0000name")).toBe("control");
    expect(bioCounter("  hello ")).toBe("5 / 200");
    expect(bioTooLong("x".repeat(200))).toBe(false);
    expect(bioTooLong("x".repeat(201))).toBe(true);
  });
});

describe("avatar rules", () => {
  it("accepts png, jpeg and webp up to 10 MB", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"])
      expect(checkAvatarFile({ type, size: 1000 })).toBeNull();
    expect(checkAvatarFile({ type: "image/gif", size: 10 })).toBe("unsupported");
    expect(checkAvatarFile({ type: "application/pdf", size: 10 })).toBe("unsupported");
    expect(checkAvatarFile({ type: "image/png", size: AVATAR_INPUT_MAX_BYTES })).toBeNull();
    expect(checkAvatarFile({ type: "image/png", size: AVATAR_INPUT_MAX_BYTES + 1 })).toBe(
      "too-big",
    );
  });

  it("crops the centre square and caps the output at 256 px", () => {
    expect(cropBox(1000, 600)).toEqual({ sx: 200, sy: 0, side: 600, out: AVATAR_MAX_PX });
    expect(cropBox(300, 900)).toEqual({ sx: 0, sy: 300, side: 300, out: AVATAR_MAX_PX });
    expect(cropBox(100, 80)).toEqual({ sx: 10, sy: 0, side: 80, out: 80 });
  });

  it("tries smaller sizes and lower quality, best first, within the API limit", () => {
    const attempts = encodeAttempts();
    expect(attempts[0]).toEqual({ scale: 1, quality: 0.9 });
    expect(attempts.at(-1)).toEqual({ scale: 0.5, quality: 0.4 });
    expect(attempts).toHaveLength(15);
    expect(AVATAR_MAX_BYTES).toBe(200 * 1024);
  });
});

describe("visibility", () => {
  const all = { stats: true, paths: true, submissions: true };
  it("toggles one key without touching the rest", () => {
    expect(toggleVisibility(all, "paths")).toEqual({
      stats: true,
      paths: false,
      submissions: true,
    });
    expect(sameVisibility(all, { ...all })).toBe(true);
    expect(sameVisibility(all, toggleVisibility(all, "stats"))).toBe(false);
  });

  it("describes what is shared", () => {
    expect(sharedSummary(all)).toBe("your stats, completed paths and approved submissions");
    expect(sharedSummary({ stats: false, paths: true, submissions: false })).toBe(
      "your completed paths",
    );
    expect(sharedSummary({ stats: false, paths: false, submissions: false })).toBe(
      "your name, photo and bio",
    );
  });

  it("words the public row for both states", () => {
    expect(publicRowText(profile)).toBe(
      "Off. Only you can see this page. Turn it on to share it at matrstudio.com/@ada.",
    );
    expect(publicRowText({ ...profile, isPublic: true })).toBe(
      "On. Anyone with the link can see your stats, completed paths and approved submissions.",
    );
  });

  it("builds the public link and reads it back from the address", () => {
    expect(publicLinkText("ada")).toBe("matrstudio.com/@ada");
    expect(publicLinkHref("https://matrstudio.com", "ada")).toBe("https://matrstudio.com/@ada");
    expect(usernameFromLocation("/@Ada", "")).toBe("ada");
    expect(usernameFromLocation("/@ada/", "")).toBe("ada");
    expect(usernameFromLocation("/u", "?name=Ada")).toBe("ada");
    expect(usernameFromLocation("/u", "?name=@ada")).toBe("ada");
    expect(usernameFromLocation("/u", "")).toBeNull();
    expect(usernameFromLocation("/@", "")).toBeNull();
  });
});

describe("profile words", () => {
  it("formats dates in UTC", () => {
    expect(monthYear("2026-09-02T10:00:00.000Z")).toBe("September 2026");
    expect(monthYear("nope")).toBe("");
  });

  it("builds the meta line for the owner and for a visitor", () => {
    const base = { username: "ada", level: "beginner", joinedAt: "2026-09-02T10:00:00.000Z" };
    expect(metaLine(base)).toBe("@ada · Beginner · Joined September 2026");
    expect(metaLine({ ...base, visitor: true })).toBe(
      "@ada · Beginner · Learning on Matr Studio since September 2026",
    );
    expect(metaLine({ ...base, level: null })).toBe("@ada · Joined September 2026");
    expect(levelTitle("nonsense")).toBeNull();
  });

  it("shows known topics as short names and drops unknown ones", () => {
    expect(topicChips(["ui-ux", "nope", "design-systems"])).toEqual(["UI/UX", "Design systems"]);
  });

  it("formats time learned", () => {
    expect(learnedTime(45)).toBe("45 min");
    expect(learnedTime(720)).toBe("12 hrs");
    expect(learnedTime(130)).toBe("2 hrs 10 min");
  });
});
