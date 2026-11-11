"use client";

import { type FormEvent, useRef, useState } from "react";
import {
  CONTACT_TOPICS,
  type ContactDraft,
  type ContactErrors,
  contactMailto,
  HELP_MESSAGES,
  MESSAGE_MAX,
  validateContact,
} from "../../lib/app/help-form";
import { ROUTES } from "../../lib/routes";
import { useSession } from "../app/session";
import { Banner, bannerActionClasses, StatusRegion } from "../auth/banner";
import { Button, ButtonLink } from "../auth/button";
import {
  BackLink,
  boxClasses,
  describedBy,
  FieldShell,
  HELP_CARD,
  PageHeader,
  SelectField,
  TextAreaField,
} from "./fields";
import { HelpSent } from "./help-sent";
import { OfflineNotice } from "./offline-notice";
import { useMailtoSend } from "./use-mailto-send";

/**
 * Contact support (Figma Contact support 485:45196: Topic, Message with counter, "We'll reply to"
 * with the account email, Cancel and Send message; "Missing details" 485:45227 is the inline
 * errors; "Message sent" 485:45258 is HelpSent; sending 671:76273 and "didn't send" 671:76627 are
 * the pending button and the error banner with Retry).
 *
 * TODO(support-api): opens a prefilled mailto: to hello@matrstudio.com, see lib/app/help-form.ts.
 * No Turnstile yet: it belongs to the API call (docs/SECURITY-AUTH.md section 5).
 */
const EMPTY: ContactDraft = { topic: "", message: "" };

export function ContactSupport() {
  const { me } = useSession();
  const [draft, setDraft] = useState<ContactDraft>(EMPTY);
  const [errors, setErrors] = useState<ContactErrors>({});
  const mail = useMailtoSend();
  const topicRef = useRef<HTMLSelectElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const sending = mail.state === "sending";

  function change<K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    const next = validateContact(draft);
    setErrors(next);
    if (next.topic) return topicRef.current?.focus();
    if (next.message) return messageRef.current?.focus();
    mail.send(contactMailto(draft, me.email));
  }

  const showSent = mail.state === "sent" && mail.href;
  const replyId = "contact-reply";

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <BackLink href={ROUTES.app.help}>Help centre</BackLink>
      <OfflineNotice />
      <PageHeader
        title="Contact support"
        description="Tell us what you need help with. We reply by email within 2 working days."
      />
      {showSent && mail.href ? (
        <HelpSent
          title="Your email is ready to send"
          mailto={mail.href}
          replyTo={me.email}
          onEdit={mail.reset}
        />
      ) : (
        <>
          <StatusRegion politeness="assertive">
            {mail.state === "failed" ? (
              <div className="xl:max-w-[720px]">
                <Banner
                  tone="error"
                  title="Your message didn’t send"
                  action={
                    <button
                      type="button"
                      onClick={() => mail.href && mail.send(mail.href)}
                      className={bannerActionClasses}
                    >
                      Retry
                    </button>
                  }
                >
                  We couldn’t open your email app. We kept what you wrote.
                </Banner>
              </div>
            ) : null}
          </StatusRegion>
          <form
            onSubmit={submit}
            noValidate
            aria-busy={sending || undefined}
            className={`${HELP_CARD} xl:max-w-[720px]`}
          >
            <SelectField
              ref={topicRef}
              label="Topic"
              required
              name="topic"
              placeholder="Choose a topic"
              value={draft.topic}
              error={errors.topic}
              disabled={sending}
              onChange={(e) => change("topic", e.target.value)}
            >
              {CONTACT_TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </SelectField>
            <TextAreaField
              ref={messageRef}
              label="Message"
              required
              name="message"
              rows={5}
              max={MESSAGE_MAX}
              placeholder="Tell us what’s going on, and what you’ve tried so far."
              value={draft.message}
              error={errors.message}
              readOnly={sending}
              onChange={(e) => change("message", e.target.value)}
            />
            <FieldShell
              id={replyId}
              label="We’ll reply to"
              hint="Change your email in Settings → Account."
            >
              <div className={`flex items-center overflow-hidden bg-bg-fill1 ${boxClasses(false)}`}>
                <input
                  id={replyId}
                  readOnly
                  aria-readonly="true"
                  value={me.email}
                  aria-describedby={describedBy(replyId, null, "hint")}
                  className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-[16px] text-text-tertiary leading-5 tracking-[-0.14px] outline-none lg:text-[14px]"
                />
              </div>
            </FieldShell>
            {errors.topic || errors.message ? (
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
                  Send message
                </Button>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
