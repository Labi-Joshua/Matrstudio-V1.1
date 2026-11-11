"use client";

import Link from "next/link";
import { useId, useState } from "react";
import {
  addNote,
  assignTicket,
  getTicket,
  replyToTicket,
  setTicketStatus,
} from "../../lib/people/api";
import { ageLabel, firstName, formatDate, slaLine, whenLabel } from "../../lib/people/format";
import {
  isClosed,
  KIND_LABEL,
  STATUS_OPTIONS,
  statusSelectValue,
  ticketStatus,
} from "../../lib/people/logic";
import type { TicketDetail } from "../../lib/people/types";
import { useAccess, useLoaded, useNow, useOnline, useSkeletonGate } from "./hooks";
import { CloseModal, LogModal } from "./support-modals";
import { failureToast, useToast } from "./toast";
import {
  Avatar,
  BAR,
  BackLink,
  Badge,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  Chip,
  Facts,
  FIELD,
  FOCUS,
  LABEL,
  LoadError,
  Notice,
  OfflineNote,
  PATHS,
  PageHeader,
  StateBlock,
  TEXTAREA,
} from "./ui";

export function TicketPage({ id }: { id: string }) {
  const { state, reload } = useLoaded((s) => getTicket(id, s), id);
  const gate = useSkeletonGate(state.status === "loading");
  const online = useOnline();
  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/support">Support inbox</BackLink>
      {online ? null : <OfflineNote />}
      {state.status === "error" ? (
        state.failure.code === "not_found" ? (
          <StateBlock
            role="status"
            title="We can’t find that request"
            body="It may have been removed. Go back to the inbox."
          >
            <Link href="/support" className={BTN_SECONDARY}>
              Back to the inbox
            </Link>
          </StateBlock>
        ) : (
          <LoadError what="this request" onRetry={reload} />
        )
      ) : state.status === "ready" ? (
        <Ticket ticket={state.data} reload={reload} />
      ) : (
        <div role="status" aria-busy="true">
          <p className="sr-only">Loading this request</p>
          {gate ? (
            <div aria-hidden="true" className="flex flex-col gap-5">
              <div className={`${BAR} h-9 w-72`} />
              <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
                <div className={`${BAR} h-64 rounded-2xl`} />
                <div className={`${BAR} h-64 rounded-2xl`} />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Ticket({ ticket, reload }: { ticket: TicketDetail; reload: () => void }) {
  const toast = useToast();
  const access = useAccess();
  const now = useNow();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"log" | "fixed" | "cant" | null>(null);
  const canManage = access?.support === "manage";
  const closed = isClosed(ticket.status);
  const logged = ticket.issue !== null;
  const st = ticketStatus(ticket.status, { isNew: ticket.isNew, logged });
  const name = firstName(ticket.requester.name);

  async function change(status: "open" | "waiting_on_user" | "resolved", okTitle: string) {
    setBusy(true);
    const r = await setTicketStatus(ticket.id, { status });
    setBusy(false);
    if (!r.ok) return toast(failureToast("Couldn’t change the status", r.message));
    toast({ tone: "success", title: okTitle });
    reload();
  }

  async function assign(to: "me" | "nobody") {
    setBusy(true);
    const r = await assignTicket(ticket.id, to);
    setBusy(false);
    if (!r.ok) return toast(failureToast("Couldn’t change the assignee", r.message));
    toast({ tone: "success", title: to === "me" ? "Assigned to you" : "Unassigned" });
    reload();
  }

  const disabled = busy || !online;
  const actions = !canManage ? null : closed ? (
    <button
      type="button"
      disabled={disabled}
      onClick={() => change("open", "Request reopened")}
      className={BTN_SECONDARY}
    >
      Reopen
    </button>
  ) : (
    <>
      {!ticket.assignedToMe ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => assign("me")}
          className={BTN_SECONDARY}
        >
          Assign to me
        </button>
      ) : null}
      {ticket.kind === "report" ? (
        <>
          {!logged ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setModal("cant")}
              className={BTN_SECONDARY}
            >
              Can’t reproduce
            </button>
          ) : null}
          {logged ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setModal("fixed")}
              className={BTN_PRIMARY}
            >
              Mark fixed
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setModal("log")}
              className={BTN_PRIMARY}
            >
              Log for the team
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => change("resolved", "Request resolved")}
          className={BTN_PRIMARY}
        >
          Resolve
        </button>
      )}
    </>
  );

  const sla = closed ? null : slaLine(ticket.dueAt, ticket.overdue, now);
  const lastStaff = [...ticket.messages].reverse().find((m) => m.author === "staff");

  return (
    <>
      <PageHeader
        title={ticket.subject}
        badge={<Badge tone={st.tone}>{st.label}</Badge>}
        intro={`From ${ticket.requester.name} · ${KIND_LABEL[ticket.kind]} · ${ageLabel(ticket.createdAt, now)}`}
        aside={actions}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <section aria-label="Conversation" className={`${CARD} flex flex-col gap-4 p-5`}>
            <ol className="flex flex-col gap-3">
              {ticket.messages.map((m) => (
                <li
                  key={m.id}
                  className={`rounded-xl p-4 ${m.author === "note" ? "border border-warning-border bg-warning-accent" : m.author === "staff" ? "border border-border bg-bg-base" : "bg-bg-fill1"}`}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5">
                    <Avatar name={m.name} size={28} />
                    <span className="font-medium text-text">{m.name}</span>
                    <span className="text-text-tertiary">{whenLabel(m.at, now)}</span>
                    <span className="ml-auto text-text-secondary">
                      {m.author === "learner"
                        ? KIND_LABEL[ticket.kind]
                        : m.author === "note"
                          ? "Internal note · not sent"
                          : (m.channel ?? "Email + in-app")}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-[14px] text-text leading-6 tracking-[-0.14px]">
                    {m.body}
                  </p>
                </li>
              ))}
            </ol>
            {ticket.attached.length > 0 ? (
              <p className="text-center text-[12px] text-text-tertiary">
                Attached: {ticket.attached.join(", ")}
              </p>
            ) : null}
            {ticket.kind === "report" && ticket.linkReport && !logged ? (
              <Notice tone="warning" icon={PATHS.scroll}>
                Looks like a broken link. This resource is also in{" "}
                <Link href="/review?tab=link-reports" className={`underline ${FOCUS}`}>
                  Link reports
                </Link>{" "}
                ({ticket.linkReport.reports} reports).
              </Notice>
            ) : null}
            {ticket.issue ? (
              <div className="flex flex-col items-center gap-0.5 text-center text-[12px] text-text-tertiary">
                <p>
                  Logged as #{ticket.issue.id} “{ticket.issue.title}” · Severity:{" "}
                  {ticket.issue.severity[0]?.toUpperCase()}
                  {ticket.issue.severity.slice(1)}
                </p>
                {ticket.linkReport ? (
                  <p>
                    Linked to link report: {ticket.linkReport.title} ({ticket.linkReport.reports}{" "}
                    reports)
                  </p>
                ) : null}
              </div>
            ) : null}
            {(ticket.status === "waiting_on_user" || ticket.status === "replied") &&
            ticket.autoResolveDays ? (
              <Notice tone="neutral" icon={PATHS.clock}>
                Waiting on {name}
                {lastStaff ? ` since ${whenLabel(lastStaff.at, now).toLowerCase()}` : ""}. Resolves
                on its own if {name} doesn’t reply in {ticket.autoResolveDays} days.
              </Notice>
            ) : null}
          </section>
          {canManage && !closed ? <Composer ticket={ticket} name={name} onSent={reload} /> : null}
        </div>

        <div className="flex flex-col gap-5">
          <section aria-labelledby="req" className={`${CARD} flex flex-col gap-4 p-5`}>
            <div className="flex items-center justify-between gap-2">
              <h2 id="req" className="font-medium text-[15px] text-text">
                Requester
              </h2>
              {ticket.requester.id ? (
                <Link
                  href={`/users/detail?id=${encodeURIComponent(ticket.requester.id)}`}
                  className={`rounded text-[14px] text-primary-text ${FOCUS}`}
                >
                  Open user
                </Link>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <Avatar name={ticket.requester.name} size={40} />
              <div className="min-w-0 text-[14px] leading-5">
                <p className="truncate text-text">{ticket.requester.name}</p>
                <p className="truncate text-[13px] text-text-tertiary">{ticket.requester.email}</p>
              </div>
            </div>
            <Facts
              rows={[
                ["Joined", formatDate(ticket.requester.joinedAt)],
                ["Paths", ticket.requester.paths ?? "None"],
                [
                  "Past requests",
                  ticket.requester.pastTotal === 0
                    ? "None"
                    : `${ticket.requester.pastTotal} · ${ticket.requester.pastResolved} resolved`,
                ],
              ]}
            />
          </section>
          <RequestCard
            ticket={ticket}
            editable={canManage && !closed}
            disabled={disabled}
            onStatus={(s) => change(s, "Status updated")}
            onAssign={assign}
          />
          {sla ? (
            <Notice tone={ticket.overdue ? "error" : "warning"} icon={PATHS.clock}>
              {sla}
            </Notice>
          ) : null}
          {logged && !closed ? (
            <Notice tone="neutral" icon={PATHS.clock}>
              {name} is told when it’s fixed
            </Notice>
          ) : null}
        </div>
      </div>
      {modal === "log" ? (
        <LogModal ticket={ticket} onClose={() => setModal(null)} onDone={reload} />
      ) : null}
      {modal === "fixed" ? (
        <CloseModal kind="fixed" ticket={ticket} onClose={() => setModal(null)} onDone={reload} />
      ) : null}
      {modal === "cant" ? (
        <CloseModal
          kind="cant_reproduce"
          ticket={ticket}
          onClose={() => setModal(null)}
          onDone={reload}
        />
      ) : null}
    </>
  );
}

function RequestCard({
  ticket,
  editable,
  disabled,
  onStatus,
  onAssign,
}: {
  ticket: TicketDetail;
  editable: boolean;
  disabled: boolean;
  onStatus: (s: "open" | "waiting_on_user" | "resolved") => void;
  onAssign: (to: "me" | "nobody") => void;
}) {
  const sid = useId();
  const aid = useId();
  const current = statusSelectValue(ticket.status);
  const assigned = ticket.assignedToMe ? "me" : ticket.assignee ? "other" : "nobody";
  return (
    <section aria-labelledby="reqc" className={`${CARD} flex flex-col gap-3 p-5`}>
      <h2 id="reqc" className="font-medium text-[15px] text-text">
        Request
      </h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={sid} className={LABEL}>
          Status
        </label>
        <select
          id={sid}
          value={current}
          disabled={!editable || disabled}
          onChange={(e) => onStatus(e.target.value as "open" | "waiting_on_user" | "resolved")}
          className={`${FIELD} h-10`}
        >
          {isClosed(ticket.status) ? (
            <option value={current}>
              {ticketStatus(ticket.status, { isNew: false, logged: false }).label}
            </option>
          ) : null}
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Topic</span>
        <p className="text-[14px] text-text-secondary">{ticket.category || "—"}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={aid} className={LABEL}>
          Assigned to
        </label>
        <select
          id={aid}
          value={assigned}
          disabled={!editable || disabled}
          onChange={(e) => {
            if (e.target.value === "me" || e.target.value === "nobody") onAssign(e.target.value);
          }}
          className={`${FIELD} h-10`}
        >
          <option value="me">You</option>
          {assigned === "other" ? (
            <option value="other" disabled>
              {ticket.assignee?.name}
            </option>
          ) : null}
          <option value="nobody">Unassigned</option>
        </select>
      </div>
    </section>
  );
}

/** Reply / Internal note composer (SP2, SP3). The draft stays in the box when sending fails. */
function Composer({
  ticket,
  name,
  onSent,
}: {
  ticket: TicketDetail;
  name: string;
  onSent: () => void;
}) {
  const toast = useToast();
  const id = useId();
  const online = useOnline();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState({ reply: "", note: "" });
  const [busy, setBusy] = useState(false);
  const body = text[mode];

  async function send() {
    const message = body.trim();
    if (!message) return;
    setBusy(true);
    const r =
      mode === "reply"
        ? await replyToTicket(ticket.id, message)
        : await addNote(ticket.id, message);
    setBusy(false);
    if (!r.ok) {
      toast(
        failureToast(
          mode === "reply" ? "Your reply didn’t send" : "The note didn’t save",
          `${r.message} What you wrote is still here.`,
        ),
      );
      return;
    }
    setText((t) => ({ ...t, [mode]: "" }));
    toast(
      mode === "reply"
        ? {
            tone: "success",
            title: "Reply sent",
            body: `${name} gets it by email and in the app. The request is now waiting on ${name}.`,
          }
        : { tone: "success", title: "Note added", body: "Only the team can see it." },
    );
    onSent();
  }

  return (
    <section aria-label="Reply" className={`${CARD} flex flex-col gap-3 p-5`}>
      <div role="tablist" aria-label="Reply or note" className="flex gap-2">
        <Chip role="tab" selected={mode === "reply"} onClick={() => setMode("reply")}>
          Reply
        </Chip>
        <Chip role="tab" selected={mode === "note"} onClick={() => setMode("note")}>
          Internal note
        </Chip>
      </div>
      <label htmlFor={id} className={LABEL}>
        {mode === "reply" ? "Reply to the learner" : "Note for the team"}
      </label>
      <textarea
        id={id}
        value={body}
        maxLength={5000}
        onChange={(e) => setText((t) => ({ ...t, [mode]: e.target.value }))}
        placeholder={mode === "reply" ? `Hi ${name}, …` : "Only the team can see this."}
        className={`${TEXTAREA} min-h-[140px]`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-text-tertiary">
          {mode === "reply" ? "Sent by email and in the app" : "Not sent to the learner"}
        </p>
        <button
          type="button"
          onClick={send}
          disabled={busy || !online || body.trim().length < 1}
          className={BTN_PRIMARY}
        >
          {busy ? "Sending…" : mode === "reply" ? "Send reply" : "Add note"}
        </button>
      </div>
    </section>
  );
}
