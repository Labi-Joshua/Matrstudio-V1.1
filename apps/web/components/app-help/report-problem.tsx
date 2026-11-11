"use client";

import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import {
  HELP_MESSAGES,
  linkWithoutScheme,
  MESSAGE_MAX,
  parseReportContext,
  REPORT_KINDS,
  type ReportContext,
  type ReportDraft,
  type ReportErrors,
  validateReport,
} from "../../lib/app/help-form";
import { reportTicket } from "../../lib/app/help-requests";
import { ROUTES } from "../../lib/routes";
import { FileTextIcon } from "../app/icons";
import { useSession } from "../app/session";
import { Button, ButtonLink } from "../auth/button";
import { InfoIcon } from "../auth/icons";
import {
  BackLink,
  boxClasses,
  describedBy,
  FieldShell,
  HELP_CARD,
  PageHeader,
  TextAreaField,
} from "./fields";
import { BugIcon, LinkBrokenIcon, MessageCircleQuestionIcon } from "./help-icons";
import { HelpSent } from "./help-sent";
import { OfflineNotice } from "./offline-notice";
import { ScreenshotField } from "./screenshot-field";
import { CaptchaBlock, SendFailure } from "./send-parts";
import { useTicketSend } from "./use-ticket-send";

const EMPTY: ReportDraft = { kind: "", detail: "", link: "" };

const KIND_ICONS: Record<string, ReactNode> = {
  broken: <BugIcon size={20} />,
  link: <LinkBrokenIcon size={20} />,
  content: <FileTextIcon size={20} />,
  other: <MessageCircleQuestionIcon size={20} />,
};

/**
 * Report a problem (Figma Report a problem 485:45449, "from a resource" 485:45492, "Report sent"
 * 485:45561): the kind of problem as radio cards (two columns on desktop, one on tablet and
 * phone), what happened, an optional page or link, and the screenshot box.
 *
 * Opened from a lesson or resource with ?resource=Title&where=Lesson 5 of Path&link=https://...,
 * the form shows the context chip and prefills the link (see parseReportContext). Without those
 * it is the plain form.
 *
 * Posts to POST /api/me/support with the Turnstile check. The context chip and the link travel as
 * the ticket's `context`. Deviation: the screenshot box is switched off (no upload endpoint, see
 * ScreenshotField).
 */
export function ReportProblem() {
  const { me } = useSession();
  const [draft, setDraft] = useState<ReportDraft>(EMPTY);
  const [errors, setErrors] = useState<ReportErrors>({});
  const [context, setContext] = useState<ReportContext | null>(null);
  const { status, send, clear, captcha, setToken } = useTicketSend("report");
  const group = useId();
  const linkId = useId();
  const firstKind = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLTextAreaElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const sending = status.state === "sending";

  // The URL is only readable in the browser (static export), so the context arrives after mount.
  useEffect(() => {
    const found = parseReportContext(window.location.search);
    if (!found) return;
    setContext(found);
    if (found.link) setDraft((d) => ({ ...d, link: linkWithoutScheme(found.link) }));
  }, []);

  function change<K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    const next = validateReport(draft);
    setErrors(next);
    if (next.kind) return firstKind.current?.focus();
    if (next.detail) return detailRef.current?.focus();
    if (next.link) return linkRef.current?.focus();
    send(reportTicket(draft, context));
  }

  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      <BackLink href={ROUTES.app.help}>Help centre</BackLink>
      <OfflineNotice />
      <PageHeader
        title="Report a problem"
        description="Something broken, a dead link or content that looks wrong? Tell us and we’ll fix it."
      />
      {status.state === "sent" ? (
        <HelpSent
          title="Report sent"
          kind="report"
          ticketId={status.ticket.id}
          replyTo={me.email}
        />
      ) : (
        <>
          <SendFailure
            status={status}
            maxWidth="xl:max-w-[820px]"
            onRetry={() =>
              Object.keys(validateReport(draft)).length > 0
                ? clear()
                : send(reportTicket(draft, context))
            }
          />
          <form
            onSubmit={submit}
            noValidate
            aria-busy={sending || undefined}
            className={`${HELP_CARD} xl:max-w-[820px]`}
          >
            {context ? (
              <div className="flex items-start gap-2.5 rounded-lg bg-info-focus px-3 py-2.5 text-[14px] leading-5 tracking-[-0.14px]">
                <InfoIcon size={20} className="mt-0.5 shrink-0 text-primary-text" />
                <p className="min-w-0 text-text-secondary">
                  <span className="block break-words font-medium text-text">
                    Reporting “{context.title}”
                  </span>
                  {context.where ? `${context.where}. ` : null}
                  {context.link ? "We’ve filled in the link for you." : null}
                </p>
              </div>
            ) : null}
            <fieldset
              aria-describedby={errors.kind ? `${group}-error` : undefined}
              disabled={sending}
              className="flex w-full min-w-0 flex-col gap-1.5"
            >
              <legend className="mb-1.5 flex items-center gap-1 font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
                What kind of problem is it?
                <span aria-hidden="true" className="text-error-text">
                  *
                </span>
              </legend>
              <div className="grid gap-2 xl:grid-cols-2 xl:gap-3">
                {REPORT_KINDS.map((kind, index) => (
                  <label
                    key={kind.id}
                    className="group relative flex cursor-pointer items-center gap-3 rounded-xl border border-border-soft bg-bg-base p-3 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-border"
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
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bg-fill1 text-text-secondary"
                    >
                      {KIND_ICONS[kind.id]}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-[14px] leading-5 tracking-[-0.14px]">
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
              readOnly={sending}
              onChange={(e) => change("detail", e.target.value)}
            />

            <FieldShell id={linkId} label="Page or link" error={errors.link}>
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
                  placeholder="Paste the page or resource link (optional)"
                  value={draft.link}
                  readOnly={sending}
                  aria-invalid={errors.link ? true : undefined}
                  aria-describedby={describedBy(linkId, errors.link)}
                  onChange={(e) => change("link", e.target.value.replace(/^https:\/\//i, ""))}
                  className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-[16px] text-text leading-5 tracking-[-0.14px] outline-none placeholder:text-text-tertiary lg:text-[14px]"
                />
              </div>
            </FieldShell>

            <ScreenshotField />

            <CaptchaBlock captchaRef={captcha} onToken={setToken} />

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
                <Button type="submit" pending={sending} pendingLabel="Sending…">
                  Send report
                </Button>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
