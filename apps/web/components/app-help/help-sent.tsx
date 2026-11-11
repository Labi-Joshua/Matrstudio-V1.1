"use client";

import { useEffect, useRef } from "react";
import { requestHref } from "../../lib/app/help-requests";
import type { TicketKind } from "../../lib/auth/support-api";
import { ROUTES } from "../../lib/routes";
import { ButtonLink } from "../auth/button";
import { CircleCheckIcon } from "../auth/icons";

/**
 * Figma "Message sent" 485:45258 / "Report sent" 485:45561: a centred card with the check, the
 * title, the reply promise and the two actions. The request exists on the server by now, so
 * "View request" opens it. "Back to Help centre" carries ?sent= so the hub can show the success
 * toast.
 */
export function HelpSent({
  title,
  kind,
  ticketId,
  replyTo,
}: {
  title: string;
  kind: TicketKind;
  ticketId: string;
  /** The account email the reply goes to. */
  replyTo: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <div
      role="status"
      className="flex w-full max-w-[720px] flex-col items-center gap-4 self-center rounded-xl border border-border-soft bg-bg-base px-6 py-10 text-center md:py-14"
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-xl bg-success-focus text-success-text"
      >
        <CircleCheckIcon size={24} />
      </span>
      <h2
        ref={heading}
        tabIndex={-1}
        className="font-medium text-[22px] text-text leading-7 tracking-[-0.22px] outline-none"
      >
        {title}
      </h2>
      <p className="max-w-[480px] text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">
        We’ll reply to {replyTo} within 2 working days. You can follow it in Your requests.
      </p>
      <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <div className="w-full sm:w-fit">
          <ButtonLink href={`${ROUTES.app.help}?sent=${kind}`} variant="secondary">
            Back to Help centre
          </ButtonLink>
        </div>
        <div className="w-full sm:w-fit">
          <ButtonLink href={requestHref(ticketId)}>View request</ButtonLink>
        </div>
      </div>
    </div>
  );
}
