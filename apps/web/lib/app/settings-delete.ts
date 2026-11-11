export const DELETE_PHRASE = "DELETE";

/** The typed confirmation: exactly DELETE (case matters, spaces around it do not). */
export const isDeletePhrase = (value: string) => value.trim() === DELETE_PHRASE;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The "You'll lose" line of the delete dialog (Figma: "Your profile and public link, progress on
 * 3 paths, 12 saved resources and 4 submissions"). Only counts the API knows are named; path
 * progress is named without a number until its count is available.
 */
export function loseSummary(counts: { saved: number; submissions: number } | null): string {
  const parts = ["your profile and public link", "your progress"];
  if (counts) {
    if (counts.saved > 0) parts.push(plural(counts.saved, "saved resource", "saved resources"));
    if (counts.submissions > 0) parts.push(plural(counts.submissions, "submission", "submissions"));
  } else {
    parts.push("saved resources", "submissions");
  }
  const text =
    parts.length === 1
      ? (parts[0] as string)
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}
