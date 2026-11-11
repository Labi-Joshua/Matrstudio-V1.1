"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { QUEUE_HREF } from "../../lib/review/advance";
import { declineSubmission, getSubmission, requestChange } from "../../lib/review/api";
import {
  agoLabel,
  firstName,
  isOverdue,
  minutesLabel,
  safeHref,
  waitingLabel,
} from "../../lib/review/format";
import { LEVEL_OPTIONS, labelOf, TYPE_OPTIONS } from "../../lib/review/options";
import type { SubmissionDetail } from "../../lib/review/types";
import { ChangeModal, DeclineModal, DuplicateModal } from "./decision-modals";
import { AssignCard, BackLink, DetailGate, ReviewRoot } from "./detail-parts";
import { Checkbox } from "./fields";
import { useLoad } from "./hooks";
import { AlertIcon } from "./icons";
import { Avatar, Badge, Button, Card, CheckLine, ExternalLink, FOCUS, PageTitle, Row } from "./ui";
import { useDecision } from "./use-decision";
import { useReviewer } from "./use-reviewer";

const REVIEW_CHECKLIST = [
  "Free and public",
  "Right level",
  "Good quality and accurate",
  "Still current",
];

export function SubmissionScreen() {
  const id = useSearchParams().get("id") ?? "";
  const { state, reload } = useLoad(`submission:${id}`, (signal) => getSubmission(id, signal));
  const [assigned, setAssigned] = useState<{
    id: string;
    value: SubmissionDetail["assignedTo"];
  } | null>(null);
  const me = useReviewer();
  return (
    <ReviewRoot>
      {id === "" ? (
        <DetailGate
          state={{
            status: "error",
            failure: { ok: false, code: "not_found", message: "", status: 404 },
          }}
          reload={reload}
          backHref={QUEUE_HREF}
          backLabel="Review queues"
          what="submission"
        >
          {() => null}
        </DetailGate>
      ) : (
        <DetailGate
          state={state}
          reload={reload}
          backHref={QUEUE_HREF}
          backLabel="Review queues"
          what="submission"
        >
          {(s) => (
            <Detail
              submission={assigned?.id === s.id ? { ...s, assignedTo: assigned.value } : s}
              meId={me.meId}
              canManage={me.canManage}
              onAssigned={(value) => setAssigned({ id: s.id, value })}
            />
          )}
        </DetailGate>
      )}
    </ReviewRoot>
  );
}

type Dialog = null | "change" | "decline" | "duplicate";

function Detail({
  submission: s,
  meId,
  canManage,
  onAssigned,
}: {
  submission: SubmissionDetail;
  meId: string | null;
  canManage: boolean;
  onAssigned: (a: SubmissionDetail["assignedTo"]) => void;
}) {
  const router = useRouter();
  const decision = useDecision(s.id);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const name = firstName(s.submitter.name);
  const reviewed = ["accepted", "approved", "declined"].includes(s.status);
  const href = safeHref(s.url);
  const meta = [s.source, minutesLabel(s.type, s.minutes), labelOf(TYPE_OPTIONS, s.type)]
    .filter(Boolean)
    .join(" · ");
  const close = () => {
    setDialog(null);
    decision.clearError();
  };
  const disabled = !canManage || reviewed;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={QUEUE_HREF} label="Review queues" />
      <PageTitle
        title={s.title}
        badge={
          <Badge tone={isOverdue(s.ageDays) ? "primary" : "neutral"}>
            Waiting {waitingLabel(s.ageDays).toLowerCase()}
          </Badge>
        }
        subtitle={`Submitted by ${s.submitter.name} · ${agoLabel(s.ageDays)}`}
        actions={
          <>
            <Button
              variant="danger-outline"
              disabled={disabled}
              onClick={() => setDialog("decline")}
            >
              Decline
            </Button>
            <Button disabled={disabled} onClick={() => setDialog("change")}>
              Request a change
            </Button>
            <Button
              variant="primary"
              disabled={disabled}
              onClick={() =>
                router.push(`/review/submission/approve?id=${encodeURIComponent(s.id)}`)
              }
            >
              Approve
            </Button>
          </>
        }
      />
      {reviewed ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-warning-border bg-warning-accent px-4 py-3 text-[13px] text-warning-text"
        >
          <AlertIcon />
          Already reviewed. This submission was {s.status === "accepted" ? "approved" : "declined"},
          so there is nothing left to do here.
        </p>
      ) : !canManage ? (
        <p
          role="status"
          className="rounded-xl bg-bg-fill1 px-4 py-3 text-[13px] text-text-secondary"
        >
          You can read this queue but not make decisions. Review queues needs the Manage level.
        </p>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <Card
            title="Resource"
            action={href ? <ExternalLink href={href}>Open link</ExternalLink> : null}
          >
            <div className="flex gap-4 rounded-xl bg-bg-fill1 p-3">
              <div aria-hidden="true" className="h-16 w-24 shrink-0 rounded-lg bg-bg-fill2" />
              <div className="min-w-0 text-[13px]">
                <p className="font-medium text-text">{s.title}</p>
                <p className="text-text-tertiary">{meta}</p>
                {href ? (
                  <p className="truncate text-primary-text">{s.url}</p>
                ) : (
                  <p className="truncate text-text-tertiary">{s.url || "No link"}</p>
                )}
              </div>
            </div>
          </Card>
          <Card title={`Why it helps (from ${name})`}>
            <p className="text-[13px] text-text-secondary leading-5">
              {s.note || `${name} didn’t add a note.`}
            </p>
          </Card>
          <Card title="Auto-check">
            {s.duplicateOf ? (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-border bg-warning-accent px-4 py-3 text-[13px] text-warning-text">
                <span className="flex items-center gap-2">
                  <AlertIcon />
                  Possible duplicate: “{s.duplicateOf.title}” is already in the library.
                </span>
                <button
                  type="button"
                  onClick={() => setDialog("duplicate")}
                  className={`rounded-md font-medium underline ${FOCUS}`}
                >
                  Compare side by side
                </button>
              </div>
            ) : null}
            {s.autoChecks.length === 0 ? (
              <p className="text-[13px] text-text-secondary">
                No automatic checks have run for this submission yet.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {s.autoChecks.map((c) => (
                  <CheckLine key={c.key} status={c.status}>
                    {c.label}
                  </CheckLine>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card title="Before you approve">
            <div className="flex flex-col">
              {REVIEW_CHECKLIST.map((item) => (
                <Checkbox
                  key={item}
                  checked={ticked.includes(item)}
                  onChange={(on) =>
                    setTicked(on ? [...ticked, item] : ticked.filter((x) => x !== item))
                  }
                >
                  {item === "Right level" && s.level
                    ? `Right level (${labelOf(LEVEL_OPTIONS, s.level)})`
                    : item}
                </Checkbox>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-text-tertiary">
              Your own checklist. It isn’t saved.
            </p>
          </Card>
          <Card title="Submitter">
            <div className="flex items-center gap-3">
              <Avatar name={s.submitter.name} size={40} />
              <div className="min-w-0 text-[13px]">
                <p className="font-medium text-text">{s.submitter.name}</p>
                <p className="text-text-tertiary">
                  {s.submitter.since ? `Learner since ${s.submitter.since}` : "Learner"}
                </p>
              </div>
            </div>
            <dl className="m-0 mt-2">
              <Row label="Submitted">{s.submitter.submitted}</Row>
              <Row label="Approved">{s.submitter.approved}</Row>
              <Row label="Declined">{s.submitter.declined}</Row>
            </dl>
          </Card>
          <AssignCard
            kind="submissions"
            id={s.id}
            assignedTo={s.assignedTo}
            meId={meId}
            canManage={canManage && !reviewed}
            onChange={onAssigned}
          />
        </div>
      </div>

      {dialog === "change" ? (
        <ChangeModal
          submission={s}
          busy={decision.busy}
          error={decision.error}
          onClose={close}
          onSend={(message) =>
            decision.run(
              () => requestChange(s.id, message),
              { title: "Change requested", body: `${name} is notified.` },
              close,
            )
          }
        />
      ) : null}
      {dialog === "decline" ? (
        <DeclineModal
          submission={s}
          busy={decision.busy}
          error={decision.error}
          onClose={close}
          onDecline={(reason, note) =>
            decision.run(
              () => declineSubmission(s.id, { reason, note: note || undefined }),
              { title: "Declined", body: `${name} sees the reason.` },
              close,
            )
          }
        />
      ) : null}
      {dialog === "duplicate" && s.duplicateOf ? (
        <DuplicateModal
          submission={s}
          duplicate={s.duplicateOf}
          busy={decision.busy}
          error={decision.error}
          onClose={close}
          onDecline={() =>
            decision.run(
              () =>
                declineSubmission(s.id, { reason: "duplicate", duplicateOf: s.duplicateOf?.id }),
              {
                title: "Declined as a duplicate",
                body: `${name} gets a link to the existing resource.`,
              },
              close,
            )
          }
        />
      ) : null}
    </div>
  );
}
