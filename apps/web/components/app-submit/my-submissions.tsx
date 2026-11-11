"use client";

import { useMemo } from "react";
import { useSkeletonGate } from "../../lib/app/submit-loading";
import {
  STATUS_PRESENTATION,
  type StatusTone,
  sortSubmissions,
  submissionDetail,
} from "../../lib/app/submit-state";
import { hostLabel } from "../../lib/app/submit-url";
import type { Submission } from "../../lib/auth/submissions-api";
import { getCatalogue } from "../../lib/catalogue/data";
import { ArrowRightIcon, UploadIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { Button } from "../auth/button";
import { SubmissionsSkeleton } from "./skeletons";

/**
 * "My submissions" (Figma 6 My submissions, 9 No submissions yet, "My submissions: loading"):
 * one row per submission with a status badge and an external link. Plain text only: titles, notes
 * and curator notes are never rendered as HTML (docs/SECURITY-AUTH.md section 8).
 */
export type SubmissionsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: Submission[] };

const TONE: Record<StatusTone, { badge: string; dot: string }> = {
  amber: { badge: "bg-warning-focus text-warning-text", dot: "bg-warning-text" },
  green: { badge: "bg-success-focus text-success-text", dot: "bg-success-text" },
  orange: { badge: "bg-primary-focus text-primary-text", dot: "bg-primary-text" },
  red: { badge: "bg-error-focus text-error-text", dot: "bg-error-text" },
};

function StatusBadge({ status }: { status: Submission["status"] }) {
  const { label, tone } = STATUS_PRESENTATION[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-[3px] font-medium text-[13px] leading-[18px] tracking-[-0.13px] ${TONE[tone].badge}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${TONE[tone].dot}`} />
      {label}
    </span>
  );
}

/** Only https links are ever rendered as links, whatever the API returned. */
const isHttps = (url: string) => url.startsWith("https://");

function Row({ submission, onEdit }: { submission: Submission; onEdit: (s: Submission) => void }) {
  const topics = useMemo(() => getCatalogue().topics, []);
  const topicName = topics.find((t) => t.slug === submission.topic)?.name ?? null;
  const title = submission.title?.trim() || hostLabel(submission.url);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border-soft bg-bg-base py-3 pr-3.5 pl-3">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary"
      >
        <UploadIcon size={20} />
      </span>
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
        <p className="truncate font-semibold text-[14px] text-text leading-5 tracking-[-0.14px]">
          {title}
        </p>
        <p className="line-clamp-2 text-[12px] text-text-tertiary leading-4 tracking-[-0.12px] md:line-clamp-1">
          {submissionDetail(submission, topicName)}
        </p>
      </div>
      <StatusBadge status={submission.status} />
      {submission.status === "needs_changes" ? (
        <button
          type="button"
          onClick={() => onEdit(submission)}
          className={`inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-bg-elevation-1 px-2 font-medium text-[13px] text-text leading-[18px] tracking-[-0.13px] shadow-e1 hover:bg-bg-fill1 ${FOCUS}`}
        >
          Edit and resubmit
        </button>
      ) : null}
      {isHttps(submission.url) ? (
        <a
          href={submission.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${title} in a new tab`}
          className={`flex size-8 shrink-0 items-center justify-center rounded-md text-primary-text hover:bg-primary-focus ${FOCUS}`}
        >
          <ArrowRightIcon size={18} className="-rotate-45" />
        </a>
      ) : null}
    </li>
  );
}

export function MySubmissions({
  state,
  onRetry,
  onEdit,
  onSubmitNew,
}: {
  state: SubmissionsState;
  onRetry: () => void;
  onEdit: (submission: Submission) => void;
  onSubmitNew: () => void;
}) {
  const gate = useSkeletonGate(state.status === "loading");
  if (gate === "wait") return <div aria-busy="true" className="min-h-[240px]" />;
  if (gate === "skeleton" || state.status === "loading") return <SubmissionsSkeleton />;

  if (state.status === "error") {
    return (
      <div role="alert" className="flex max-w-[480px] flex-col items-start gap-3">
        <p className="font-medium text-[18px] text-text leading-7 tracking-[-0.18px]">
          We couldn’t load your submissions
        </p>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          Check your connection and try again.
        </p>
        <div className="w-full sm:w-fit">
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (state.rows.length === 0) {
    return (
      <div className="mx-auto flex max-w-[360px] flex-col items-center gap-3 py-12 text-center">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full border-[1.5px] border-border border-dashed bg-bg-fill1 text-text-secondary"
        >
          <UploadIcon size={24} />
        </span>
        <h2 className="font-medium text-[18px] text-text leading-7 tracking-[-0.18px]">
          No submissions yet
        </h2>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          Found a free video, article or tool that helped you? Share it and a curator will take a
          look.
        </p>
        <div className="mt-2 w-full sm:w-fit">
          <Button onClick={onSubmitNew}>Submit a resource</Button>
        </div>
      </div>
    );
  }

  const rows = sortSubmissions(state.rows);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
        {rows.length} {rows.length === 1 ? "submission" : "submissions"}
      </p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row) => (
          <Row key={row.id} submission={row} onEdit={onEdit} />
        ))}
      </ul>
    </div>
  );
}
