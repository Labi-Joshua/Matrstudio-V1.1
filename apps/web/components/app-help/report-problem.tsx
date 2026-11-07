"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import {
  HELP_MESSAGES,
  MESSAGE_MAX,
  REPORT_KINDS,
  type ReportDraft,
  type ReportErrors,
  reportMailto,
  validateReport,
} from "../../lib/app/help-form";
import { ROUTES } from "../../lib/routes";
import { useSession } from "../app/session";
import { Button, ButtonLink } from "../auth/button";
import {
  BackLink,
  boxClasses,
  describedBy,
  FieldShell,
  FORM_CARD,
  PageHeader,
  TextAreaField,
} from "./fields";
import { HelpSent } from "./help-sent";

/**
 * Report a problem (Figma Report a problem 485:45449 and "Report sent" 485:45561): the kind of
 * problem as radio cards, what happened, an optional page or link.
 *
 * Deviations: no screenshot upload (a mailto: cannot carry an attachment and there is no upload
 * endpoint; TODO(support-api) add it with the ticket API and R2 upload, docs/SECURITY-AUTH.md
 * section 8), and the report opens the email app (see lib/app/help-form.ts).
 */
const EMPTY: ReportDraft = { kind: "", detail: "", link: "" };

export function ReportProblem() {
  const { me } = useSession();
  const [draft, setDraft] = useState<ReportDraft>(EMPTY);
  const [errors, setErrors] = useState<ReportErrors>({});
  const [sent, setSent] = useState<string | null>(null);
  const group = useId();
  const linkId = useId();
  const firstKind = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLTextAreaElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  function change<K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = validateReport(draft);
    setErrors(next);
    if (next.kind) return firstKind.current?.focus();
    if (next.detail) return detailRef.current?.focus();
    if (next.link) return linkRef.current?.focus();
    const href = reportMailto(draft, me.email);
    window.location.href = href;
    setSent(href);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <BackLink href={ROUTES.app.help}>Help centre</BackLink>
      <PageHeader
        title="Report a problem"
        description="Something broken, a dead link or content that looks wrong? Tell us and we’ll fix it."
      />
      {sent ? (
        <HelpSent title="Your report is ready to send" mailto={sent} onEdit={() => setSent(null)} />
      ) : (
        <form onSubmit={submit} noValidate className={`${FORM_CARD} md:max-w-[820px]`}>
          <fieldset
            aria-describedby={errors.kind ? `${group}-error` : undefined}
            className="flex w-full min-w-0 flex-col gap-1.5"
          >
            <legend className="mb-1.5 flex items-center gap-1 font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
              What kind of problem is it?
              <span aria-hidden="true" className="text-error-text">
                *
              </span>
            </legend>
            <div className="grid gap-2 md:grid-cols-2 md:gap-3">
              {REPORT_KINDS.map((kind, index) => (
                <label
                  key={kind.id}
                  className="group relative flex cursor-pointer items-start gap-3 rounded-xl border border-border-soft bg-bg-base p-4 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-border"
                >
                  <input
                    ref={index === 0 ? firstKind : undefined}
                    type="radio"
                    name={`${group}-kind`}
                    value={kind.id}
                    checked={draft.kind === kind.id}
                    aria-invalid={errors.kind ? true : undefined}
                    onChange={() => change("kind", kind.id)}
                    className="peer sr-only"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1 text-[14px] leading-5 tracking-[-0.14px]">
                    <span className="font-medium text-text">{kind.label}</span>
                    <span className="text-text-secondary">{kind.hint}</span>
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
            {errors.kind ? (
              <p
                id={`${group}-error`}
                className="text-[12px] text-error-text leading-4 tracking-[-0.12px]"
              >
                {errors.kind}
              </p>
            ) : null}
          </fieldset>

          <TextAreaField
            ref={detailRef}
            label="What happened?"
            required
            name="detail"
            rows={5}
            max={MESSAGE_MAX}
            placeholder="Tell us what you were doing and what went wrong."
            value={draft.detail}
            error={errors.detail}
            onChange={(e) => change("detail", e.target.value)}
          />

          <FieldShell
            id={linkId}
            label="Page or link (optional)"
            error={errors.link}
            hint="The page or resource where it went wrong."
          >
            <div
              className={`flex items-center overflow-hidden ${boxClasses(Boolean(errors.link))}`}
            >
              <span className="flex h-9 shrink-0 items-center border-border border-r bg-bg-fill1 px-2.5 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
                https://
              </span>
              <input
                ref={linkRef}
                id={linkId}
                name="link"
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="matrstudio.com/learn/paths"
                value={draft.link}
                aria-invalid={errors.link ? true : undefined}
                aria-describedby={describedBy(linkId, errors.link, "hint")}
                onChange={(e) => change("link", e.target.value.replace(/^https:\/\//i, ""))}
                className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-[16px] text-text leading-5 tracking-[-0.14px] outline-none placeholder:text-text-tertiary lg:text-[14px]"
              />
            </div>
          </FieldShell>

          {errors.kind || errors.detail || errors.link ? (
            <p role="alert" className="sr-only">
              {HELP_MESSAGES.generalMissing}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <div className="w-full sm:w-fit">
              <ButtonLink href={ROUTES.app.help} variant="secondary">
                Cancel
              </ButtonLink>
            </div>
            <div className="w-full sm:w-fit">
              <Button type="submit">Send report</Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
