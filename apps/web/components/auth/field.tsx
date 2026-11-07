"use client";

import { type ComponentProps, type ReactNode, useId, useState } from "react";
import { CheckIcon, EyeIcon, EyeOffIcon } from "./icons";

/**
 * Form fields of the auth screens (Figma Input, 36px field under a 14px medium label; error state
 * is a red border plus a 13px message). The label is always a real <label>; hint and error are
 * tied to the input with aria-describedby, and an error sets aria-invalid.
 */
export type TextFieldProps = Omit<ComponentProps<"input">, "id" | "className"> & {
  label: string;
  hint?: ReactNode;
  /** The message to show; also puts the field in its error state. */
  error?: string | null;
  /** Red border without a message under the field (for example "wrong email or password"). */
  invalid?: boolean;
  /** Content inside the field, after the input (the show/hide button). */
  trailing?: ReactNode;
};

export function TextField({
  label,
  hint,
  error,
  invalid,
  trailing,
  type = "text",
  ...inputProps
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = Boolean(error) || Boolean(invalid);
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]"
      >
        {label}
      </label>
      <div
        className={`flex items-center overflow-hidden rounded-lg border bg-bg-base shadow-e1 transition-[border-color,box-shadow] focus-within:ring-2 ${
          hasError
            ? "border-error-border focus-within:ring-error-focus"
            : "border-border focus-within:border-primary-border focus-within:ring-primary-focus"
        }`}
      >
        <input
          {...inputProps}
          id={id}
          type={type}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy || undefined}
          // 16px on phones so iOS does not zoom the page on focus; 14px from lg, as designed.
          className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-[16px] text-text leading-5 tracking-[-0.14px] outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:opacity-60 lg:text-[14px]"
        />
        {trailing}
      </div>
      {error ? (
        <p id={errorId} className="text-[13px] text-error-text leading-[18px] tracking-[-0.13px]">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p
          id={hintId}
          className="text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Password input with a show/hide toggle. Pass autoComplete="current-password" or "new-password". */
export function PasswordField({ ...props }: Omit<TextFieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      // Passwords are not spell-checked or capitalised.
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="flex h-9 w-10 shrink-0 items-center justify-center text-text-tertiary hover:text-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-border"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  );
}

/** Checkbox with its label (Figma Checkbox: 16px box). `error` renders the message under it. */
export function Checkbox({
  label,
  error,
  ...inputProps
}: Omit<ComponentProps<"input">, "type" | "id" | "className"> & {
  label: ReactNode;
  error?: string | null;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2">
        <span className="relative mt-0.5 flex size-4 shrink-0">
          <input
            {...inputProps}
            id={id}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`peer size-4 cursor-pointer appearance-none rounded-md border bg-bg-base checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border ${
              error ? "border-error-border" : "border-border-alpha"
            }`}
          />
          <CheckIcon
            size={16}
            className="pointer-events-none absolute inset-0 text-static-white opacity-0 peer-checked:opacity-100"
          />
        </span>
        <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
          {label}
        </span>
      </label>
      {error ? (
        <p id={errorId} className="text-[13px] text-error-text leading-[18px] tracking-[-0.13px]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
