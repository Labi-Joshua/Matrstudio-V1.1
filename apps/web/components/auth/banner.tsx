import type { ReactNode } from "react";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon, XIcon } from "./icons";

/**
 * Banner / toast of the auth screens (Figma Toast: 20px icon, title, description, optional action
 * and a close button, on the elevation surface). The same component is used inline or inside a
 * ToastRegion. It carries no live-region role itself: put it inside a StatusRegion or ToastRegion
 * (which exist before the message appears, so screen readers announce it).
 */
export type BannerTone = "error" | "warning" | "info" | "success";

const TONES: Record<BannerTone, { icon: ReactNode; color: string }> = {
  error: { icon: <CircleAlertIcon />, color: "text-error-text" },
  warning: { icon: <TriangleAlertIcon />, color: "text-warning-text" },
  info: { icon: <InfoIcon />, color: "text-primary-text" },
  success: { icon: <CircleCheckIcon />, color: "text-success-text" },
};

export function Banner({
  tone,
  title,
  children,
  action,
  onDismiss,
}: {
  tone: BannerTone;
  title: string;
  children?: ReactNode;
  /** A compact button or link on the right ("Resend email", "Reset password"). */
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  const { icon, color } = TONES[tone];
  return (
    <div className="flex items-start gap-2 rounded-[10px] border border-border bg-bg-elevation-1 py-3 pr-4 pl-3 shadow-e2">
      <span className={`shrink-0 ${color}`}>{icon}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1 basis-48 text-[14px] leading-5 tracking-[-0.14px]">
          <p className="font-medium text-text">{title}</p>
          {children ? <p className="text-text-secondary">{children}</p> : null}
        </div>
        {action}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-2 flex size-6 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-bg-fill2 hover:text-text focus-visible:outline-2 focus-visible:outline-primary-border"
        >
          <XIcon size={16} />
        </button>
      ) : null}
    </div>
  );
}

/** Compact secondary button used as a Banner action (Figma Button-Compact). */
export const bannerActionClasses =
  "inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-bg-elevation-1 px-2 font-medium text-[13px] text-text leading-[18px] tracking-[-0.13px] shadow-e1 hover:bg-bg-fill1 focus-visible:outline-2 focus-visible:outline-primary-border disabled:cursor-not-allowed disabled:opacity-60";

/**
 * A live region for form status: always rendered, content changes are announced by screen readers
 * (polite by default; "assertive" for errors that block the form). Renders nothing visible when empty.
 */
export function StatusRegion({
  children,
  politeness = "polite",
  className,
}: {
  children?: ReactNode;
  politeness?: "polite" | "assertive";
  className?: string;
}) {
  return (
    <div
      role={politeness === "assertive" ? "alert" : "status"}
      aria-live={politeness}
      aria-atomic="true"
      className={className}
    >
      {children}
    </div>
  );
}

/**
 * Where toasts appear: pinned to the top of the screen, centred over the form column on desktop
 * (Figma places the toast at the top of the page), full width with a 16px gutter on phones.
 */
export function ToastRegion({
  children,
  politeness = "polite",
}: {
  children?: ReactNode;
  politeness?: "polite" | "assertive";
}) {
  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-50 flex justify-center lg:inset-x-auto lg:top-6 lg:left-1/4 lg:w-[440px] lg:-translate-x-1/2">
      <StatusRegion politeness={politeness} className="pointer-events-auto w-full">
        {children}
      </StatusRegion>
    </div>
  );
}
