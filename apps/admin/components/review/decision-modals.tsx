"use client";

import { useState } from "react";
import { canSendChange, changeMessage, firstName, shortUrl } from "../../lib/review/format";
import { CHANGE_PRESETS, DECLINE_REASONS } from "../../lib/review/options";
import type { DeclineReason, DuplicateOf, SubmissionDetail } from "../../lib/review/types";
import { Checkbox, Field, Radio, TextArea } from "./fields";
import { CopyIcon, LogIcon, MailIcon, TrashIcon } from "./icons";
import { Modal } from "./modal";
import { Button } from "./ui";

type Props = {
  submission: SubmissionDetail;
  busy: boolean;
  error: string | null;
  onClose: () => void;
};

/** RQ5: Ask {name} for a change. Ticked reasons plus a note go to the submitter. */
export function ChangeModal({
  submission,
  busy,
  error,
  onClose,
  onSend,
}: Props & { onSend: (message: string) => void }) {
  const name = firstName(submission.submitter.name);
  const [presets, setPresets] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const ok = canSendChange(presets, note);
  return (
    <Modal
      icon={<MailIcon />}
      title={`Ask ${name} for a change`}
      subtitle={`It goes back to ${name}. When they resubmit, it comes back to this queue.`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!ok || busy}
            onClick={() => onSend(changeMessage(presets, note))}
          >
            {busy ? "Sending…" : "Send request"}
          </Button>
        </>
      }
    >
      <fieldset className="m-0 rounded-xl border-0 bg-bg-fill1 p-4">
        <legend className="sr-only">What needs to change?</legend>
        <p aria-hidden="true" className="mb-1 text-[13px] text-text-secondary">
          What needs to change?
        </p>
        {CHANGE_PRESETS.map((p) => (
          <Checkbox
            key={p}
            checked={presets.includes(p)}
            onChange={(on) => setPresets(on ? [...presets, p] : presets.filter((x) => x !== p))}
          >
            {p}
          </Checkbox>
        ))}
      </fieldset>
      <Field
        label={`Note to ${name}`}
        htmlFor="rv-change-note"
        hint={`${name} is notified in the app and by email.`}
      >
        <TextArea
          id="rv-change-note"
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-[13px] text-error-text">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

/** RQ6: Decline with a reason (four radios and an optional note). */
export function DeclineModal({
  submission,
  busy,
  error,
  onClose,
  onDecline,
}: Props & { onDecline: (reason: DeclineReason, note: string) => void }) {
  const name = firstName(submission.submitter.name);
  const [reason, setReason] = useState<DeclineReason | null>(null);
  const [note, setNote] = useState("");
  return (
    <Modal
      tone="danger"
      icon={<TrashIcon />}
      title="Decline this submission?"
      subtitle={`${name} sees the reason you pick. It can’t be undone, but they can submit again.`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={reason === null || busy}
            onClick={() => reason && onDecline(reason, note.trim())}
          >
            {busy ? "Declining…" : "Decline"}
          </Button>
        </>
      }
    >
      <fieldset className="m-0 rounded-xl border-0 bg-bg-fill1 p-4">
        <legend className="sr-only">Reason</legend>
        <p aria-hidden="true" className="mb-1 text-[13px] text-text-secondary">
          Reason
        </p>
        {DECLINE_REASONS.map((r) => (
          <Radio
            key={r.value}
            name="rv-decline-reason"
            value={r.value}
            checked={reason === r.value}
            onChange={() => setReason(r.value)}
            label={r.label}
            hint={r.hint}
          />
        ))}
      </fieldset>
      <Field label={`Message to ${name} (optional)`} htmlFor="rv-decline-note">
        <TextArea
          id="rv-decline-note"
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-[13px] text-error-text">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

/** RQ8: Decline as a duplicate of the library item the auto-check found. */
export function DuplicateModal({
  submission,
  duplicate,
  busy,
  error,
  onClose,
  onDecline,
}: Props & { duplicate: DuplicateOf; onDecline: () => void }) {
  const name = firstName(submission.submitter.name);
  const paths =
    duplicate.usedInPaths > 0
      ? `used in ${duplicate.usedInPaths} ${duplicate.usedInPaths === 1 ? "path" : "paths"}`
      : "library only";
  return (
    <Modal
      tone="danger"
      icon={<CopyIcon />}
      title="Decline as a duplicate?"
      subtitle={`${name} gets a link to the resource that’s already in the library.`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" disabled={busy} onClick={onDecline}>
            {busy ? "Declining…" : "Decline as duplicate"}
          </Button>
        </>
      }
    >
      <dl className="m-0 flex flex-col gap-3 rounded-xl bg-bg-fill1 p-4 text-[13px]">
        <div>
          <dt className="text-text-tertiary">Submitted</dt>
          <dd className="m-0 font-medium text-text">{submission.title}</dd>
          <dd className="m-0 text-text-secondary">{shortUrl(submission.url, 60)}</dd>
        </div>
        <div>
          <dt className="text-text-tertiary">In the library</dt>
          <dd className="m-0 font-medium text-text">{duplicate.title}</dd>
          <dd className="m-0 text-text-secondary">
            {duplicate.status} · {paths}
          </dd>
        </div>
      </dl>
      <p className="flex items-center gap-2 rounded-xl bg-bg-fill1 px-4 py-3 text-[13px] text-text-secondary">
        <LogIcon />
        Duplicates don’t count against {name}’s submission record.
      </p>
      {error ? (
        <p role="alert" className="text-[13px] text-error-text">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
