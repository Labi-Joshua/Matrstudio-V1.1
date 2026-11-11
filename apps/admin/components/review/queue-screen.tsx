"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  type ListFilters,
  listLinkReports,
  listProfileReports,
  listSubmissions,
} from "../../lib/review/api";
import type { Counts, QueueKey } from "../../lib/review/types";
import { FiltersMenu } from "./filters-menu";
import { useOnlineStatus, useSkeletonGate } from "./hooks";
import {
  LinkReportsTable,
  ProfileReportsTable,
  SubmissionsTable,
  TableSkeleton,
} from "./queue-tables";
import { Button, FOCUS, PageTitle, StateBlock } from "./ui";
import { type QueueState, useQueue } from "./use-queue";
import { useReviewer } from "./use-reviewer";

const TABS: { key: QueueKey; label: string; count: keyof Counts }[] = [
  { key: "submissions", label: "Submissions", count: "submissions" },
  { key: "link-reports", label: "Link reports", count: "linkReports" },
  { key: "profile-reports", label: "Profile reports", count: "profileReports" },
];

const EMPTY: Record<QueueKey, { title: string; body: string }> = {
  submissions: {
    title: "All caught up",
    body: "No submissions are waiting. New ones show up here.",
  },
  "link-reports": {
    title: "No broken links reported",
    body: "When learners report a link that doesn’t work, it shows up here.",
  },
  "profile-reports": {
    title: "No profile reports",
    body: "Reports about public profiles show up here.",
  },
};

const chip = (on: boolean) =>
  `inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap ${FOCUS} ${
    on
      ? "border-transparent bg-ink text-bg-base"
      : "border-border bg-bg-base text-text-secondary hover:bg-bg-fill1"
  }`;

const isQueueKey = (v: string | null): v is QueueKey =>
  v === "submissions" || v === "link-reports" || v === "profile-reports";

export function QueueScreen() {
  const raw = useSearchParams().get("tab");
  const tab: QueueKey = isQueueKey(raw) ? raw : "submissions";
  const [counts, setCounts] = useState<Counts | null>(null);
  const online = useOnlineStatus();
  const me = useReviewer();

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="Review queues"
        subtitle="Oldest first. Aim to clear each item within 3 days."
      />
      {online ? null : (
        <p
          role="status"
          className="rounded-xl border border-warning-border bg-warning-accent px-4 py-2.5 text-[13px] text-warning-text"
        >
          You’re offline. The queue below may be out of date; reconnect to refresh it.
        </p>
      )}
      <nav aria-label="Queues" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = t.key === tab;
          const count = counts?.[t.count];
          return (
            <Link
              key={t.key}
              href={`/review?tab=${t.key}`}
              aria-current={on ? "page" : undefined}
              className={chip(on)}
            >
              {t.label}
              {count !== undefined ? <span className="opacity-70">{count}</span> : null}
            </Link>
          );
        })}
      </nav>
      {/* Filters reset when the tab changes. */}
      <QueueBody key={tab} tab={tab} meId={me.meId} onCounts={setCounts} />
    </div>
  );
}

function QueueBody({
  tab,
  meId,
  onCounts,
}: {
  tab: QueueKey;
  meId: string | null;
  onCounts: (c: Counts) => void;
}) {
  const [assignee, setAssignee] = useState<ListFilters["assignee"]>();
  const [older, setOlder] = useState(false);
  const [menu, setMenu] = useState<Pick<ListFilters, "status" | "topic">>({});
  const filters: ListFilters = {
    assignee,
    olderThanDays: older ? 3 : undefined,
    ...menu,
  };
  const filtered = Boolean(assignee || older || menu.status || menu.topic);

  // Each hook is called for every tab to keep hook order stable; only the active tab fetches.
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={assignee === "me"}
            onClick={() => setAssignee(assignee === "me" ? undefined : "me")}
            className={chip(assignee === "me")}
          >
            Assigned to me
          </button>
          <button
            type="button"
            aria-pressed={assignee === "none"}
            onClick={() => setAssignee(assignee === "none" ? undefined : "none")}
            className={chip(assignee === "none")}
          >
            Unassigned
          </button>
          <button
            type="button"
            aria-pressed={older}
            onClick={() => setOlder(!older)}
            className={chip(older)}
          >
            Older than 3 days
          </button>
        </div>
        <FiltersMenu tab={tab} value={menu} onApply={setMenu} />
      </div>
      {tab === "submissions" ? (
        <SubmissionsList filters={filters} filtered={filtered} meId={meId} onCounts={onCounts} />
      ) : tab === "link-reports" ? (
        <LinkList filters={filters} filtered={filtered} meId={meId} onCounts={onCounts} />
      ) : (
        <ProfileList filters={filters} filtered={filtered} meId={meId} onCounts={onCounts} />
      )}
    </>
  );
}

type ListProps = {
  filters: ListFilters;
  filtered: boolean;
  meId: string | null;
  onCounts: (c: Counts) => void;
};

function SubmissionsList({ filters, filtered, meId, onCounts }: ListProps) {
  const q = useQueue("submissions", filters, listSubmissions, onCounts);
  return (
    <Frame view={q.view} tab="submissions" filtered={filtered} reload={q.reload} more={q.loadMore}>
      {(rows) => <SubmissionsTable rows={rows} meId={meId} />}
    </Frame>
  );
}
function LinkList({ filters, filtered, meId, onCounts }: ListProps) {
  const q = useQueue("link-reports", filters, listLinkReports, onCounts);
  return (
    <Frame view={q.view} tab="link-reports" filtered={filtered} reload={q.reload} more={q.loadMore}>
      {(rows) => <LinkReportsTable rows={rows} meId={meId} />}
    </Frame>
  );
}
function ProfileList({ filters, filtered, meId, onCounts }: ListProps) {
  const q = useQueue("profile-reports", filters, listProfileReports, onCounts);
  return (
    <Frame
      view={q.view}
      tab="profile-reports"
      filtered={filtered}
      reload={q.reload}
      more={q.loadMore}
    >
      {(rows) => <ProfileReportsTable rows={rows} meId={meId} />}
    </Frame>
  );
}

/** Loading skeleton, error with retry, empty, or the table plus "Load more". */
function Frame<T>({
  view,
  tab,
  filtered,
  reload,
  more,
  children,
}: {
  view: QueueState<T>;
  tab: QueueKey;
  filtered: boolean;
  reload: () => void;
  more: () => void;
  children: (rows: T[]) => React.ReactNode;
}) {
  const skeleton = useSkeletonGate(view.status === "loading");
  if (view.status === "loading") {
    return skeleton ? <TableSkeleton /> : <div className="min-h-[320px]" aria-busy="true" />;
  }
  if (view.status === "error") {
    return (
      <StateBlock
        tone="error"
        title="We couldn’t load this queue"
        body={
          view.failure.code === "forbidden"
            ? "Your role can’t open the review queues."
            : "Try again in a moment. Nothing was changed."
        }
        action={
          view.failure.code === "forbidden" ? null : <Button onClick={reload}>Try again</Button>
        }
      />
    );
  }
  if (view.items.length === 0) {
    return filtered ? (
      <StateBlock
        title="Nothing matches these filters"
        body="Clear a filter to see the rest of the queue."
      />
    ) : (
      <StateBlock title={EMPTY[tab].title} body={EMPTY[tab].body} />
    );
  }
  return (
    <>
      {children(view.items)}
      {view.hasMore ? (
        <div className="flex flex-col items-center gap-2">
          {view.moreError ? (
            <p role="alert" className="text-[13px] text-error-text">
              We couldn’t load more. Try again.
            </p>
          ) : null}
          <Button onClick={more} disabled={view.loadingMore}>
            {view.loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {view.items.length} items shown
      </p>
    </>
  );
}
