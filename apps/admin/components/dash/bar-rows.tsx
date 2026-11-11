import type { ReactNode } from "react";

export type BarItem = {
  key: string;
  label: ReactNode;
  value: number;
  /** Text at the right end ("1,860 · 78%"); the number is also what a screen reader reads. */
  display: string;
  highlight?: boolean;
};

/**
 * Horizontal bars against one shared scale. The bar is decoration; the label and the printed
 * figure carry the data, so the list reads as "label, figure" rows to a screen reader.
 */
export function BarRows({
  items,
  max,
  labelWidth = 160,
  valueWidth = 96,
}: {
  items: BarItem[];
  /** Scale end; defaults to the largest value. */
  max?: number;
  labelWidth?: number;
  valueWidth?: number;
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul
      className="flex flex-col gap-2.5"
      style={
        {
          "--label-w": `${labelWidth}px`,
          "--value-w": `${valueWidth}px`,
        } as React.CSSProperties
      }
    >
      {items.map((item) => {
        const pct = item.value <= 0 ? 0 : Math.max(2, Math.min(100, (item.value / top) * 100));
        return (
          <li
            key={item.key}
            className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[var(--label-w)_1fr_var(--value-w)]"
          >
            <span className="min-w-0 truncate text-[13px] leading-5 text-text">{item.label}</span>
            <span
              className={`text-right text-[13px] leading-5 tabular-nums sm:order-3 ${
                item.highlight ? "text-warning-text" : "text-text-secondary"
              }`}
            >
              {item.display}
            </span>
            <span
              aria-hidden="true"
              className="col-span-2 h-3 overflow-hidden rounded-full bg-bg-fill2 sm:order-2 sm:col-span-1"
            >
              <span
                className={`block h-full rounded-full ${item.highlight ? "bg-warning-border" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function BarRowsSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2.5">
      {Array.from({ length: rows }, (_, i) => i).map((i) => (
        <div key={i} className="h-5 rounded-full bg-bg-fill2 motion-safe:animate-pulse" />
      ))}
    </div>
  );
}
