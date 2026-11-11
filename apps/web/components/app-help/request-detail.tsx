"use client";

import { useCallback, useEffect, useState } from "react";
import { isClosed, KIND_LABEL, parseRequestId, shortDate } from "../../lib/app/help-requests";
import { getTicket, type Ticket } from "../../lib/auth/support-api";
import { ROUTES } from "../../lib/routes";
import { useSkeletonGate } from "../app/hooks";
import { FOCUS } from "../app/ui";
import { ButtonLink } from "../auth/button";
import { BackLink } from "./fields";
import { RequestSkeleton } from "./help-skeletons";
import { OfflineNotice } from "./offline-notice";
import { ReplyBox } from "./reply-box";
import { ContextLine, Conversation, StatusNote } from "./request-conversation";
import { StatusChip } from "./ticket-status";

/**
 * The request page, /learn/help/request?id=... (Figma 485:45291 "Support replied", 485:45370
 * "Request resolved", 485:45618 outcome). The id is read from the address bar in the browser
 * because the site is a static export (no dynamic segments). States: loading (gated skeleton),
 * "didn't load" with Retry, "can't find it" for a missing or foreign request (the API answers 404
 * for both), and the request itself with its conversation, a status note and, while it is open,
 * the reply box.
 */
type View =
  | { phase: "loading" }
  | { phase: "failed"; notFound: boolean }
  | { phase: "ready"; ticket: Ticket };

const back = <BackLink href={ROUTES.app.help}>Help centre</BackLink>;

export function RequestScreen() {
  const [id, setId] = useState<string | null | undefined>(undefined);
  const [view, setView] = useState<View>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [now] = useState(() => new Date());

  useEffect(() => setId(parseRequestId(window.location.search)), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the load on Retry
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setView({ phase: "loading" });
    getTicket(id, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setView(
        result.ok
          ? { phase: "ready", ticket: result.data }
          : { phase: "failed", notFound: result.code === "not_found" },
      );
    });
    return () => controller.abort();
  }, [id, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const pending = id === undefined || (id !== null && view.phase === "loading");
  const showSkeleton = useSkeletonGate(pending);

  if (id === null) {
    return (
      <Shell>
        <Missing />
      </Shell>
    );
  }
  if (pending) {
    return (
      <Shell>
        <div aria-busy="true">{showSkeleton ? <RequestSkeleton /> : null}</div>
      </Shell>
    );
  }
  if (view.phase === "failed") {
    return <Shell>{view.notFound ? <Missing /> : <Failed onRetry={reload} />}</Shell>;
  }
  if (view.phase !== "ready") return null;
  const { ticket } = view;
  // The send answers may leave the messages out; the page then reloads the full request.
  const onSent = (next: Ticket) =>
    next.messages ? setView({ phase: "ready", ticket: next }) : reload();

  return (
    <Shell>
      <div className="flex w-full max-w-[820px] flex-col gap-5">
        <header className="flex flex-col items-start gap-2.5">
          <h1 className="break-words font-medium text-[28px] text-text leading-8 tracking-[-0.56px] md:text-[30px] md:leading-9 md:tracking-[-0.6px]">
            {ticket.subject}
          </h1>
          <StatusChip status={ticket.status} />
          <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
            {[KIND_LABEL[ticket.kind], ticket.category, `Sent ${shortDate(ticket.createdAt)}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {ticket.context ? <ContextLine context={ticket.context} /> : null}
        </header>
        <Conversation messages={ticket.messages ?? []} now={now} />
        <StatusNote ticket={ticket} />
        {isClosed(ticket.status) ? null : (
          <ReplyBox ticketId={ticket.id} onSent={onSent} onClosed={reload} />
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      {back}
      <OfflineNotice />
      {children}
    </div>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex w-full max-w-[720px] flex-col items-start gap-3 rounded-xl border border-border-soft bg-bg-base p-6"
    >
      <h1 className="font-medium text-[22px] text-text leading-7 tracking-[-0.22px]">
        Your request didn’t load
      </h1>
      <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
        Check your connection and try again.
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

function Missing() {
  return (
    <div className="flex w-full max-w-[720px] flex-col items-start gap-3 rounded-xl border border-border-soft bg-bg-base p-6">
      <h1 className="font-medium text-[22px] text-text leading-7 tracking-[-0.22px]">
        We can’t find that request
      </h1>
      <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
        The link may be wrong, or the request may belong to another account.
      </p>
      <div className="w-full sm:w-fit">
        <ButtonLink href={ROUTES.app.help} variant="secondary">
          Back to help centre
        </ButtonLink>
      </div>
    </div>
  );
}
