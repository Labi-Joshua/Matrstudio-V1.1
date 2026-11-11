import type { Submission } from "../auth/submissions-api";
import { ROUTES } from "../routes";
import { hostLabel } from "./submit-url";

/**
 * Curator decisions as notification items (Figma "7. Curator decision (notifications)"). Pure, so
 * the shell's notifications panel can render them next to its own items. `tone` picks the icon:
 * success = green check, warning = amber pencil, neutral = grey cross. `at` is the ISO time of the
 * decision (the submission's updatedAt). The curator note is plain text; render it as text.
 */
export type SubmitNotificationTone = "success" | "warning" | "neutral";

export type SubmitNotification = {
  id: string;
  title: string;
  body: string;
  href: string;
  at: string;
  tone: SubmitNotificationTone;
};

/** Null for a submission still in review: there is nothing to tell the learner yet. */
export function submissionNotification(submission: Submission): SubmitNotification | null {
  const name = `“${submission.title?.trim() || hostLabel(submission.url)}”`;
  const note = submission.curatorNote?.trim();
  const base = {
    id: `submission-${submission.id}-${submission.status}`,
    href: ROUTES.app.submit,
    at: submission.updatedAt,
  };
  switch (submission.status) {
    case "accepted":
      return {
        ...base,
        title: "Your resource was approved",
        body: `${name} is now in the library. You’re credited on it.`,
        tone: "success",
      };
    case "needs_changes":
      return {
        ...base,
        title: "Your submission needs a change",
        body: note ? `${name}: ${note}` : `${name}: a curator asked for a change.`,
        tone: "warning",
      };
    case "declined":
      return {
        ...base,
        title: "Your submission was declined",
        body: note ? `${name} ${note}` : `${name} didn’t fit the library this time.`,
        tone: "neutral",
      };
    case "in_review":
      return null;
  }
}

/** Decisions only, newest first. */
export function submissionNotifications(submissions: readonly Submission[]): SubmitNotification[] {
  return submissions
    .flatMap((s) => {
      const item = submissionNotification(s);
      return item ? [item] : [];
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
