import { computeDelta, formatStatValue } from "../../lib/dash/format";
import type { Stat } from "../../lib/dash/types";
import { Bar } from "./ui";

const TONE = {
  good: "bg-success-focus text-success-text",
  bad: "bg-error-focus text-error-text",
  neutral: "bg-bg-fill2 text-text-secondary",
} as const;

export function StatCard({
  stat,
  note,
  empty = false,
}: {
  stat: Stat;
  /** Line under the figure ("vs previous 7 days"); metrics tiles leave it out. */
  note?: string;
  /** First-time dashboard: show an em dash instead of a figure. */
  empty?: boolean;
}) {
  const delta = empty ? undefined : computeDelta(stat);
  return (
    <div className="min-w-0 rounded-2xl border border-border-alpha bg-bg-base p-5">
      <p className="truncate text-[13px] leading-5 text-text-secondary">{stat.label}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[28px] font-medium leading-9 tracking-[-0.56px] text-text tabular-nums">
          {empty ? "—" : formatStatValue(stat)}
        </span>
        {delta ? (
          <span
            className={`rounded-md px-1.5 py-0.5 text-[12px] leading-4 tabular-nums ${TONE[delta.tone]}`}
          >
            <span aria-hidden="true">{delta.text}</span>
            <span className="sr-only">{delta.spoken}</span>
          </span>
        ) : null}
      </p>
      {note ? (
        <p className="mt-2 text-[12px] leading-4 text-text-tertiary">
          {delta || empty ? note : "No earlier data to compare"}
        </p>
      ) : null}
    </div>
  );
}

export function StatGrid({
  stats,
  note,
  empty,
}: {
  stats: Stat[];
  note?: string;
  empty?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4">
      {stats.map((s) => (
        <StatCard key={s.key} stat={s} note={note} empty={empty} />
      ))}
    </div>
  );
}

export function StatGridSkeleton({ withNote = false }: { withNote?: boolean }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4"
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-border-alpha p-5">
          <Bar className="h-4 w-24" />
          <Bar className="mt-3 h-8 w-28" />
          {withNote ? <Bar className="mt-3 h-3 w-32" /> : null}
        </div>
      ))}
    </div>
  );
}
