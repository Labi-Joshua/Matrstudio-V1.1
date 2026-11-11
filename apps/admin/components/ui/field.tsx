"use client";

import {
  type ClipboardEvent,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { FOCUS } from "./focus";
import { CheckIcon, EyeIcon, EyeOffIcon } from "./icons";

/**
 * Form fields (Figma Input: 36px field under a 14px medium label; error = red border and a 13px
 * message). The label is a real <label>; hint and error are tied to the input with
 * aria-describedby, and an error sets aria-invalid.
 */
export type TextFieldProps = Omit<ComponentProps<"input">, "id" | "className"> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Red border without a message under the field. */
  invalid?: boolean;
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
  const hasError = Boolean(error) || Boolean(invalid);
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
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
          className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-[16px] text-text leading-5 tracking-[-0.14px] outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:opacity-60 lg:text-[14px]"
        />
        {trailing}
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          className="text-[13px] text-error-text leading-[18px] tracking-[-0.13px]"
        >
          {error}
        </p>
      ) : null}
      {hint ? (
        <p
          id={`${id}-hint`}
          className="text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordField(props: Omit<TextFieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
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
          {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      }
    />
  );
}

/** Checkbox with its label (16px box). */
export function Checkbox({
  label,
  error,
  ...inputProps
}: Omit<ComponentProps<"input">, "type" | "id" | "className"> & {
  label: ReactNode;
  error?: string | null;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2">
        <span className="relative mt-0.5 flex size-4 shrink-0">
          <input
            {...inputProps}
            id={id}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={`peer size-4 cursor-pointer appearance-none rounded-md border bg-bg-base checked:border-primary checked:bg-primary ${FOCUS} ${
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
        <p
          id={`${id}-error`}
          className="text-[13px] text-error-text leading-[18px] tracking-[-0.13px]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Six boxed digits (Figma "6-digit code"). Typing moves forward, Backspace moves back, pasting a
 * code fills every box, and `onComplete` fires when the sixth digit is in. The value is one string.
 */
export function CodeInput({
  label,
  value,
  onChange,
  onComplete,
  error,
  disabled,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  const errorId = `${id}-error`;

  // A submitted code disables the boxes; when they come back (wrong code), focus returns to the first one.
  const wasDisabled = useRef(false);
  useEffect(() => {
    if (wasDisabled.current && !disabled) refs.current[0]?.focus();
    wasDisabled.current = Boolean(disabled);
  }, [disabled]);

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
    return clean;
  };
  const focusBox = (i: number) => refs.current[Math.max(0, Math.min(5, i))]?.focus();

  const onKeyDown = (i: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[i] && i > 0) {
      event.preventDefault();
      commit(value.slice(0, i - 1));
      focusBox(i - 1);
    } else if (event.key === "ArrowLeft") focusBox(i - 1);
    else if (event.key === "ArrowRight") focusBox(i + 1);
  };
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const clean = commit(event.clipboardData.getData("text"));
    focusBox(clean.length);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span
        id={`${id}-label`}
        className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]"
      >
        {label}
      </span>
      {/* biome-ignore lint/a11y/useSemanticElements: the visible label above is the group name */}
      <div role="group" aria-labelledby={`${id}-label`} className="flex gap-2">
        {digits.map((digit, i) => (
          <input
            // biome-ignore lint/suspicious/noArrayIndexKey: the six boxes are fixed positions
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={digit}
            disabled={disabled}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            // biome-ignore lint/a11y/noAutofocus: the code screen has one task, so focus lands on its first box
            autoFocus={autoFocus && i === 0}
            maxLength={1}
            aria-label={`Digit ${i + 1} of 6`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              const typed = event.target.value.replace(/\D/g, "");
              if (!typed) {
                commit(value.slice(0, i) + value.slice(i + 1));
                return;
              }
              const next = commit(value.slice(0, i) + typed.slice(-1) + value.slice(i + 1));
              if (next.length > i) focusBox(i + 1);
            }}
            onKeyDown={(event) => onKeyDown(i, event)}
            onPaste={onPaste}
            onFocus={(event) => event.target.select()}
            className={`h-11 min-w-0 flex-1 rounded-lg border bg-bg-base text-center font-medium text-[18px] text-text shadow-e1 outline-none focus:ring-2 disabled:opacity-60 ${
              error
                ? "border-error-border focus:ring-error-focus"
                : "border-border focus:border-primary-border focus:ring-primary-focus"
            }`}
          />
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-[13px] text-error-text leading-[18px] tracking-[-0.13px]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
