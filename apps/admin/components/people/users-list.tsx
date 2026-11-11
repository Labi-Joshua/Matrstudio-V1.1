"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { listUsers } from "../../lib/people/api";
import { formatDate, lastActive } from "../../lib/people/format";
import { toCsv, USER_STATUS } from "../../lib/people/logic";
import type { UserFilter, UserList, UserRow } from "../../lib/people/types";
import { useDebounced, useNow, useOnline, useSkeletonGate } from "./hooks";
import { type PageOf, usePaged } from "./paged";
import { LoadMore, ROW, SkeletonRows, TableCard, TD, TH } from "./table";
import {
  Avatar,
  Badge,
  BTN_SECONDARY,
  Chip,
  FOCUS,
  INPUT,
  LABEL,
  LoadError,
  OfflineNote,
  StateBlock,
} from "./ui";

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unconfirmed", label: "Unconfirmed" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

export type ExportFn = (() => { rows: number; csv: string; name: string }) | null;

export function UsersList({
  onTotals,
  registerExport,
}: {
  onTotals: (t: UserList["totals"]) => void;
  registerExport: (fn: ExportFn) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserFilter>("all");
  const term = useDebounced(search, 300);
  const now = useNow();
  const online = useOnline();
  const list = usePaged<UserRow>(async (cursor, signal) => {
    const r = await listUsers({ search: term, status, cursor, signal });
    if (!r.ok) return r;
    const page: PageOf<UserRow> = {
      items: r.data.users,
      nextCursor: r.data.nextCursor,
      extra: r.data.totals,
    };
    return { ok: true, data: page };
  }, `${term}|${status}`);
  const skeleton = useSkeletonGate(list.status === "loading");

  const totalsRef = useRef(onTotals);
  totalsRef.current = onTotals;
  useEffect(() => {
    const t = list.extra as UserList["totals"] | undefined;
    if (t) totalsRef.current(t);
  }, [list.extra]);

  const itemsRef = useRef(list.items);
  itemsRef.current = list.items;
  useEffect(() => {
    registerExport(() => ({
      rows: itemsRef.current.length,
      name: "matr-users.csv",
      csv: toCsv(
        ["Name", "Email", "Status", "Joined", "Paths", "Last sign-in"],
        itemsRef.current.map((u) => [
          u.name,
          u.email,
          USER_STATUS[u.status].label,
          formatDate(u.joinedAt),
          String(u.pathsCount),
          formatDate(u.lastSignInAt),
        ]),
      ),
    }));
    return () => registerExport(null);
  }, [registerExport]);

  const filtered = term.trim() !== "" || status !== "all";

  return (
    <div className="flex flex-col gap-5">
      {online ? null : <OfflineNote />}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex w-full flex-col gap-1.5 sm:w-[360px]">
          <label htmlFor="user-search" className={LABEL}>
            Search
          </label>
          <input
            id="user-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email"
            autoComplete="off"
            className={INPUT}
          />
        </div>
        <fieldset className="flex flex-wrap gap-2 border-0 p-0">
          <legend className="sr-only">Filter by status</legend>
          {FILTERS.map((f) => (
            <Chip key={f.value} selected={status === f.value} onClick={() => setStatus(f.value)}>
              {f.label}
            </Chip>
          ))}
        </fieldset>
      </div>

      {list.status === "error" && list.items.length === 0 ? (
        <LoadError what="users" onRetry={list.reload} />
      ) : list.status === "ready" && list.items.length === 0 ? (
        filtered ? (
          <StateBlock
            role="status"
            title={term.trim() ? `No users match “${term.trim()}”` : "No users with that status"}
            body="Check the spelling, or search by name."
          >
            <button
              type="button"
              className={BTN_SECONDARY}
              onClick={() => {
                setSearch("");
                setStatus("all");
              }}
            >
              Clear filters
            </button>
          </StateBlock>
        ) : (
          <StateBlock
            role="status"
            title="No learners yet"
            body="People show up here once they create an account."
          />
        )
      ) : (
        <>
          <TableCard label="Users">
            <thead>
              <tr>
                <th scope="col" className={TH}>
                  User
                </th>
                <th scope="col" className={`${TH} hidden md:table-cell`}>
                  Status
                </th>
                <th scope="col" className={`${TH} hidden lg:table-cell`}>
                  Joined
                </th>
                <th scope="col" className={`${TH} hidden lg:table-cell`}>
                  Paths
                </th>
                <th scope="col" className={`${TH} hidden md:table-cell`}>
                  Last active
                </th>
                <th scope="col" className={`${TH} w-20`}>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody aria-busy={list.status === "loading"}>
              {list.status === "loading" ? (
                skeleton ? (
                  <SkeletonRows
                    cells={[
                      { cls: "", bar: "w-40" },
                      { cls: "hidden md:table-cell", bar: "w-20" },
                      { cls: "hidden lg:table-cell", bar: "w-20" },
                      { cls: "hidden lg:table-cell", bar: "w-6" },
                      { cls: "hidden md:table-cell", bar: "w-20" },
                      { cls: "", bar: "w-10" },
                    ]}
                  />
                ) : null
              ) : (
                list.items.map((u) => <UserRowView key={u.id} user={u} now={now} />)
              )}
            </tbody>
          </TableCard>
          {list.status === "loading" ? <p className="sr-only">Loading users</p> : null}
          <LoadMore
            more={list.more}
            loading={list.loadingMore}
            failed={list.moreFailed}
            onClick={list.loadMore}
          />
        </>
      )}
    </div>
  );
}

function UserRowView({ user, now }: { user: UserRow; now: Date }) {
  const s = USER_STATUS[user.status];
  return (
    <tr className={ROW}>
      <td className={TD}>
        <div className="flex items-center gap-3">
          <Avatar name={user.name} />
          <div className="flex min-w-0 flex-col">
            <Link
              href={`/users/detail?id=${encodeURIComponent(user.id)}`}
              className={`truncate rounded font-medium after:absolute after:inset-0 ${FOCUS}`}
            >
              {user.name}
            </Link>
            <span className="truncate text-[12px] text-text-tertiary leading-4">{user.email}</span>
            <span className="mt-1 md:hidden">
              <Badge tone={s.tone}>{s.label}</Badge>
            </span>
          </div>
        </div>
      </td>
      <td className={`${TD} hidden md:table-cell`}>
        <Badge tone={s.tone}>{s.label}</Badge>
      </td>
      <td className={`${TD} hidden lg:table-cell`}>{formatDate(user.joinedAt)}</td>
      <td className={`${TD} hidden lg:table-cell`}>{user.pathsCount}</td>
      <td className={`${TD} hidden md:table-cell`}>{lastActive(user.lastSignInAt, now)}</td>
      <td className={`${TD} text-right`}>
        <span aria-hidden="true">Open</span>
      </td>
    </tr>
  );
}
