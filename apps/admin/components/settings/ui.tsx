"use client";

import type { ReactNode, SVGProps } from "react";

/** Small building blocks of the Settings screens: icons, buttons, form controls. */

export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };
function Icon({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 4.5v11M4.5 10h11" />
  </Icon>
);
export const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 5 10 10M15 5 5 15" />
  </Icon>
);
export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7" y="7" width="9" height="9" rx="2" />
    <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
  </Icon>
);
export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6h12M8 6V4h4v2M6 6l.7 9.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L14 6M8.5 9v4M11.5 9v4" />
  </Icon>
);
export const MailIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
    <path d="m3 6 7 5 7-5" />
  </Icon>
);
export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="7" r="3" />
    <path d="M2.5 16.5c.4-2.6 2.6-4 5.5-4s5.1 1.4 5.5 4M13.5 4.3a3 3 0 0 1 0 5.4M15 12.7c1.5.5 2.3 1.7 2.5 3.8" />
  </Icon>
);
export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 5.5V10l3 2" />
  </Icon>
);
export const GripIcon = (p: IconProps) => (
  <Icon {...p} strokeWidth="2.4">
    <path d="M7.5 5h.01M12.5 5h.01M7.5 10h.01M12.5 10h.01M7.5 15h.01M12.5 15h.01" />
  </Icon>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 7.5 5 5 5-5" />
  </Icon>
);
export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="m6.8 10.2 2.2 2.2 4.2-4.6" />
  </Icon>
);
export const AlertCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 6.5v4M10 13.4h.01" />
  </Icon>
);
export function SpinnerIcon({ size = 16, className = "", ...rest }: IconProps) {
  return (
    <Icon size={size} className={`animate-spin motion-reduce:animate-none ${className}`} {...rest}>
      <circle cx="10" cy="10" r="7.5" opacity="0.25" />
      <path d="M17.5 10A7.5 7.5 0 0 0 10 2.5" />
    </Icon>
  );
}

const BTN =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium text-[14px] leading-5 tracking-[-0.14px] transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60";
export const BTN_PRIMARY = `${BTN} h-10 bg-ink px-4 text-bg-base hover:opacity-90 ${FOCUS}`;
export const BTN_SECONDARY = `${BTN} h-10 border border-border bg-bg-base px-4 text-text shadow-e1 hover:bg-bg-fill1 ${FOCUS}`;
export const BTN_DANGER = `${BTN} h-10 bg-error-text px-4 text-static-white hover:opacity-90 ${FOCUS}`;
export const LINK = `rounded-sm font-medium text-[13px] leading-5 hover:underline ${FOCUS}`;
export const LINK_ORANGE = `${LINK} text-primary-text`;
export const LINK_RED = `${LINK} text-error-text`;
export const LINK_MUTED = `${LINK} text-text-secondary`;

/**
 * A button that stays focusable while busy or invalid (aria-disabled), so a screen reader user is
 * never left on a control that vanished. Clicks are ignored while disabled.
 */
export function Button({
  variant = "primary",
  disabled,
  busy,
  onClick,
  children,
  type = "button",
  className = "",
}: {
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
  children: ReactNode;
  type?: "button" | "submit";
  className?: string;
}) {
  const cls =
    variant === "primary" ? BTN_PRIMARY : variant === "danger" ? BTN_DANGER : BTN_SECONDARY;
  const off = disabled || busy;
  return (
    <button
      type={type}
      aria-disabled={off || undefined}
      onClick={(event) => {
        if (off) {
          event.preventDefault();
          return;
        }
        onClick?.();
      }}
      className={`${cls} ${className}`}
    >
      {busy ? <SpinnerIcon /> : null}
      {children}
    </button>
  );
}

const FIELD =
  "w-full rounded-lg border border-border bg-bg-base px-3 text-[14px] text-text leading-5 tracking-[-0.14px] placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-border";
export const INPUT = `${FIELD} h-10`;
export const TEXTAREA = `${FIELD} min-h-[104px] resize-y py-2.5`;

export const LABEL = "font-medium text-[13px] text-text leading-5 tracking-[-0.13px]";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-err`} className="text-[13px] text-error-text leading-5">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-text-tertiary leading-5">{hint}</p>
      ) : null}
    </div>
  );
}

export type Option = { value: string; label: string };

/** A native select (keyboard and screen reader behaviour for free) with the design's chevron. */
export function Select({
  id,
  value,
  onChange,
  options,
  disabled,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly Option[];
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={`${INPUT} cursor-pointer appearance-none pr-9`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        size={16}
        className="pointer-events-none absolute top-3 right-3 text-text-secondary"
      />
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex items-center gap-2 text-[14px] text-text leading-5 tracking-[-0.14px] ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="size-4 shrink-0 cursor-[inherit] rounded accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border"
      />
      {children}
    </label>
  );
}

/** The on/off switch: a real button with role="switch". */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${FOCUS} ${checked ? "bg-primary" : "bg-bg-fill4"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-static-white shadow-e1 transition-transform motion-reduce:transition-none ${checked ? "translate-x-4" : ""}`}
      />
    </button>
  );
}

/** A filter-chip style toggle (working days). */
export function DayChip({
  on,
  onClick,
  disabled,
  children,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
      className={`h-8 rounded-full border px-3 text-[13px] leading-5 transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${FOCUS} ${on ? "border-ink bg-ink text-bg-base" : "border-border-soft bg-bg-base text-text-secondary hover:bg-bg-fill1"}`}
    >
      {children}
    </button>
  );
}

/** A grey info strip with an icon (the notes at the foot of a tab). */
export function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-bg-fill1 px-4 py-3 text-[13px] text-text-secondary leading-5">
      <span aria-hidden="true" className="mt-px shrink-0">
        {icon}
      </span>
      <p>{children}</p>
    </div>
  );
}

export const CARD = "rounded-2xl border border-border-soft bg-bg-base";
export const PANEL = "rounded-2xl bg-bg-fill1";
