import Link from "next/link";
import type { ReactNode } from "react";
import { HELP_EMAIL } from "../../lib/app/help-form";
import { ROUTES } from "../../lib/routes";
import { buttonClasses } from "../auth/button";
import { PageHeader } from "./fields";
import { BugIcon, MessageCircleIcon } from "./help-icons";
import { OfflineNotice } from "./offline-notice";

/**
 * Help centre hub (Figma Help centre 485:45143, desktop, tablet and mobile, light and dark; offline 671:76742): the header
 * and two option cards, Contact support and Report a problem, each opening its own in-app page.
 *
 * Not built: the "Your requests" list under the cards (support replies, "Support replied",
 * "Request resolved"). It needs a support-ticket API and notifications, neither of which exists
 * yet. When they do, add the list below the cards.
 */
function Option({
  icon,
  title,
  body,
  href,
  action,
  titleId,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  href: string;
  action: string;
  titleId: string;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col items-start gap-3 rounded-xl border border-border-soft bg-bg-base p-6"
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-xl bg-primary-focus text-primary-text"
      >
        {icon}
      </span>
      <h2
        id={titleId}
        className="mt-1 font-medium text-[20px] text-text leading-7 tracking-[-0.2px]"
      >
        {title}
      </h2>
      <p className="flex-1 text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">{body}</p>
      <div className="mt-2 w-full sm:w-fit">
        <Link href={href} className={buttonClasses("secondary")}>
          {action}
        </Link>
      </div>
    </section>
  );
}

export function HelpHub() {
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8">
      <OfflineNotice />
      <PageHeader
        title="Help centre"
        description="Get in touch with the team, or tell us when something isn’t working."
      />
      <div className="grid gap-4 md:grid-cols-2 md:gap-5">
        <Option
          titleId="help-contact-title"
          icon={<MessageCircleIcon size={24} />}
          title="Contact support"
          body="Questions about your account, paths, the library or your submissions. We reply by email within 2 working days."
          href={`${ROUTES.app.help}/contact`}
          action="Contact support"
        />
        <Option
          titleId="help-report-title"
          icon={<BugIcon size={24} />}
          title="Report a problem"
          body="Something broken, a dead link or content that looks wrong? Tell us and we’ll fix it."
          href={`${ROUTES.app.help}/report`}
          action="Report a problem"
        />
      </div>
      <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
        Prefer email? Write to{" "}
        <a
          href={`mailto:${HELP_EMAIL}`}
          className="rounded-sm font-medium text-text underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border"
        >
          {HELP_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
