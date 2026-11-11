"use client";

import { useId, useState } from "react";
import { logIssue, setTicketStatus } from "../../lib/people/api";
import { firstName } from "../../lib/people/format";
import { ISSUE_AREAS, SEVERITIES } from "../../lib/people/logic";
import type { Severity, TicketDetail } from "../../lib/people/types";
import { Modal, ModalNote } from "./modal";
import { failureToast, useToast } from "./toast";
import { BTN_PRIMARY, BTN_SECONDARY, FIELD, INPUT, LABEL, PATHS, TEXTAREA } from "./ui";

type Props = { ticket: TicketDetail; onClose: () => void; onDone: () => void };

function Err({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="text-[14px] text-error-text leading-5">
      {text}
    </p>
  ) : null;
}

function Footer({
  busy,
  onClose,
  label,
  busyLabel,
  disabled,
  submit,
}: {
  busy: boolean;
  onClose: () => void;
  label: string;
  busyLabel: string;
  disabled: boolean;
  submit: () => void;
}) {
  return (
    <>
      <button type="button" onClick={onClose} disabled={busy} className={BTN_SECONDARY}>
        Cancel
      </button>
      <button type="button" onClick={submit} disabled={busy || disabled} className={BTN_PRIMARY}>
        {busy ? busyLabel : label}
      </button>
    </>
  );
}

/** Log for the team (Figma SP6): creates a tracked issue, keeps the request open. */
export function LogModal({ ticket, onClose, onDone }: Props) {
  const toast = useToast();
  const ids = [useId(), useId(), useId(), useId()];
  const name = firstName(ticket.requester.name);
  const [title, setTitle] = useState(ticket.subject);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [area, setArea] = useState(
    ticket.category && ISSUE_AREAS.includes(ticket.category)
      ? ticket.category
      : (ISSUE_AREAS[0] ?? ""),
  );
  const [link, setLink] = useState(ticket.linkReport !== null);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await logIssue(ticket.id, {
      title: title.trim(),
      description: description.trim(),
      severity,
      area,
      linkReportId: link && ticket.linkReport ? ticket.linkReport.id : undefined,
      notifyRequester: notify,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      toast(failureToast("Couldn’t log it", r.message));
      return;
    }
    toast({
      tone: "success",
      title: `Logged as #${r.data.issueId}`,
      body: notify ? `${name} was told the team is on it.` : "The request stays open.",
    });
    onDone();
    onClose();
  }

  return (
    <Modal
      title="Log this for the team"
      subtitle={`We keep the request open and tell ${name} when it’s fixed.`}
      icon={PATHS.scroll}
      onClose={onClose}
      busy={busy}
      footer={
        <Footer
          busy={busy}
          onClose={onClose}
          label="Log it"
          busyLabel="Logging…"
          disabled={title.trim().length < 3}
          submit={submit}
        />
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids[0]} className={LABEL}>
          Title
        </label>
        <input
          id={ids[0]}
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          className={INPUT}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids[1]} className={LABEL}>
          What happens
        </label>
        <textarea
          id={ids[1]}
          value={description}
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
          className={TEXTAREA}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids[2]} className={LABEL}>
            Severity
          </label>
          <select
            id={ids[2]}
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
            className={`${FIELD} h-10`}
          >
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids[3]} className={LABEL}>
            Area
          </label>
          <select
            id={ids[3]}
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className={`${FIELD} h-10`}
          >
            {ISSUE_AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>
      {ticket.linkReport ? (
        <label className="flex items-center gap-2 text-[14px] text-text leading-5">
          <input
            type="checkbox"
            checked={link}
            onChange={(e) => setLink(e.target.checked)}
            className="size-4 accent-[var(--color-primary)]"
          />
          Link to the link report “{ticket.linkReport.title}” ({ticket.linkReport.reports} reports)
        </label>
      ) : null}
      <label className="flex items-center gap-2 text-[14px] text-text leading-5">
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
          className="size-4 accent-[var(--color-primary)]"
        />
        Send {name} a “we’re on it” reply
      </label>
      <Err text={error} />
    </Modal>
  );
}

/** Mark fixed (Figma SP8) and Can't reproduce (SP9): both send a message and resolve the request. */
export function CloseModal({
  ticket,
  kind,
  onClose,
  onDone,
}: Props & { kind: "fixed" | "cant_reproduce" }) {
  const toast = useToast();
  const id = useId();
  const name = firstName(ticket.requester.name);
  const fixed = kind === "fixed";
  const others = Math.max(0, (ticket.linkReport?.reports ?? 0) - 1);
  const [message, setMessage] = useState(
    fixed
      ? `Hi ${name}, we’ve fixed what you reported with “${ticket.subject}”. Thanks for letting us know. Reply if anything still looks wrong.`
      : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await setTicketStatus(ticket.id, { status: kind, message: message.trim() });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      toast(
        failureToast(fixed ? "Couldn’t mark it fixed" : "Couldn’t resolve the request", r.message),
      );
      return;
    }
    toast({
      tone: "success",
      title: fixed ? "Marked fixed" : "Resolved as can’t reproduce",
      body: `${name} was told by email and in the app.`,
    });
    onDone();
    onClose();
  }

  return (
    <Modal
      title={fixed ? `Tell ${name} it’s fixed` : `Tell ${name} what you checked`}
      subtitle={
        fixed
          ? "This sends the message and resolves the request."
          : `This resolves the request. If ${name} replies, the request opens again.`
      }
      icon={fixed ? PATHS.checkCircle : PATHS.search}
      onClose={onClose}
      busy={busy}
      footer={
        <Footer
          busy={busy}
          onClose={onClose}
          label={fixed ? "Send and resolve" : "Send and resolve"}
          busyLabel="Sending…"
          disabled={message.trim().length < 1}
          submit={submit}
        />
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className={LABEL}>
          Message
        </label>
        <textarea
          id={id}
          value={message}
          maxLength={2000}
          placeholder={
            fixed
              ? undefined
              : "What did you try? For example: the video plays for me in Chrome and Safari."
          }
          onChange={(e) => setMessage(e.target.value)}
          className={`${TEXTAREA} min-h-[140px]`}
        />
      </div>
      <ModalNote icon={PATHS.mail}>
        Sent by email and in the app.
        {fixed && others > 0
          ? ` The ${others} other ${others === 1 ? "learner" : "learners"} who reported this link ${others === 1 ? "is" : "are"} told too.`
          : ""}
      </ModalNote>
      <Err text={error} />
    </Modal>
  );
}
