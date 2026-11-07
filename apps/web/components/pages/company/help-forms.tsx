"use client";

import { type FormEvent, type ReactNode, useId, useState } from "react";
import {
  HELP_CONTACT,
  HELP_EMAIL,
  HELP_REPORT,
  MESSAGE_MAX,
  type ProblemIcon,
  SCREENSHOT_MAX_BYTES,
} from "../../../lib/pages/company-help";

/**
 * The two support forms of /help (Figma 778:8561). There is no backend yet, so submitting opens
 * the visitor's email app with the message filled in (mailto:). TODO: post to the support API
 * (and upload the screenshot) once it exists.
 */
function send(subject: string, lines: string[]) {
  const href = `mailto:${HELP_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  window.location.href = href;
}

const CONTROL =
  "w-full rounded-lg border border-border bg-bg-base px-2.5 py-2 text-[14px] text-text leading-5 tracking-[-0.14px] shadow-[0_1px_1px_rgba(25,24,27,0.04)] placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-primary";

const FORM =
  "flex w-full flex-col gap-5 pt-5 pb-6 md:rounded-xl md:border md:border-border-soft md:bg-bg-base md:p-6";

function Field({
  label,
  required,
  optional,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1 font-medium text-[14px] text-text leading-5 tracking-[-0.14px]"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="text-error-text">
            *
          </span>
        )}
        {optional && <span className="font-normal text-text-tertiary">{optional}</span>}
      </label>
      {children}
    </div>
  );
}

function Icon({ d, className = "size-5" }: { d: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

const ICONS: Record<ProblemIcon | "chevron" | "upload", string> = {
  bug: "m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6ZM12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4",
  link: "M9 17H7A5 5 0 0 1 7 7M15 7h2a5 5 0 0 1 4 8M8 12h4M2 2l20 20",
  file: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8",
  question: "M7.9 20A9 9 0 1 0 4 16.1L2 22ZM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
  chevron: "m6 9 6 6 6-6",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
};

function Counter({ value }: { value: string }) {
  return (
    <p aria-hidden="true" className="text-right text-[12px] text-text-tertiary leading-4">
      {value.length} / {MESSAGE_MAX}
    </p>
  );
}

function Actions({ label, disabled }: { label: string; disabled: boolean }) {
  return (
    <div className="flex w-full items-start justify-end gap-3">
      <button
        type="reset"
        className="btn-lift hidden items-center justify-center rounded-lg border border-border bg-bg-fill1 px-3 py-2.5 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] md:flex"
      >
        <span className="px-0.5">Cancel</span>
      </button>
      <button
        type="submit"
        aria-disabled={disabled}
        className={`flex w-full items-center justify-center rounded-lg bg-text px-3 py-2.5 font-medium text-[14px] text-bg-base leading-5 tracking-[-0.14px] md:w-auto md:bg-primary md:text-static-white ${
          disabled ? "opacity-50" : "btn-lift"
        }`}
      >
        <span className="px-0.5">{label}</span>
      </button>
    </div>
  );
}

export function ContactForm() {
  const id = useId();
  const [message, setMessage] = useState("");
  const [topic, setTopic] = useState<string>(HELP_CONTACT.topics[0]);
  const [email, setEmail] = useState("");
  const empty = message.trim() === "";

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (empty) return;
    send(`Support: ${topic}`, [
      message.trim(),
      "",
      email.trim() ? `Reply to: ${email.trim()}` : "",
    ]);
  }

  return (
    <form
      onSubmit={onSubmit}
      onReset={() => {
        setMessage("");
        setEmail("");
        setTopic(HELP_CONTACT.topics[0]);
      }}
      className={`${FORM} md:max-w-[720px]`}
    >
      <Field label="Topic" required htmlFor={`${id}-topic`}>
        <div className="relative">
          <select
            id={`${id}-topic`}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className={`${CONTROL} appearance-none pr-9`}
          >
            {HELP_CONTACT.topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <Icon
            d={ICONS.chevron}
            className="pointer-events-none absolute top-1/2 right-2.5 size-5 -translate-y-1/2 text-text-secondary"
          />
        </div>
      </Field>
      <Field label="Message" required htmlFor={`${id}-message`}>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg-base px-3 py-2.5 shadow-[0_1px_1px_rgba(25,24,27,0.04)] focus-within:outline-2 focus-within:outline-primary">
          <textarea
            id={`${id}-message`}
            required
            maxLength={MESSAGE_MAX}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={HELP_CONTACT.messagePlaceholder}
            className="h-[96px] w-full resize-none bg-transparent text-[14px] text-text leading-5 tracking-[-0.14px] outline-none placeholder:text-text-tertiary"
          />
          <Counter value={message} />
        </div>
      </Field>
      <div className="flex flex-col gap-1.5">
        <Field label="Your email" htmlFor={`${id}-email`}>
          <input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={HELP_CONTACT.emailPlaceholder}
            className={`${CONTROL} border-border-soft bg-bg-fill1`}
          />
        </Field>
        <p className="text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
          {HELP_CONTACT.emailHint}
        </p>
      </div>
      <Actions label={HELP_CONTACT.submit} disabled={empty} />
    </form>
  );
}

export function ReportForm() {
  const id = useId();
  const [kind, setKind] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const incomplete = kind === "" || detail.trim() === "";

  function pick(files: FileList | null) {
    const next = files?.[0] ?? null;
    setFileError("");
    if (!next) return;
    if (!["image/png", "image/jpeg"].includes(next.type) || next.size > SCREENSHOT_MAX_BYTES) {
      setFile(null);
      setFileError("Use a PNG or JPG under 10 MB.");
      return;
    }
    setFile(next);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (incomplete) return;
    const label = HELP_REPORT.types.find((t) => t.id === kind)?.label ?? kind;
    send(`Problem report: ${label}`, [
      detail.trim(),
      "",
      link.trim() ? `Page or link: https://${link.trim().replace(/^https?:\/\//, "")}` : "",
      file ? `Screenshot: ${file.name} (please attach it to this email)` : "",
    ]);
  }

  return (
    <form
      onSubmit={onSubmit}
      onReset={() => {
        setKind("");
        setDetail("");
        setLink("");
        setFile(null);
        setFileError("");
      }}
      className={`${FORM} md:max-w-[820px]`}
    >
      <fieldset className="flex w-full flex-col gap-1.5">
        <legend className="mb-1.5 flex items-center gap-1 font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
          {HELP_REPORT.typeLabel}
          <span aria-hidden="true" className="text-error-text">
            *
          </span>
        </legend>
        <div className="grid gap-2 md:grid-cols-2 md:gap-3">
          {HELP_REPORT.types.map((type) => (
            <label
              key={type.id}
              className="card-lift group relative flex cursor-pointer items-start gap-4 rounded-xl border border-border-soft bg-bg-base p-4 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
            >
              <input
                type="radio"
                name={`${id}-kind`}
                value={type.id}
                checked={kind === type.id}
                onChange={() => setKind(type.id)}
                className="peer sr-only"
              />
              <span className="hidden items-center rounded-xl bg-bg-fill2 p-3 text-text-secondary md:flex">
                <Icon d={ICONS[type.icon]} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1 text-[14px] leading-5 tracking-[-0.14px]">
                <span className="font-medium text-text">{type.label}</span>
                <span className="text-text-secondary">{type.hint}</span>
              </span>
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-bg-base peer-checked:border-primary peer-checked:bg-primary"
              >
                <span className="size-2.5 rounded-full bg-bg-base group-has-[:checked]:bg-static-white" />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label={HELP_REPORT.detailLabel} required htmlFor={`${id}-detail`}>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg-base p-2.5 shadow-[0_1px_1px_rgba(25,24,27,0.04)] focus-within:outline-2 focus-within:outline-primary">
          <textarea
            id={`${id}-detail`}
            required
            maxLength={MESSAGE_MAX}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={HELP_REPORT.detailPlaceholder}
            className="h-[96px] w-full resize-none bg-transparent text-[14px] text-text leading-5 tracking-[-0.14px] outline-none placeholder:text-text-tertiary"
          />
          <Counter value={detail} />
        </div>
      </Field>

      <Field label={HELP_REPORT.linkLabel} htmlFor={`${id}-link`}>
        <div className="flex w-full">
          <span className="flex items-center rounded-l-lg border border-border bg-bg-fill1 px-2.5 py-2 text-[14px] text-text leading-5 tracking-[-0.14px]">
            https://
          </span>
          <input
            id={`${id}-link`}
            type="text"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder={HELP_REPORT.linkPlaceholder}
            className={`${CONTROL} -ml-px min-w-0 flex-1 rounded-l-none`}
          />
        </div>
      </Field>

      <Field
        label={HELP_REPORT.screenshotLabel}
        optional={HELP_REPORT.screenshotOptional}
        htmlFor={`${id}-file`}
      >
        <div className="relative flex h-[212px] flex-col items-center justify-center gap-3 rounded-[10px] border border-text-tertiary border-dashed bg-bg-base p-8 text-center">
          <span className="flex rounded-lg border border-border-soft bg-bg-base p-1.5 text-text">
            <Icon d={ICONS.upload} />
          </span>
          <span className="flex flex-col gap-1">
            <span className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
              {file ? file.name : HELP_REPORT.dropTitle}
            </span>
            <span
              className={`text-[12px] leading-4 tracking-[-0.12px] ${fileError ? "text-error-text" : "text-text-secondary"}`}
            >
              {fileError || HELP_REPORT.dropHint}
            </span>
          </span>
          <input
            id={`${id}-file`}
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => pick(e.target.files)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
      </Field>

      <Actions label={HELP_REPORT.submit} disabled={incomplete} />
    </form>
  );
}
