"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { listPaths } from "../../lib/content/api";
import { plural, relativeDay } from "../../lib/content/format";
import { LEVEL_OPTIONS, labelOf } from "../../lib/content/options";
import type { PathRow, PathStatus } from "../../lib/content/types";
import { useLoad, useSkeletonGate } from "./hooks";
import { NewPathModal } from "./new-path-modal";
import {
  Badge,
  Button,
  CheckIcon,
  ChipTabs,
  FOCUS,
  PageFrame,
  PageHeader,
  PlusIcon,
  Skeleton,
  StateMessage,
  textActionClass,
} from "./ui";

type Tab = "all" | PathStatus;

export function PathStatusBadge({ status }: { status: PathStatus }) {
  return (
    <Badge tone={status === "live" ? "success" : status === "unpublished" ? "warning" : "neutral"}>
      {status === "live" ? <CheckIcon className="size-3" /> : null}
      {status === "live" ? "Live" : status === "draft" ? "Draft" : "Unpublished"}
    </Badge>
  );
}

export function PathsList() {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [creating, setCreating] = useState(params.get("new") === "1");
  const { load, reload } = useLoad(`paths-${tab}`, (signal) => listPaths(tab, signal));
  const showSkeleton = useSkeletonGate(load.state === "loading");
  const [lastCounts, setLastCounts] = useState<{
    all: number;
    live: number;
    draft: number;
    unpublished: number;
  } | null>(null);
  const [lastLearners, setLastLearners] = useState(0);

  if (load.state === "ready" && load.data.counts !== lastCounts) {
    setLastCounts(load.data.counts);
    setLastLearners(load.data.learnersEnrolled);
  }
  const counts = lastCounts;

  const subtitle = counts
    ? `${plural(counts.all, "path")} · ${counts.live} live · ${lastLearners.toLocaleString("en")} learners enrolled`
    : "Journeys learners follow, lesson by lesson.";

  return (
    <PageFrame>
      <PageHeader
        title="Paths"
        subtitle={subtitle}
        actions={
          <Button kind="primary" onClick={() => setCreating(true)}>
            <PlusIcon />
            New path
          </Button>
        }
      />
      <div className="mt-6">
        <ChipTabs
          label="Path status"
          value={tab}
          onChange={setTab}
          items={[
            { value: "all", label: "All", count: counts?.all ?? null },
            { value: "live", label: "Live", count: counts?.live ?? null },
            { value: "draft", label: "Draft", count: counts?.draft ?? null },
            { value: "unpublished", label: "Unpublished", count: counts?.unpublished ?? null },
          ]}
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border-soft">
        {load.state === "loading" ? (
          showSkeleton ? (
            <div role="status" aria-label="Loading paths" className="divide-y divide-border-soft">
              {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
                <div key={i} className="flex items-center gap-6 px-4 py-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/5" />
                  </div>
                  <Skeleton className="hidden h-4 w-20 md:block" />
                  <Skeleton className="h-5 w-14" />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64" />
          )
        ) : load.state === "error" ? (
          <StateMessage
            tone="error"
            title="We couldn’t load paths"
            body="Try again in a moment. Nothing was changed."
            action={<Button onClick={reload}>Try again</Button>}
          />
        ) : load.data.items.length === 0 ? (
          <StateMessage
            title={tab === "all" ? "No paths yet" : `No ${tab} paths`}
            body={
              tab === "all"
                ? "Start a path, then add modules and lessons from the library."
                : "Paths in this state show up here."
            }
            action={
              tab === "all" ? (
                <Button kind="primary" onClick={() => setCreating(true)}>
                  <PlusIcon />
                  New path
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <PathTable items={load.data.items} />
            <PathCards items={load.data.items} />
          </>
        )}
      </div>

      {creating ? (
        <NewPathModal
          onClose={() => {
            setCreating(false);
            if (params.get("new")) router.replace("/paths");
          }}
        />
      ) : null}
    </PageFrame>
  );
}

const href = (p: PathRow) => `/paths/edit?id=${encodeURIComponent(p.id)}`;
const dash = (v: string | number | null) => (v === null ? "—" : v);

function Title({ row }: { row: PathRow }) {
  return (
    <div className="min-w-0">
      <Link
        href={href(row)}
        className={`block truncate rounded-sm font-medium text-[14px] leading-5 hover:underline ${FOCUS}`}
      >
        {row.title}
      </Link>
      <p className="truncate text-[12px] text-text-tertiary leading-4">
        {plural(row.modules, "module")} · {plural(row.lessons, "lesson")}
      </p>
    </div>
  );
}

function PathTable({ items }: { items: PathRow[] }) {
  return (
    <table className="hidden w-full table-fixed text-left text-[14px] md:table">
      <caption className="sr-only">Paths</caption>
      <thead className="bg-bg-fill1 text-text-secondary">
        <tr>
          <th scope="col" className="w-[36%] px-4 py-3 font-normal">
            Path
          </th>
          <th scope="col" className="w-[13%] py-3 font-normal">
            Level
          </th>
          <th scope="col" className="w-[11%] py-3 font-normal">
            Learners
          </th>
          <th scope="col" className="w-[11%] py-3 font-normal">
            Completion
          </th>
          <th scope="col" className="w-[12%] py-3 font-normal">
            Updated
          </th>
          <th scope="col" className="w-[10%] py-3 font-normal">
            Status
          </th>
          <th scope="col" className="w-[7%] py-3 pr-4 font-normal">
            <span className="sr-only">Action</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border-soft">
        {items.map((row) => (
          <tr key={row.id} className="hover:bg-bg-fill1">
            <td className="px-4 py-3">
              <Title row={row} />
            </td>
            <td className="py-3">{labelOf(LEVEL_OPTIONS, row.level)}</td>
            <td className="py-3">
              {row.learners === null ? "—" : row.learners.toLocaleString("en")}
            </td>
            <td className="py-3">{row.completionRate === null ? "—" : `${row.completionRate}%`}</td>
            <td className="py-3">{relativeDay(row.updatedAt)}</td>
            <td className="py-3">
              <PathStatusBadge status={row.status} />
            </td>
            <td className="py-3 pr-4">
              <Link href={href(row)} aria-label={`Open ${row.title}`} className={textActionClass}>
                Open
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PathCards({ items }: { items: PathRow[] }) {
  return (
    <ul className="divide-y divide-border-soft md:hidden">
      {items.map((row) => (
        <li key={row.id} className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <Title row={row} />
            <PathStatusBadge status={row.status} />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-text-secondary">
            <span>{labelOf(LEVEL_OPTIONS, row.level)}</span>
            <span>{dash(row.learners)} learners</span>
            <span>Updated {relativeDay(row.updatedAt)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
