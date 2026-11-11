"use client";

import Link from "next/link";
import { useState } from "react";
import { requestHref, requestsSummary, ticketMeta } from "../../lib/app/help-requests";
import type { Ticket } from "../../lib/auth/support-api";
import { useSkeletonGate } from "../app/hooks";
import { ChevronRightIcon, FileTextIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { BugIcon, MessageCircleIcon } from "./help-icons";
import { RequestsSkeleton } from "./help-skeletons";
import { StatusChip } from "./ticket-status";
import { type TicketsState, useTickets } from "./use-tickets";

/**
 * "Your requests" under the hub's two cards (Figma 485:45143): a summary line, then one row per
 * request with its kind icon, subject, a meta line and the status chip; the empty, loading
 * (gated skeleton) and "didn't load" states are designed here too.
 */
function Row({ ticket, now }: { ticket: Ticket; now: Date }) {
  const Icon = ticket.kind === "report" ? BugIcon : MessageCircleIcon;
  return (
    <li>
      <Link
        href={requestHref(ticket.id)}
        className={`flex items-center gap-3 rounded-xl border border-border-soft bg-bg-base p-3 hover:bg-bg-fill1 ${FOCUS}`}
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-soft text-text-secondary"
        >
          <Icon size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
            {ticket.subject}
          </span>
          <span className="text-[12px] text-text-secondary leading-4 tracking-[-0.12px] md:truncate">
            {ticketMeta(ticket, now)}
          </span>
        </span>
        <StatusChip status={ticket.status} />
        <ChevronRightIcon size={16} className="hidden shrink-0 text-text-tertiary md:block" />
      </Link>
    </li>
  );
}

export function RequestsBody({
  state,
  now,
  onRetry,
}: {
  state: TicketsState;
  now: Date;
  onRetry: () => void;
}) {
  const showSkeleton = useSkeletonGate(state.status === "loading");
  if (state.status === "loading") {
    return <div aria-busy="true">{showSkeleton ? <RequestsSkeleton /> : null}</div>;
  }
  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border border-border-soft bg-bg-base p-5"
      >
        <p className="font-medium text-[16px] text-text leading-6 tracking-[-0.16px]">
          Your requests didn’t load
        </p>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          Check your connection and try again. Contact support and Report a problem still work.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className={`btn-lift inline-flex h-10 items-center rounded-lg bg-text px-4 font-medium text-[14px] text-bg-base leading-5 ${FOCUS}`}
        >
          Try again
        </button>
      </div>
    );
  }
  if (state.tickets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border border-dashed bg-bg-fill1 px-6 py-10 text-center">
        <span
          aria-hidden="true"
          className="mb-1 flex size-10 items-center justify-center rounded-lg border border-border bg-bg-base text-text-tertiary"
        >
          <FileTextIcon size={20} />
        </span>
        <p className="font-medium text-[16px] text-text leading-6 tracking-[-0.16px]">
          No requests yet
        </p>
        <p className="max-w-[380px] text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          When you contact support or report a problem, you can follow it here.
        </p>
      </div>
    );
  }
  return (
    <>
      <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
        {requestsSummary(state.tickets)}
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {state.tickets.map((ticket) => (
          <Row key={ticket.id} ticket={ticket} now={now} />
        ))}
      </ul>
    </>
  );
}

export function RequestsList() {
  const { state, retry } = useTickets();
  const [now] = useState(() => new Date());
  return (
    <section aria-labelledby="help-requests-title" className="flex flex-col gap-3">
      <h2
        id="help-requests-title"
        className="font-medium text-[20px] text-text leading-7 tracking-[-0.2px]"
      >
        Your requests
      </h2>
      <RequestsBody state={state} now={now} onRetry={retry} />
    </section>
  );
}
