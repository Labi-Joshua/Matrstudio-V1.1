"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import type { ApiFailure } from "../../lib/api";
import { type AssignKind, assignItem } from "../../lib/review/api";
import type { Assignee, Reporter } from "../../lib/review/types";
import type { Loaded } from "./hooks";
import { useSkeletonGate } from "./hooks";
import { ArrowLeftIcon } from "./icons";
import { ToastProvider, useToast } from "./toast";
import { Button, Card, FOCUS, Row, Skeleton, StateBlock } from "./ui";

/** Wraps a review page: toasts live here so every screen and modal can use them. */
export function ReviewRoot({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 self-start rounded-md text-[13px] text-text-secondary hover:text-text ${FOCUS}`}
    >
      <ArrowLeftIcon />
      {label}
    </Link>
  );
}

export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-80 max-w-full" />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/** Loading (after the skeleton delay), not found, forbidden and error states of a detail screen. */
export function DetailGate<T>({
  state,
  reload,
  backHref,
  backLabel,
  what,
  children,
}: {
  state: Loaded<T>;
  reload: () => void;
  backHref: string;
  backLabel: string;
  what: string;
  children: (data: T) => ReactNode;
}) {
  const showSkeleton = useSkeletonGate(state.status === "loading");
  if (state.status === "loading") {
    return showSkeleton ? <DetailSkeleton /> : <div className="min-h-[360px]" aria-busy="true" />;
  }
  if (state.status === "error")
    return (
      <DetailError
        failure={state.failure}
        reload={reload}
        backHref={backHref}
        backLabel={backLabel}
        what={what}
      />
    );
  return <>{children(state.data)}</>;
}

function DetailError({
  failure,
  reload,
  backHref,
  backLabel,
  what,
}: {
  failure: ApiFailure;
  reload: () => void;
  backHref: string;
  backLabel: string;
  what: string;
}) {
  const gone = failure.status === 404;
  const denied = failure.code === "forbidden";
  return (
    <div className="flex flex-col gap-6">
      <BackLink href={backHref} label={backLabel} />
      <StateBlock
        heading
        tone="error"
        title={gone ? `This ${what} isn’t here any more` : `We couldn’t load this ${what}`}
        body={
          gone
            ? "It may have been handled already, or the link is wrong."
            : denied
              ? "Your role can’t open the review queues."
              : "Try again in a moment. Nothing was changed."
        }
        action={
          gone || denied ? (
            <Link
              href={backHref}
              className={`text-[13px] font-medium text-primary-text underline ${FOCUS}`}
            >
              {backLabel}
            </Link>
          ) : (
            <Button onClick={reload}>Try again</Button>
          )
        }
      />
    </div>
  );
}

/** "Assigned to" card with Assign to me / Unassign. Changes are announced with a toast. */
export function AssignCard({
  kind,
  id,
  assignedTo,
  meId,
  canManage,
  onChange,
}: {
  kind: AssignKind;
  id: string;
  assignedTo: Assignee;
  meId: string | null;
  canManage: boolean;
  onChange: (next: Assignee) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const mine = assignedTo !== null && assignedTo.id === meId;

  async function change(target: "me" | null) {
    setBusy(true);
    const result = await assignItem(kind, id, target);
    setBusy(false);
    if (!result.ok) {
      toast({
        tone: "error",
        title: "Couldn’t change the assignee",
        body: result.status === 409 ? result.message : "Try again in a moment.",
      });
      return;
    }
    onChange(result.data.assignedTo);
    toast({ tone: "success", title: target === "me" ? "Assigned to you" : "Unassigned" });
  }

  return (
    <Card>
      <dl className="m-0">
        <Row label="Assigned to">
          {assignedTo ? (mine ? "You" : assignedTo.name) : "Nobody yet"}
        </Row>
      </dl>
      {canManage ? (
        <div className="mt-1">
          {mine ? (
            <Button disabled={busy} onClick={() => change(null)}>
              Unassign
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => change("me")}>
              {assignedTo ? "Take over" : "Assign to me"}
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  );
}

/** The messages learners sent with a report (link reports and profile reports). */
export function ReporterList({ reports }: { reports: Reporter[] }) {
  if (reports.length === 0) {
    return <p className="text-[13px] text-text-secondary">No messages came with these reports.</p>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {reports.map((m) => (
        <li
          key={`${m.name}|${m.when}|${m.text}`}
          className="rounded-xl bg-bg-fill1 p-3 text-[13px]"
        >
          <p>
            <span className="font-medium text-text">{m.name}</span>{" "}
            <span className="text-text-tertiary">{m.when}</span>
          </p>
          <p className="mt-0.5 text-text-secondary">{m.text || "No message."}</p>
        </li>
      ))}
    </ul>
  );
}
