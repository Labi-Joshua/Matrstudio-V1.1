"use client";

import { cn } from "@matr/ui";
import { type ClipboardEvent, type KeyboardEvent, useRef } from "react";
import { FOCUS } from "./ui";

/** Six boxed digits (Figma SA3.3). Paste fills all boxes; Backspace walks back; arrows move. */
export function CodeInput({
  value,
  onChange,
  label,
  invalid,
  length = 6,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  invalid?: boolean;
  length?: number;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const set = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join("").slice(0, length));
  };
  const focus = (index: number) => refs.current[Math.max(0, Math.min(length - 1, index))]?.focus();

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      set(index - 1, "");
      focus(index - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focus(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focus(index + 1);
    }
  };
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    focus(pasted.length >= length ? length - 1 : pasted.length);
  };

  return (
    <fieldset aria-label={label} className="m-0 flex gap-2 border-0 p-0">
      {digits.map((digit, index) => (
        <input
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length positional boxes
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          data-autofocus={index === 0 ? "" : undefined}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`Digit ${index + 1}`}
          aria-invalid={invalid ? true : undefined}
          value={digit}
          onPaste={onPaste}
          onKeyDown={(event) => onKeyDown(index, event)}
          onChange={(event) => {
            const typed = event.target.value.replace(/\D/g, "");
            if (!typed) {
              set(index, "");
              return;
            }
            set(index, typed.slice(-1));
            if (index < length - 1) focus(index + 1);
          }}
          className={cn(
            "h-11 w-10 rounded-lg border bg-bg-base text-center font-medium text-[18px] text-text sm:w-11",
            invalid ? "border-error-border" : "border-border",
            FOCUS,
          )}
        />
      ))}
    </fieldset>
  );
}
