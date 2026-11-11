import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { initialsOf } from "../../lib/review/format";
import { AlertIcon, CheckIcon, CrossIcon, InboxIcon } from "./icons";

export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border";

type Variant = "primary" | "secondary" | "danger-outline" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-bg-base hover:opacity-90 border border-transparent",
  secondary: "bg-bg-base text-text border border-border hover:bg-bg-fill1",
  "danger-outline": "bg-bg-base text-error-text border border-error-border hover:bg-error-accent",
  danger: "bg-[#e5312f] text-static-white border border-transparent hover:bg-[#c92a28]",
};
const BUTTON_BASE =
  "inline-flex h-[34px] items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-medium leading-5 tracking-[-0.13px] whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50";

export function Button({
  variant = "secondary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`${BUTTON_BASE} ${VARIANTS[variant]} ${FOCUS} ${className}`}
    />
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  children,
}: {
  href: string;
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${BUTTON_BASE} ${VARIANTS[variant]} ${FOCUS}`}>
      {children}
    </Link>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-[13px] font-medium text-primary-text hover:underline ${FOCUS}`}
    >
      {children}
    </a>
  );
}

type Tone = "neutral" | "success" | "warning" | "error" | "primary";
const TONES: Record<Tone, string> = {
  neutral: "bg-bg-fill2 text-text-secondary",
  success: "bg-success-focus text-success-text",
  warning: "bg-warning-focus text-warning-text",
  error: "bg-error-focus text-error-text",
  primary: "bg-primary-focus text-primary-text",
};

export function Badge({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: Tone;
  icon?: "check" | "alert";
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[12px] font-medium leading-4 ${TONES[tone]}`}
    >
      {icon === "check" ? <CheckIcon /> : icon === "alert" ? <AlertIcon /> : null}
      {children}
    </span>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border-soft bg-bg-base p-5 ${className}`}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-medium text-[14px] text-text leading-5">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-text sm:min-w-[45%] sm:text-left">
        {children}
      </dd>
    </div>
  );
}

export function Avatar({
  name,
  url,
  size = 28,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-fill2 font-semibold text-[11px] text-text-secondary"
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : initialsOf(name)}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-bg-fill2 motion-reduce:animate-none ${className}`}
    />
  );
}

export function CheckLine({
  status,
  children,
}: {
  status: "pass" | "warn" | "fail";
  children: ReactNode;
}) {
  const tone =
    status === "pass"
      ? "text-success-text"
      : status === "warn"
        ? "text-warning-text"
        : "text-error-text";
  return (
    <li className={`flex items-center gap-2 text-[13px] ${tone}`}>
      <span className="sr-only">
        {status === "pass" ? "Passed:" : status === "warn" ? "Warning:" : "Failed:"}
      </span>
      {status === "pass" ? <CheckIcon /> : status === "warn" ? <AlertIcon /> : <CrossIcon />}
      {children}
    </li>
  );
}

/** Empty and error blocks (Figma "All caught up" and the load error). */
export function StateBlock({
  title,
  body,
  action,
  tone = "empty",
  heading = false,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  tone?: "empty" | "error";
  heading?: boolean;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="flex flex-col items-center gap-2 rounded-2xl border border-border-soft px-6 py-16 text-center"
    >
      <span
        className={`mb-2 flex size-11 items-center justify-center rounded-full ${tone === "error" ? "bg-error-focus text-error-text" : "bg-bg-fill2 text-text-secondary"}`}
      >
        {tone === "error" ? <AlertIcon /> : <InboxIcon />}
      </span>
      {heading ? (
        <h1 className="font-medium text-[16px] text-text">{title}</h1>
      ) : (
        <p className="font-medium text-[16px] text-text">{title}</p>
      )}
      <p className="max-w-[360px] text-[13px] text-text-secondary">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-medium text-[24px] text-text leading-8 tracking-[-0.48px]">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle ? <p className="mt-1 text-[13px] text-text-secondary">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
