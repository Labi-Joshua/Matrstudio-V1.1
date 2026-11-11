"use client";

import Link from "next/link";
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
  useState,
} from "react";

/** Small building blocks for the Resources and Paths screens (Figma pages 635:4 and 635:5). */

export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border";

type IconProps = { className?: string };
const svg = (path: ReactNode, className = "size-4") => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`shrink-0 ${className}`}
  >
    {path}
  </svg>
);
export const PlusIcon = ({ className }: IconProps) => svg(<path d="M12 5v14M5 12h14" />, className);
export const ArrowLeftIcon = ({ className }: IconProps) =>
  svg(<path d="M19 12H5M11 6l-6 6 6 6" />, className);
export const CheckIcon = ({ className }: IconProps) =>
  svg(<path d="M5 12.5l4.5 4.5L19 7" />, className);
export const FiltersIcon = ({ className }: IconProps) =>
  svg(<path d="M4 7h16M7 12h10M10 17h4" />, className);
export const TrashIcon = ({ className }: IconProps) =>
  svg(<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" />, className);
export const LinkIcon = ({ className }: IconProps) =>
  svg(
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
    className,
  );
export const LibraryIcon = ({ className }: IconProps) =>
  svg(<path d="M5 4v16M10 4v16M15 5l4 15" />, className);
export const PathIcon = ({ className }: IconProps) =>
  svg(
    <path d="M6 5a2 2 0 1 0 0 .01M18 12a2 2 0 1 0 0 .01M6 19a2 2 0 1 0 0 .01M8 5h5a3 3 0 0 1 0 6H8M16 12h-5a3 3 0 0 0 0 6h-1" />,
    className,
  );
export const MailIcon = ({ className }: IconProps) =>
  svg(<path d="M4 6h16v12H4zM4 7l8 6 8-6" />, className);
export const ChevronUpIcon = ({ className }: IconProps) =>
  svg(<path d="M6 15l6-6 6 6" />, className);
export const ChevronDownIcon = ({ className }: IconProps) =>
  svg(<path d="M6 9l6 6 6-6" />, className);
export const GripIcon = ({ className }: IconProps) =>
  svg(
    <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" strokeWidth="3" />,
    className,
  );
export const SearchIcon = ({ className }: IconProps) =>
  svg(<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />, className);
export const XIcon = ({ className }: IconProps) =>
  svg(<path d="M6 6l12 12M18 6L6 18" />, className);
export const AlertIcon = ({ className }: IconProps) =>
  svg(<path d="M12 4l9 16H3zM12 10v4M12 17h.01" />, className);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: "primary" | "secondary" | "danger" | "dangerOutline" | "link";
  busy?: boolean;
};

const BUTTON_BASE =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 font-medium text-[14px] leading-5 tracking-[-0.14px] disabled:cursor-not-allowed disabled:opacity-50";
const BUTTON_KIND: Record<NonNullable<ButtonProps["kind"]>, string> = {
  primary: "bg-ink text-bg-base hover:opacity-90",
  secondary: "border border-border bg-bg-base text-text hover:bg-bg-fill1",
  danger: "bg-error-border text-static-white hover:opacity-90",
  dangerOutline: "border border-error-border bg-bg-base text-error-text hover:bg-error-accent",
  link: "h-auto px-0 text-primary-text hover:underline",
};

export function buttonClass(kind: NonNullable<ButtonProps["kind"]> = "secondary", extra = "") {
  return `${BUTTON_BASE} ${BUTTON_KIND[kind]} ${FOCUS} ${extra}`;
}

export function Button({
  kind = "secondary",
  busy,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      aria-busy={busy || undefined}
      className={buttonClass(kind, className)}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  kind = "secondary",
  children,
  className = "",
}: {
  href: string;
  kind?: ButtonProps["kind"];
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClass(kind, className)}>
      {children}
    </Link>
  );
}

/** Quiet text action used in table rows and cards ("Open", "Edit intro"). */
export const textActionClass = `rounded-md text-[14px] leading-5 text-text hover:underline ${FOCUS}`;

const BADGE_TONE = {
  success: "bg-success-focus text-success-text",
  error: "bg-error-focus text-error-text",
  warning: "bg-warning-focus text-warning-text",
  neutral: "bg-bg-fill2 text-text-secondary",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof BADGE_TONE;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-md px-1.5 font-medium text-[12px] leading-4 ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

const INPUT =
  "w-full rounded-lg border border-border bg-bg-base px-3 text-[14px] leading-5 tracking-[-0.14px] text-text placeholder:text-text-tertiary disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="font-medium text-[14px] leading-5 tracking-[-0.14px]">
        {label}
      </label>
      {children({ id, describedBy: note ? noteId : undefined, invalid: Boolean(error) })}
      {note ? (
        <p
          id={noteId}
          role={error ? "alert" : undefined}
          className={`text-[12px] leading-4 ${error ? "text-error-text" : "text-text-tertiary"}`}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}

const ctlState = (invalid: boolean) => (invalid ? "border-error-border" : "");

export function TextInput({
  invalid = false,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={`h-10 ${INPUT} ${ctlState(invalid)} ${FOCUS} ${className}`}
    />
  );
}

export function TextArea({
  invalid = false,
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid || undefined}
      className={`min-h-24 resize-y py-2.5 ${INPUT} ${ctlState(invalid)} ${FOCUS} ${className}`}
    />
  );
}

export function Select({
  invalid = false,
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className={`relative ${className}`}>
      <select
        {...rest}
        aria-invalid={invalid || undefined}
        className={`h-10 appearance-none pr-9 ${INPUT} ${ctlState(invalid)} ${FOCUS}`}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-3 right-3 size-4 text-text-tertiary" />
    </div>
  );
}

/** Square checkbox drawn over the native input (kept for keyboard and screen readers). */
export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  disabled,
  className = "",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  hint?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 text-[14px] leading-5 tracking-[-0.14px] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${className}`}
    >
      <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className={`peer absolute inset-0 size-5 cursor-pointer appearance-none rounded-md border border-border bg-bg-base checked:border-primary-border checked:bg-primary-border ${FOCUS}`}
        />
        <CheckIcon className="pointer-events-none relative size-3.5 text-static-white opacity-0 peer-checked:opacity-100" />
      </span>
      <span className="min-w-0">
        {label}
        {hint ? <span className="block text-[13px] text-text-tertiary">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Radio({
  name,
  checked,
  onChange,
  label,
  hint,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-start gap-2.5 text-[14px] leading-5 tracking-[-0.14px]">
        <input
          type="radio"
          name={name}
          checked={checked}
          onChange={onChange}
          className={`mt-0.5 size-5 shrink-0 cursor-pointer appearance-none rounded-full border border-border bg-bg-base checked:border-[6px] checked:border-primary-border ${FOCUS}`}
        />
        <span className="min-w-0">
          <span className="block font-medium">{label}</span>
          {hint ? <span className="block text-[13px] text-text-tertiary">{hint}</span> : null}
        </span>
      </label>
      {children ? <div className="pl-[30px]">{children}</div> : null}
    </div>
  );
}

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
    <label className="flex cursor-pointer items-center gap-2.5 text-[14px] leading-5 tracking-[-0.14px] has-[:disabled]:opacity-60">
      <span className="relative inline-flex h-5 w-9 shrink-0">
        <input
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className={`peer absolute inset-0 size-full cursor-pointer appearance-none rounded-full bg-bg-fill4 checked:bg-primary-border ${FOCUS}`}
        />
        <span className="pointer-events-none absolute top-0.5 left-0.5 size-4 rounded-full bg-static-white transition-transform motion-reduce:transition-none peer-checked:translate-x-4" />
      </span>
      {label}
    </label>
  );
}

/** Filter chip used as a tab: filled when selected (Figma "Filter Chip"). */
export function ChipTabs<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  items: { value: T; label: string; count?: number | null }[];
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: chips, not a form group
    <div role="group" aria-label={label} className="flex min-w-0 flex-wrap gap-2">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={`h-8 rounded-full border px-3 text-[13px] leading-5 ${FOCUS} ${
              active
                ? "border-ink bg-ink font-medium text-bg-base"
                : "border-border bg-bg-base text-text hover:bg-bg-fill1"
            }`}
          >
            {item.label}
            {item.count === undefined || item.count === null ? null : (
              <span className="ml-1 tabular-nums opacity-70">
                {item.count.toLocaleString("en")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border-soft bg-bg-fill1 p-5 ${className}`}>
      {title ? <h2 className="mb-4 font-medium text-[14px] leading-5">{title}</h2> : null}
      {children}
    </section>
  );
}

/** Page container: fills to 1920px then centres. Remove when the shell owns the padding. */
export function PageFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1920px] px-4 py-6 md:px-8 md:py-8">{children}</div>;
}

export function PageHeader({
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
          <h1 className="font-medium text-[24px] leading-8 tracking-[-0.48px]">{title}</h1>
          {badge}
        </div>
        {subtitle ? (
          <p className="mt-1 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-md text-[14px] leading-5 text-text-secondary hover:text-text ${FOCUS}`}
    >
      <ArrowLeftIcon />
      {children}
    </Link>
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

export function StateMessage({
  title,
  body,
  action,
  tone = "neutral",
}: {
  title: string;
  body: string;
  action?: ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="flex flex-col items-center gap-2 px-6 py-16 text-center"
    >
      <p className="font-medium text-[16px] leading-6">{title}</p>
      <p className="max-w-sm text-[14px] text-text-secondary leading-5">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Banner({
  tone = "warning",
  children,
  action,
}: {
  tone?: "warning" | "error" | "info";
  children: ReactNode;
  action?: ReactNode;
}) {
  const color =
    tone === "error"
      ? "bg-error-focus text-error-text"
      : tone === "info"
        ? "bg-bg-fill2 text-text"
        : "bg-warning-focus text-warning-text";
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={`flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-[14px] leading-5 ${color}`}
    >
      <AlertIcon className="size-4" />
      <p className="min-w-0 flex-1">{children}</p>
      {action}
    </div>
  );
}

export function CheckLine({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p
      className={`flex items-center gap-2 text-[13px] leading-5 ${ok ? "text-success-text" : "text-error-text"}`}
    >
      {ok ? <CheckIcon className="size-3.5" /> : <XIcon className="size-3.5" />}
      {children}
    </p>
  );
}

export const TYPE_LABEL: Record<string, string> = {
  video: "Video",
  article: "Article",
  tool: "Tool",
  course: "Course",
  template: "Template",
  book: "Book",
};

export function TypeChip({ type }: { type: string }) {
  return (
    <span className="inline-flex h-5 items-center rounded-md bg-bg-fill2 px-1.5 text-[12px] text-text-secondary leading-4">
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

/**
 * Thumbnail with a plain placeholder when there is none or it cannot load (the admin CSP only
 * allows same-origin images, so third-party thumbnails fall back until the API proxies them).
 */
export function Thumb({ src, className = "" }: { src: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return src && failed !== src ? (
    <img
      src={src}
      alt=""
      onError={() => setFailed(src)}
      className={`rounded-lg object-cover ${className}`}
    />
  ) : (
    <div aria-hidden="true" className={`rounded-lg bg-bg-fill2 ${className}`} />
  );
}
