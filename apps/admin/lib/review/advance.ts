import { listSubmissions } from "./api";

export const QUEUE_HREF = "/review?tab=submissions";
export const submissionLink = (id: string) => `/review/submission?id=${encodeURIComponent(id)}`;

/**
 * Where to go after a decision on `currentId`: the next waiting submission (the API's `nextId`
 * when it sent one, else the oldest other item in the queue) or the queue when it is clear.
 */
export async function nextSubmissionHref(
  currentId: string,
  nextId?: string | null,
): Promise<{ href: string; opened: boolean }> {
  if (nextId && nextId !== currentId) return { href: submissionLink(nextId), opened: true };
  const result = await listSubmissions({ status: "in_review" });
  if (result.ok) {
    const next = result.data.items.find((i) => i.id !== currentId);
    if (next) return { href: submissionLink(next.id), opened: true };
  }
  return { href: QUEUE_HREF, opened: false };
}

/** The reviewer who got there first, from "Tobi approved this a minute ago." style messages. */
export const isAlreadyReviewed = (failure: { status?: number; code: string }) =>
  failure.status === 409 || failure.code === "already_reviewed";
