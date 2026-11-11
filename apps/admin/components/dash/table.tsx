import type { ReactNode } from "react";
import { Bar } from "./ui";

export const TH =
  "px-3 py-3 md:px-4 text-left text-[13px] font-normal leading-5 text-text-secondary";
export const TD = "px-3 py-3 md:px-4 text-[14px] leading-5 text-text tabular-nums";

/** Bordered table that scrolls sideways on narrow screens instead of squeezing its columns. */
export function TableShell({
  caption,
  minWidth = 640,
  head,
  children,
}: {
  caption: string;
  minWidth?: number;
  head: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-x-auto rounded-2xl border border-border-alpha">
      <table className="w-full border-collapse" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-bg-fill1">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-border-soft-alpha">{children}</tbody>
      </table>
    </div>
  );
}

const seq = (n: number) => Array.from({ length: n }, (_, i) => i);

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div aria-hidden="true" className="rounded-2xl border border-border-alpha">
      <div className="h-11 rounded-t-2xl bg-bg-fill1" />
      {seq(rows).map((r) => (
        <div
          key={r}
          className="flex items-center gap-6 border-t border-border-soft-alpha px-4 py-4"
        >
          {seq(cols).map((c) => (
            <Bar key={c} className={`h-4 ${c === 0 ? "w-48 flex-1" : "w-16"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
