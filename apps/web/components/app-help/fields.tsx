"use client";

import Link from "next/link";
import { type ComponentProps, type ReactNode, useId } from "react";
import { ChevronDownIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { ArrowLeftIcon } from "../auth/icons";

/**
 * Building blocks shared by the in-app Help centre and Submit a resource screens (Figma Input,
 * Select and Text area: 36px fields under a 14px medium label, red border plus a 12px message in
 * the error state). Every field has a real <label>, ties its hint and error to the control with
 * aria-describedby and sets aria-invalid.
 */
const LABEL =
  "flex items-center gap-1 font-medium text-[14px] text-text leading-5 tracking-[-0.14px]";
const MESSAGE = "text-[12px] leading-4 tracking-[-0.12px]";

export const CONTROL_BOX =
  "rounded-lg border bg-bg-base shadow-e1 transition-[border-color,box-shadow] focus-within:ring-2";

export function boxClasses(invalid: boolean): string {
  return `${CONTROL_BOX} ${
    invalid
      ? "border-error-border focus-within:ring-error-focus"
      : "border-border focus-within:border-primary-border focus-within:ring-primary-focus"
  }`;
}

export function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-error-text">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className={`${MESSAGE} text-error-text`}>
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={`${id}-hint`} className={`${MESSAGE} text-text-secondary`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(
  id: string,
  error?: string | null,
  hint?: ReactNode,
): string | undefined {
  const ids = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

type SelectProps = Omit<ComponentProps<"select">, "id" | "className"> & {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  placeholder?: string;
  children: ReactNode;
};

export function SelectField({
  label,
  required,
  hint,
  error,
  placeholder,
  children,
  value,
  ...rest
}: SelectProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <div className={`relative flex items-center ${boxClasses(Boolean(error))}`}>
        <select
          {...rest}
          id={id}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={`h-9 w-full min-w-0 appearance-none bg-transparent pr-9 pl-2.5 text-[16px] leading-5 tracking-[-0.14px] outline-none lg:text-[14px] ${
            value === "" ? "text-text-tertiary" : "text-text"
          }`}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {children}
        </select>
        <ChevronDownIcon
          size={20}
          className="pointer-events-none absolute right-2.5 text-text-secondary"
        />
      </div>
    </FieldShell>
  );
}

type TextAreaProps = Omit<ComponentProps<"textarea">, "id" | "className" | "value"> & {
  label: string;
  value: string;
  required?: boolean;
  optional?: boolean;
  hint?: ReactNode;
  error?: string | null;
  /** Shows "n / max" in the corner (Figma counter). */
  max?: number;
  rows?: number;
};

export function TextAreaField({
  label,
  required,
  hint,
  error,
  max,
  value,
  rows = 4,
  ...rest
}: TextAreaProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <div className={`flex flex-col gap-2 px-2.5 py-2 ${boxClasses(Boolean(error))}`}>
        <textarea
          {...rest}
          id={id}
          rows={rows}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className="w-full resize-none bg-transparent text-[16px] text-text leading-5 tracking-[-0.14px] outline-none placeholder:text-text-tertiary lg:text-[14px]"
        />
        {max ? (
          <p
            aria-hidden="true"
            className={`text-right ${MESSAGE} ${value.length > max ? "text-error-text" : "text-text-tertiary"}`}
          >
            {value.length} / {max}
          </p>
        ) : null}
      </div>
    </FieldShell>
  );
}

/** Page title block used by every screen here (Figma "Header": 28px title, 16px subtitle). */
export function PageHeader({
  title,
  description,
  titleId,
}: {
  title: string;
  description: string;
  titleId?: string;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1
        id={titleId}
        className="font-medium text-[28px] text-text leading-8 tracking-[-0.56px] md:text-[30px] md:leading-9 md:tracking-[-0.6px]"
      >
        {title}
      </h1>
      <p className="max-w-[680px] text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">
        {description}
      </p>
    </header>
  );
}

/** "Back to Help centre" style link above a sub-page. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex w-fit items-center gap-1.5 rounded-md font-medium text-[14px] text-text-secondary leading-5 tracking-[-0.14px] hover:text-text ${FOCUS}`}
    >
      <ArrowLeftIcon size={16} />
      {children}
    </Link>
  );
}

/** The 720px card the forms sit in on desktop (Figma "Card"); borderless on phones. */
export const FORM_CARD =
  "flex w-full max-w-[720px] flex-col gap-5 md:rounded-xl md:border md:border-border-soft md:bg-bg-base md:p-6";
