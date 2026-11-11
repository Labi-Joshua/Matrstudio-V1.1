import type { ReactNode } from "react";
import { BAR, BTN_SECONDARY, CARD } from "./ui";

export const TH =
  "bg-bg-fill1 px-4 py-3 text-left font-normal text-[14px] text-text-secondary leading-5 tracking-[-0.14px] first:rounded-tl-2xl last:rounded-tr-2xl";
export const TD =
  "border-border-soft border-t px-4 py-2.5 align-middle text-[14px] text-text leading-5 tracking-[-0.14px]";
export const ROW = "relative hover:bg-bg-fill1";

/** A bordered card holding a table; scrolls sideways rather than squashing columns. */
export function TableCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={`${CARD} overflow-x-auto`}>
      <table aria-label={label} className="w-full min-w-0 border-collapse">
        {children}
      </table>
    </div>
  );
}

/** Skeleton rows in the shape of a table row: `widths` are the bar widths per visible cell. */
export function SkeletonRows({
  rows = 6,
  cells,
}: {
  rows?: number;
  cells: { cls: string; bar: string }[];
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => `r${i}`).map((key) => (
        <tr key={key}>
          {cells.map((c) => (
            <td key={`${key}-${c.cls}-${c.bar}`} className={`${TD} ${c.cls}`}>
              <div aria-hidden="true" className={`${BAR} h-4 ${c.bar}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** "Show more" under a list, with its own failure line. */
export function LoadMore({
  more,
  loading,
  failed,
  onClick,
}: {
  more: boolean;
  loading: boolean;
  failed: boolean;
  onClick: () => void;
}) {
  if (!more) return null;
  return (
    <div className="flex flex-col items-center gap-2 pt-4">
      {failed ? (
        <p role="alert" className="text-[14px] text-error-text">
          We couldn’t load more. Try again.
        </p>
      ) : null}
      <button type="button" onClick={onClick} disabled={loading} className={BTN_SECONDARY}>
        {loading ? "Loading…" : "Show more"}
      </button>
    </div>
  );
}
