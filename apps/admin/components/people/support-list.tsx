"use client";

import Link from "next/link";
import { useState } from "react";
import { listSupport } from "../../lib/people/api";
import { dueShort } from "../../lib/people/format";
import { KIND_LABEL, ticketStatus } from "../../lib/people/logic";
import type { SupportKind, SupportList, SupportTab, TicketRow } from "../../lib/people/types";
import { useNow, useOnline, useSkeletonGate } from "./hooks";
import { type PageOf, usePaged } from "./paged";
import { LoadMore, ROW, SkeletonRows, TableCard, TD, TH } from "./table";
import {
  Avatar,
  Badge,
  BTN_SECONDARY,
  Chip,
  FOCUS,
  LoadError,
  OfflineNote,
  PageHeader,
  StateBlock,
} from "./ui";

const TABS: { value: SupportTab; label: string; key: keyof SupportList["counts"] }[] = [
  { value: "open", label: "Open", key: "open" },
  { value: "waiting", label: "Waiting on user", key: "waiting" },
  { value: "resolved", label: "Resolved", key: "resolved" },
];

const EMPTY: Record<SupportTab, [string, string]> = {
  open: ["No open requests", "Nice work. New requests show up here."],
  waiting: [
    "Nothing waiting on a learner",
    "Requests you’ve replied to show up here until they answer.",
  ],
  resolved: ["Nothing resolved yet", "Closed requests show up here."],
};

/** Support inbox list (Figma SP1, SP10 and the loading and empty frames). */
export function SupportInbox() {
  const now = useNow();
  const online = useOnline();
  const [tab, setTab] = useState<SupportTab>("open");
  const [kind, setKind] = useState<SupportKind | null>(null);
  const [mine, setMine] = useState(false);
  const [overdue, setOverdue] = useState(false);
  const list = usePaged<TicketRow>(async (cursor, signal) => {
    const r = await listSupport({ tab, kind, mine, overdue, cursor, signal });
    if (!r.ok) return r;
    const page: PageOf<TicketRow> = {
      items: r.data.tickets,
      nextCursor: r.data.nextCursor,
      extra: r.data.counts,
    };
    return { ok: true, data: page };
  }, `${tab}|${kind}|${mine}|${overdue}`);
  const skeleton = useSkeletonGate(list.status === "loading");
  const counts = list.extra as SupportList["counts"] | undefined;
  const filtered = kind !== null || mine || overdue;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Support inbox" intro="Oldest first. First reply within 2 working days." />
      {online ? null : <OfflineNote />}
      <div role="tablist" aria-label="Request status" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Chip
            key={t.value}
            role="tab"
            selected={tab === t.value}
            onClick={() => setTab(t.value)}
            count={counts?.[t.key] ?? null}
          >
            {t.label}
          </Chip>
        ))}
      </div>
      <fieldset className="flex flex-wrap gap-2 border-0 p-0">
        <legend className="sr-only">Filter requests</legend>
        <Chip selected={mine} onClick={() => setMine(!mine)}>
          Assigned to me
        </Chip>
        <Chip
          selected={kind === "support"}
          onClick={() => setKind(kind === "support" ? null : "support")}
        >
          Contact support
        </Chip>
        <Chip
          selected={kind === "report"}
          onClick={() => setKind(kind === "report" ? null : "report")}
        >
          Report a problem
        </Chip>
        <Chip selected={overdue} onClick={() => setOverdue(!overdue)}>
          Overdue
        </Chip>
      </fieldset>

      <div role="tabpanel" aria-label={TABS.find((t) => t.value === tab)?.label}>
        {list.status === "error" && list.items.length === 0 ? (
          <LoadError what="the inbox" onRetry={list.reload} />
        ) : list.status === "ready" && list.items.length === 0 ? (
          filtered ? (
            <StateBlock
              role="status"
              title="No requests match"
              body="Try another filter, or clear them."
            >
              <button
                type="button"
                className={BTN_SECONDARY}
                onClick={() => {
                  setKind(null);
                  setMine(false);
                  setOverdue(false);
                }}
              >
                Clear filters
              </button>
            </StateBlock>
          ) : (
            <StateBlock role="status" title={EMPTY[tab][0]} body={EMPTY[tab][1]} />
          )
        ) : (
          <>
            <TableCard label="Support requests">
              <thead>
                <tr>
                  <th scope="col" className={TH}>
                    Request
                  </th>
                  <th scope="col" className={`${TH} hidden lg:table-cell`}>
                    From
                  </th>
                  <th scope="col" className={TH}>
                    <span className="max-md:sr-only">Type</span>
                  </th>
                  <th scope="col" className={`${TH} hidden xl:table-cell`}>
                    Topic
                  </th>
                  <th scope="col" className={`${TH} hidden md:table-cell`}>
                    Status
                  </th>
                  <th scope="col" className={`${TH} hidden md:table-cell`}>
                    Reply due
                  </th>
                </tr>
              </thead>
              <tbody aria-busy={list.status === "loading"}>
                {list.status === "loading" ? (
                  skeleton ? (
                    <SkeletonRows
                      cells={[
                        { cls: "", bar: "w-48" },
                        { cls: "hidden lg:table-cell", bar: "w-28" },
                        { cls: "", bar: "w-24" },
                        { cls: "hidden xl:table-cell", bar: "w-16" },
                        { cls: "hidden md:table-cell", bar: "w-16" },
                        { cls: "hidden md:table-cell", bar: "w-14" },
                      ]}
                    />
                  ) : null
                ) : (
                  list.items.map((t) => (
                    <TicketRowView key={t.id} t={t} now={now} showDue={tab !== "resolved"} />
                  ))
                )}
              </tbody>
            </TableCard>
            {list.status === "loading" ? <p className="sr-only">Loading requests</p> : null}
            <LoadMore
              more={list.more}
              loading={list.loadingMore}
              failed={list.moreFailed}
              onClick={list.loadMore}
            />
          </>
        )}
      </div>
    </div>
  );
}

function TicketRowView({ t, now, showDue }: { t: TicketRow; now: Date; showDue: boolean }) {
  const st = ticketStatus(t.status, { isNew: t.isNew, logged: t.logged });
  const late = t.overdue && showDue;
  return (
    <tr className={`${ROW} ${late ? "bg-error-accent/60 hover:bg-error-accent" : ""}`}>
      <td className={TD}>
        <Link
          href={`/support?id=${encodeURIComponent(t.id)}`}
          className={`block truncate rounded font-medium after:absolute after:inset-0 ${FOCUS}`}
        >
          {t.subject}
          {late ? <span className="sr-only"> (overdue)</span> : null}
        </Link>
        {t.snippet ? (
          <span className="block truncate text-[12px] text-text-tertiary leading-4">
            {t.snippet}
          </span>
        ) : null}
        <span className="mt-1 flex items-center gap-2 md:hidden">
          <Badge tone={st.tone}>{st.label}</Badge>
          {showDue ? (
            <span className={`text-[12px] ${late ? "text-error-text" : "text-text-tertiary"}`}>
              {dueShort(t.dueAt, t.overdue, now)}
            </span>
          ) : null}
        </span>
      </td>
      <td className={`${TD} hidden lg:table-cell`}>
        <div className="flex items-center gap-2">
          <Avatar name={t.requester.name} size={28} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{t.requester.name}</span>
            <span className="truncate text-[12px] text-text-tertiary leading-4">
              {t.requester.email}
            </span>
          </div>
        </div>
      </td>
      <td className={TD}>
        <span className="inline-flex whitespace-nowrap rounded-md bg-bg-fill1 px-1.5 text-[12px] text-text-secondary leading-5">
          {KIND_LABEL[t.kind]}
        </span>
      </td>
      <td className={`${TD} hidden xl:table-cell`}>{t.category || "—"}</td>
      <td className={`${TD} hidden md:table-cell`}>
        <Badge tone={st.tone}>{st.label}</Badge>
      </td>
      <td
        className={`${TD} hidden whitespace-nowrap md:table-cell ${late ? "text-error-text" : ""}`}
      >
        {showDue ? dueShort(t.dueAt, t.overdue, now) : "—"}
      </td>
    </tr>
  );
}
