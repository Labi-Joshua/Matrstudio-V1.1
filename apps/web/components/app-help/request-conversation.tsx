import { messageStamp, STATUS_LOOK } from "../../lib/app/help-requests";
import type { Ticket, TicketMessage } from "../../lib/auth/support-api";
import { ROUTES } from "../../lib/routes";
import { HelpCircleIcon } from "../app/icons";
import { ButtonLink } from "../auth/button";
import { CircleCheckIcon, InfoIcon } from "../auth/icons";
import { MessageCircleIcon, UserIcon } from "./help-icons";
import { Callout } from "./ticket-status";

/** The conversation of a request page (Figma 485:45291): your messages and support's, oldest first. */
export function Conversation({ messages, now }: { messages: readonly TicketMessage[]; now: Date }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {messages.map((message) => {
        const mine = message.author === "you";
        return (
          <li
            key={message.id}
            className="flex flex-col gap-2.5 rounded-xl border border-border-soft bg-bg-base p-4"
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                  mine
                    ? "border border-border-soft text-text-secondary"
                    : "bg-primary-focus text-primary-text"
                }`}
              >
                {mine ? <UserIcon size={18} /> : <MessageCircleIcon size={18} />}
              </span>
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[14px] leading-5 tracking-[-0.14px]">
                <span className="font-medium text-text">
                  {mine ? "You" : "Matr Studio support"}
                </span>
                <span className="text-[12px] text-text-tertiary">
                  {messageStamp(message.createdAt, now)}
                </span>
              </p>
            </div>
            <p className="whitespace-pre-wrap break-words text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
              {message.body}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** What the report was about, from the context chip of the form (https links only, see parseTicket). */
export function ContextLine({ context }: { context: NonNullable<Ticket["context"]> }) {
  const link = context.link && /^https:\/\//i.test(context.link) ? context.link : null;
  return (
    <p className="max-w-[680px] break-words text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
      About{" "}
      {context.resource ? (
        <strong className="font-medium text-text">{context.resource}</strong>
      ) : (
        "a page"
      )}
      {context.where ? `, ${context.where}` : ""}
      {link ? (
        <>
          {". "}
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm font-medium text-primary-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border"
          >
            Open the link
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </>
      ) : null}
    </p>
  );
}

const HELP = ROUTES.app.help;

/**
 * The note under the conversation for each status: open and replied invite a reply (the box is
 * below), the closed ones (Figma "Request resolved" 485:45370, "Fixed or can't reproduce" 485:45618)
 * say what happened and offer the next step. A closed request takes no more replies.
 */
export function StatusNote({ ticket }: { ticket: Ticket }) {
  const report = ticket.kind === "report";
  const back = (
    <ButtonLink href={HELP} variant="secondary">
      Back to help centre
    </ButtonLink>
  );
  const again = (
    <ButtonLink href={`${HELP}/${report ? "report" : "contact"}`} variant="secondary">
      {report ? "Send a new report" : "Start a new request"}
    </ButtonLink>
  );
  const actions = (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="w-full sm:w-fit">{back}</div>
      <div className="w-full sm:w-fit">{again}</div>
    </div>
  );
  switch (ticket.status) {
    case "open":
      return (
        <Callout tone="info" icon={<InfoIcon size={20} />} title={STATUS_LOOK.open.label}>
          We’ve got your {report ? "report" : "request"}. We reply by email within 2 working days,
          and you can add more details below.
        </Callout>
      );
    case "replied":
      return (
        <Callout tone="info" icon={<InfoIcon size={20} />} title="Support replied">
          Reply below if you still need help.
        </Callout>
      );
    case "resolved":
      return (
        <>
          <Callout tone="success" icon={<CircleCheckIcon size={20} />} title="Request resolved">
            Glad that’s sorted. This request is closed, so start a new one if you need more help.
          </Callout>
          {actions}
        </>
      );
    case "fixed":
      return (
        <>
          <Callout tone="success" icon={<CircleCheckIcon size={20} />} title="Fixed">
            Thanks for reporting it. The problem is fixed. If you still see it, send a new report.
          </Callout>
          {actions}
        </>
      );
    case "cant_reproduce":
      return (
        <>
          <Callout
            tone="neutral"
            icon={<HelpCircleIcon size={20} />}
            title="We couldn’t reproduce this"
          >
            It worked for us. Send a new report with your browser and device so we can look deeper.
          </Callout>
          {actions}
        </>
      );
  }
}
