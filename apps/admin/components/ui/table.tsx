import type { ComponentProps, ReactNode } from "react";
import { Skeleton } from "./skeleton";

/**
 * Table shell shared by the list screens: a bordered card, sticky-less header row of 12px
 * uppercase labels, hairline rows, horizontal scroll on narrow screens. Builders fill it with
 * their own columns: `<TableShell caption="Members"><thead>...` or use the helpers below.
 */
export function TableShell({
  caption,
  children,
  footer,
}: {
  /** Accessible name of the table (visually hidden). */
  caption: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-soft bg-bg-base">
      <div className="no-scrollbar overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-[14px] leading-5 tracking-[-0.14px]">
          <caption className="sr-only">{caption}</caption>
          {children}
        </table>
      </div>
      {footer ? <div className="border-border-soft border-t px-4 py-3">{footer}</div> : null}
    </div>
  );
}

export function Th({ className = "", ...rest }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      {...rest}
      className={`whitespace-nowrap border-border-soft border-b bg-bg-fill1 px-4 py-2.5 font-medium text-[12px] text-text-tertiary uppercase leading-4 tracking-[0.6px] ${className}`}
    />
  );
}

export function Td({ className = "", ...rest }: ComponentProps<"td">) {
  return (
    <td
      {...rest}
      className={`border-border-soft border-b px-4 py-3 align-middle text-text group-last:border-b-0 ${className}`}
    />
  );
}

/** Loading rows: `columns` cells per row, pulsing. Put inside <tbody>. */
export function TableSkeletonRows({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
        <tr key={r} className="group">
          {Array.from({ length: columns }, (_, c) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder cells
            <Td key={c}>
              <Skeleton className="h-4 w-full max-w-40" />
            </Td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Empty or error state inside the table card (title, line, optional action such as Retry). */
export function TableMessage({
  title,
  children,
  action,
  tone = "empty",
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: "empty" | "error";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className="flex flex-col items-center gap-1 px-6 py-14 text-center"
    >
      <p className="font-medium text-[16px] text-text leading-6 tracking-[-0.16px]">{title}</p>
      {children ? (
        <p className="max-w-sm text-[14px] text-text-secondary leading-5">{children}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
