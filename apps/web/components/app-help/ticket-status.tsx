import type { ReactNode } from "react";
import { STATUS_LOOK, type StatusTone } from "../../lib/app/help-requests";
import type { TicketStatus } from "../../lib/auth/support-api";

const TONE: Record<StatusTone, { chip: string; box: string; icon: string }> = {
  info: {
    chip: "bg-info-focus text-text",
    box: "bg-info-focus",
    icon: "text-primary-text",
  },
  warning: {
    chip: "bg-warning-focus text-warning-text",
    box: "bg-warning-focus",
    icon: "text-warning-text",
  },
  success: {
    chip: "bg-success-focus text-success-text",
    box: "bg-success-focus",
    icon: "text-success-text",
  },
  neutral: {
    chip: "bg-bg-fill2 text-text-secondary",
    box: "bg-bg-fill1",
    icon: "text-text-secondary",
  },
};

/** The status chip of the Figma lists and request page: a dot and the word, never colour alone. */
export function StatusChip({ status }: { status: TicketStatus }) {
  const { label, tone } = STATUS_LOOK[status];
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 font-medium text-[12px] leading-4 tracking-[-0.12px] ${TONE[tone].chip}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/** Tinted panel under a conversation (Figma "Request resolved" and the outcome notes). */
export function Callout({
  tone,
  icon,
  title,
  children,
}: {
  tone: StatusTone;
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={`flex items-start gap-2.5 rounded-lg px-3 py-3 ${TONE[tone].box}`}>
      <span aria-hidden="true" className={`mt-0.5 shrink-0 ${TONE[tone].icon}`}>
        {icon}
      </span>
      <div className="min-w-0 text-[14px] leading-5 tracking-[-0.14px]">
        <p className="font-medium text-text">{title}</p>
        {children ? <div className="text-text-secondary">{children}</div> : null}
      </div>
    </div>
  );
}
