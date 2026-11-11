"use client";

import { useEffect, useRef, useState } from "react";
import { getBatches, getWaitlistStats, listWaitlist } from "../../lib/people/api";
import { formatDate, formatDay, lastActive, percent, plural } from "../../lib/people/format";
import {
  batchLine,
  clampInvite,
  INVITE_DEFAULT,
  inviteRangeLine,
  remindableBatch,
  toCsv,
  WAITLIST_STATUS,
} from "../../lib/people/logic";
import type { Batch, WaitlistEntry, WaitlistFilter, WaitlistStats } from "../../lib/people/types";
import { useLoaded, useNow, useOnline, useSkeletonGate } from "./hooks";
import { type PageOf, usePaged } from "./paged";
import { LoadMore, ROW, SkeletonRows, TableCard, TD, TH } from "./table";
import {
  BAR,
  Badge,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  Chip,
  FIELD,
  Icon,
  LoadError,
  OfflineNote,
  PATHS,
  StateBlock,
} from "./ui";
import type { ExportFn } from "./users-list";
import { InviteModal, RemindModal } from "./waitlist-modals";

const FILTERS: { value: WaitlistFilter; label: string }[] = [
  { value: "waiting", label: "Waiting" },
  { value: "invited", label: "Invited" },
  { value: "joined", label: "Joined" },
  { value: "all", label: "All" },
];

export function Waitlist({
  canManage,
  onWaiting,
  registerExport,
}: {
  canManage: boolean;
  onWaiting: (n: number) => void;
  registerExport: (fn: ExportFn) => void;
}) {
  const now = useNow();
  const online = useOnline();
  const [filter, setFilter] = useState<WaitlistFilter>("waiting");
  const [batchSize, setBatchSize] = useState(INVITE_DEFAULT);
  const [modal, setModal] = useState<"invite" | "remind" | null>(null);

  const stats = useLoaded((s) => getWaitlistStats(s), "stats");
  const batches = useLoaded((s) => getBatches(s), "batches");
  const list = usePaged<WaitlistEntry>(async (cursor, signal) => {
    const r = await listWaitlist({ status: filter, cursor, signal });
    if (!r.ok) return r;
    const page: PageOf<WaitlistEntry> = { items: r.data.entries, nextCursor: r.data.nextCursor };
    return { ok: true, data: page };
  }, filter);
  const skeleton = useSkeletonGate(list.status === "loading");

  const s = stats.state.status === "ready" ? stats.state.data : null;
  const waiting = s?.waiting ?? 0;
  const size = clampInvite(batchSize, waiting);
  const onWaitingRef = useRef(onWaiting);
  onWaitingRef.current = onWaiting;
  useEffect(() => {
    if (s) onWaitingRef.current(s.waiting);
  }, [s]);

  const itemsRef = useRef(list.items);
  itemsRef.current = list.items;
  useEffect(() => {
    registerExport(() => ({
      rows: itemsRef.current.length,
      name: "matr-waitlist.csv",
      csv: toCsv(
        ["Email", "Joined waitlist", "Source", "Status"],
        itemsRef.current.map((e) => [
          e.email,
          formatDate(e.joinedAt),
          e.source ?? "",
          WAITLIST_STATUS[e.status].label,
        ]),
      ),
    }));
    return () => registerExport(null);
  }, [registerExport]);

  function refreshAll() {
    stats.reload();
    batches.reload();
    list.reload();
  }

  const batchList = batches.state.status === "ready" ? batches.state.data : [];
  const latest = [...batchList].sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt))[0];
  const remindable = remindableBatch(batchList);
  const selecting = filter === "waiting" && canManage && waiting > 0;
  const waitingRows = list.items.filter((e) => e.status === "waiting");

  return (
    <div className="flex flex-col gap-5">
      {online ? null : <OfflineNote />}
      <Tiles state={stats.state} onRetry={stats.reload} now={now} />

      {latest ? (
        <BatchBar
          batch={latest}
          canRemind={canManage && remindable?.id === latest.id}
          onRemind={() => setModal("remind")}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex flex-wrap gap-2 border-0 p-0">
          <legend className="sr-only">Filter the waitlist</legend>
          {FILTERS.map((f) => (
            <Chip key={f.value} selected={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </Chip>
          ))}
        </fieldset>
        {selecting ? (
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="batch-size"
              className="flex items-center gap-2 text-[14px] text-text leading-5"
            >
              <input
                id="batch-size"
                type="number"
                inputMode="numeric"
                min={1}
                max={Math.min(waiting, 500)}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                onBlur={() => setBatchSize(size || 1)}
                className={`${FIELD} h-9 w-20 px-2 text-center`}
              />
              <span aria-live="polite">selected · oldest first</span>
            </label>
            <button
              type="button"
              disabled={size < 1 || !online}
              onClick={() => setModal("invite")}
              className={BTN_PRIMARY}
            >
              <Icon d={PATHS.mail} />
              Invite {size.toLocaleString("en-GB")}
            </button>
          </div>
        ) : null}
      </div>

      {list.status === "error" && list.items.length === 0 ? (
        <LoadError what="the waitlist" onRetry={list.reload} />
      ) : list.status === "ready" && list.items.length === 0 ? (
        filter === "waiting" ? (
          <StateBlock
            role="status"
            title="The waitlist is empty"
            body="Everyone on it has been invited."
          />
        ) : (
          <StateBlock
            role="status"
            title="Nobody here yet"
            body="People appear in this view once they reach this step."
          />
        )
      ) : (
        <>
          <TableCard label="Waitlist">
            <thead>
              <tr>
                <th scope="col" className={TH}>
                  Email
                </th>
                <th scope="col" className={TH}>
                  Joined waitlist
                </th>
                <th scope="col" className={`${TH} hidden md:table-cell`}>
                  Source
                </th>
                <th scope="col" className={`${TH} hidden sm:table-cell`}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody aria-busy={list.status === "loading"}>
              {list.status === "loading" ? (
                skeleton ? (
                  <SkeletonRows
                    cells={[
                      { cls: "", bar: "w-44" },
                      { cls: "", bar: "w-20" },
                      { cls: "hidden md:table-cell", bar: "w-20" },
                      { cls: "hidden sm:table-cell", bar: "w-16" },
                    ]}
                  />
                ) : null
              ) : (
                list.items.map((e) => {
                  const st = WAITLIST_STATUS[e.status];
                  const picked =
                    selecting && e.status === "waiting" && waitingRows.indexOf(e) < size;
                  return (
                    <tr
                      key={e.id}
                      className={`${ROW} ${picked ? "bg-primary-accent/40" : ""}`}
                      aria-selected={picked || undefined}
                    >
                      <td className={`${TD} break-all`}>
                        {e.email}
                        <span className="mt-1 block sm:hidden">
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </span>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>{formatDate(e.joinedAt)}</td>
                      <td className={`${TD} hidden md:table-cell`}>{e.source ?? "—"}</td>
                      <td className={`${TD} hidden sm:table-cell`}>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </TableCard>
          {list.status === "loading" ? <p className="sr-only">Loading the waitlist</p> : null}
          <LoadMore
            more={list.more}
            loading={list.loadingMore}
            failed={list.moreFailed}
            onClick={list.loadMore}
          />
        </>
      )}

      {modal === "invite" ? (
        <InviteModal
          count={size}
          rangeLine={inviteRangeLine(size, list.items, s?.oldestWaitingAt ?? null)}
          onClose={() => setModal(null)}
          onSent={refreshAll}
        />
      ) : null}
      {modal === "remind" && remindable ? (
        <RemindModal batch={remindable} onClose={() => setModal(null)} onSent={refreshAll} />
      ) : null}
    </div>
  );
}

function Tiles({
  state,
  onRetry,
  now,
}: {
  state: ReturnType<typeof useLoaded<WaitlistStats>>["state"];
  onRetry: () => void;
  now: Date;
}) {
  const gate = useSkeletonGate(state.status === "loading");
  if (state.status === "error")
    return (
      <div className={CARD}>
        <LoadError what="the waitlist numbers" onRetry={onRetry} />
      </div>
    );
  const s = state.status === "ready" ? state.data : null;
  const tiles: [string, string, string][] = [
    [
      "Waiting",
      s ? s.waiting.toLocaleString("en-GB") : "",
      s ? `oldest: ${formatDay(s.oldestWaitingAt)}` : "",
    ],
    [
      "Invited",
      s ? s.invited.toLocaleString("en-GB") : "",
      s
        ? s.lastBatchAt
          ? `last batch ${lastActive(s.lastBatchAt, now).toLowerCase()}`
          : "no batches yet"
        : "",
    ],
    [
      "Account created",
      s ? s.created.toLocaleString("en-GB") : "",
      s ? `${percent(s.created, s.invited)} of invited` : "",
    ],
    [
      "Confirmed",
      s ? s.confirmed.toLocaleString("en-GB") : "",
      s ? `${percent(s.confirmed, s.invited)} of invited` : "",
    ],
  ];
  return (
    <ul aria-busy={!s} className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {tiles.map(([label, value, sub]) => (
        <li key={label} className={`${CARD} flex flex-col gap-1 p-5`}>
          <span className="text-[13px] text-text-secondary leading-5">{label}</span>
          {s ? (
            <>
              <span className="font-medium text-[28px] text-text leading-9 tracking-[-0.56px]">
                {value}
              </span>
              <span className="text-[12px] text-text-tertiary leading-4">{sub}</span>
            </>
          ) : gate ? (
            <>
              <span className={`${BAR} h-8 w-20`} />
              <span className={`${BAR} h-3 w-24`} />
            </>
          ) : (
            <span className="h-[52px]" />
          )}
        </li>
      ))}
    </ul>
  );
}

function BatchBar({
  batch,
  canRemind,
  onRemind,
}: {
  batch: Batch;
  canRemind: boolean;
  onRemind: () => void;
}) {
  const note = batch.reminderSentAt
    ? `Reminder sent on ${formatDay(batch.reminderSentAt)}. That was the only one.`
    : batch.notJoined > 0
      ? `${plural(batch.notJoined, "person", "people")} haven’t joined after 7 days. We send one reminder, then stop.`
      : "Nobody is overdue to join. We send one reminder after 7 days, then stop.";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-bg-fill1 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5 text-[14px] leading-5 tracking-[-0.14px]">
        <p className="font-medium text-text">{batchLine(batch)}</p>
        <p className="text-[13px] text-text-tertiary">{note}</p>
      </div>
      {canRemind ? (
        <button type="button" onClick={onRemind} className={BTN_SECONDARY}>
          <Icon d={PATHS.mail} />
          Remind {plural(batch.notJoined, "person", "people")}
        </button>
      ) : null}
    </div>
  );
}
