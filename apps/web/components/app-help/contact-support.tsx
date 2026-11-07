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
import { Button, ButtonLink } from "../auth/button";
import { TextField } from "../auth/field";
import { BackLink, FORM_CARD, PageHeader, SelectField, TextAreaField } from "./fields";
import { HelpSent } from "./help-sent";

/**
 * Contact support (Figma Contact support 485:45196: Topic, Message with counter, Reply to, Cancel
 * and Send message; "Missing details" is the inline errors; "Message sent" is HelpSent).
 *
 * TODO(support-api): opens a prefilled mailto: to hello@matrstudio.com, see lib/app/help-form.ts.
 * The "sending" and "message didn’t send" frames have no equivalent until there is an API call.
 */
const EMPTY: ContactDraft = { topic: "", message: "", replyTo: "" };

export function ContactSupport() {
  const { me } = useSession();
  const [draft, setDraft] = useState<ContactDraft>(EMPTY);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [sent, setSent] = useState<string | null>(null);
  const topicRef = useRef<HTMLSelectElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const replyRef = useRef<HTMLInputElement>(null);

  function change<K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = validateContact(draft);
    setErrors(next);
    if (next.topic) return topicRef.current?.focus();
    if (next.message) return messageRef.current?.focus();
    if (next.replyTo) return replyRef.current?.focus();
    const href = contactMailto(draft, me.email);
    window.location.href = href;
    setSent(href);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <BackLink href={ROUTES.app.help}>Help centre</BackLink>
      <PageHeader
        title="Contact support"
        description="Tell us what you need help with. We reply by email within 2 working days."
      />
      {sent ? (
        <HelpSent title="Your email is ready to send" mailto={sent} onEdit={() => setSent(null)} />
      ) : (
        <form onSubmit={submit} noValidate className={FORM_CARD}>
          <SelectField
            ref={topicRef}
            label="Topic"
            required
            name="topic"
            placeholder="Choose a topic"
            value={draft.topic}
            error={errors.topic}
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
            placeholder="Tell us what you need help with."
            value={draft.message}
            error={errors.message}
            onChange={(e) => change("message", e.target.value)}
          />
          <TextField
            ref={replyRef}
            label="Reply to"
            type="email"
            name="replyTo"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={me.email}
            hint="We’ll reply to this address. Leave it empty to use your account email."
            value={draft.replyTo}
            error={errors.replyTo}
            onChange={(e) => change("replyTo", e.target.value)}
          />
          {errors.topic || errors.message || errors.replyTo ? (
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
              <Button type="submit">Send message</Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
