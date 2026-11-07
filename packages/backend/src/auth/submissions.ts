import type { Submission, SubmissionStatus, Topic } from "@matr/types";
import { writeAudit } from "./audit";

export type SubmissionRow = {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  note: string | null;
  topic: string | null;
  status: string;
  curator_note: string | null;
  created_at: number;
  updated_at: number;
};

export const toSubmission = (r: SubmissionRow): Submission => ({
  id: r.id,
  url: r.url,
  title: r.title,
  note: r.note,
  topic: r.topic as Topic | null,
  status: r.status as SubmissionStatus,
  curatorNote: r.curator_note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export type ReviewInput = {
  id: string;
  status: Exclude<SubmissionStatus, "in_review">;
  curatorNote?: string | null;
  reviewedBy: string;
};

const REVIEW_STATUSES = ["accepted", "declined", "needs_changes"];

/**
 * Internal: a curator's decision (for the admin review queue). Not exposed over HTTP yet, so the
 * caller must already have checked the reviewer's permission. Returns null for an unknown id.
 * Audit holds ids and the status only, never the note.
 */
export async function reviewSubmission(
  env: { DB: D1Database },
  input: ReviewInput,
): Promise<Submission | null> {
  if (!REVIEW_STATUSES.includes(input.status)) throw new Error("invalid review status");
  const note = input.curatorNote?.trim().slice(0, 1000) || null;
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `UPDATE resource_submissions
        SET status = ?2, curator_note = ?3, reviewed_by = ?4, reviewed_at = ?5, updated_at = ?5
      WHERE id = ?1 RETURNING *`,
  )
    .bind(input.id, input.status, note, input.reviewedBy, now)
    .first<SubmissionRow>();
  if (!row) return null;
  await writeAudit(env.DB, {
    actor: input.reviewedBy,
    action: "submission.reviewed",
    target: row.id,
    meta: { status: input.status },
  });
  return toSubmission(row);
}
