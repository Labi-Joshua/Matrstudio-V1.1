"use client";

import { useEffect, useRef } from "react";
import { HELP_EMAIL } from "../../lib/app/help-form";
import { ROUTES } from "../../lib/routes";
import { Button, ButtonLink } from "../auth/button";
import { MailIcon } from "../auth/icons";

/**
 * Figma "Message sent" / "Report sent". There is no support API yet, so nothing has left the
 * device: the email app was opened with the message ready. The screen says exactly that instead
 * of claiming the message was sent (TODO(support-api): show the real confirmation once it exists).
 */
export function HelpSent({
  title,
  mailto,
  onEdit,
}: {
  title: string;
  /** The same mailto: link, offered again in case the email app did not open. */
  mailto: string;
  onEdit: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <div
      role="status"
      className="flex w-full max-w-[560px] flex-col items-start gap-4 rounded-xl border border-border-soft bg-bg-base p-6"
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-primary-focus text-primary-text"
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
      <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">
        We opened your email app with your message ready to go. Press send there and we’ll reply
        within 2 working days. Nothing reaches us until you do.
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
      <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
        <div className="w-full sm:w-fit">
          <ButtonLink href={ROUTES.app.help}>Back to Help centre</ButtonLink>
        </div>
        <div className="w-full sm:w-fit">
          <Button variant="secondary" onClick={onEdit}>
            Edit message
          </Button>
        </div>
      </div>
    </div>
  );
}
