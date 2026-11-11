import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { ChevronDownIcon } from "./icons";
import { FOCUS } from "./ui";

const CONTROL =
  "w-full rounded-lg border border-border bg-bg-base px-3 text-[13px] text-text placeholder:text-text-tertiary disabled:opacity-60";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] text-text-secondary">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[12px] text-error-text">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-10 ${CONTROL} ${FOCUS}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={`min-h-[96px] resize-y py-2.5 leading-5 ${CONTROL} ${FOCUS}`} />
  );
}

export function Select({
  options,
  placeholder,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select {...rest} className={`h-10 appearance-none pr-9 ${CONTROL} ${FOCUS}`}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-tertiary">
        <ChevronDownIcon />
      </span>
    </div>
  );
}

/** A radio row with an optional hint line (decline reasons, where it goes). */
export function Radio({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className={`mt-0.5 size-4 shrink-0 accent-[#d65c1f] ${FOCUS}`}
      />
      <span className="min-w-0">
        <span className="block text-[13px] text-text leading-5">{label}</span>
        {hint ? <span className="block text-[12px] text-text-tertiary">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-[13px] text-text">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={`size-4 shrink-0 accent-[#d65c1f] ${FOCUS}`}
      />
      {children}
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 text-left text-[13px] text-text ${FOCUS}`}
    >
      <span
        className={`relative h-[22px] w-10 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${checked ? "bg-primary" : "bg-bg-fill4"}`}
      >
        <span
          className={`absolute top-0.5 size-[18px] rounded-full bg-static-white transition-all motion-reduce:transition-none ${checked ? "left-[20px]" : "left-0.5"}`}
        />
      </span>
      {label}
    </button>
  );
}
