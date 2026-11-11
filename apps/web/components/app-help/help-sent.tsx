"use client";

import { useEffect, useRef } from "react";
import { HELP_EMAIL } from "../../lib/app/help-form";
import { ROUTES } from "../../lib/routes";
import { Button, ButtonLink } from "../auth/button";
import { MailIcon } from "../auth/icons";

/**
 * Figma "Message sent" 485:45258 / "Report sent" 485:45561: a centred card with the icon, a title,
 * the reply promise and the two actions. There is no support API yet, so nothing has left the
 * device: the email app was opened with the message ready. The screen says exactly that instead
 * of claiming the message was sent, and "View request" is replaced by "Edit message" because
 * there is no request to follow (TODO(support-api): show the real confirmation once it exists).
 */
export function HelpSent({
  title,
  mailto,
  replyTo,
  editLabel = "Edit message",
  onEdit,
}: {
  title: string;
  /** The same mailto: link, offered again in case the email app did not open. */
  mailto: string;
  /** The account email the reply goes to. */
  replyTo: string;
  editLabel?: string;
  onEdit: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <div
      role="status"
      className="flex w-full max-w-[720px] flex-col items-center gap-4 rounded-xl border border-border-soft bg-bg-base px-6 py-10 text-center md:py-14"
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-xl bg-primary-focus text-primary-text"
      >
        <MailIcon size={24} />
      </span>
      <h2
        ref={heading}
        tabIndex={-1}
        className="font-medium text-[22px] text-text leading-7 tracking-[-0.22px] outline-none"
      >
        {title}
      </h2>
      <p className="max-w-[480px] text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">
        We opened your email app with your message ready to go. Press send there and we’ll reply to{" "}
        {replyTo} within 2 working days. Nothing reaches us until you do.
      </p>
      <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
        Nothing opened?{" "}
        <a
          href={mailto}
          className="rounded-sm font-medium text-primary-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border"
        >
          Try again
        </a>{" "}
        or write to {HELP_EMAIL}.
      </p>
      <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <div className="w-full sm:w-fit">
          <ButtonLink href={ROUTES.app.help} variant="secondary">
            Back to Help centre
          </ButtonLink>
        </div>
        <div className="w-full sm:w-fit">
          <Button onClick={onEdit}>{editLabel}</Button>
        </div>
      </div>
    </div>
  );
}
