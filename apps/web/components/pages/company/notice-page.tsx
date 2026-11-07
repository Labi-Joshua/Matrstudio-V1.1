import type { ReactNode } from "react";
import { ROUTES } from "../../../lib/routes";
import { FilledLink, OutlineLink } from "./page-buttons";

/**
 * A short message page for links that emails sent during the waitlist still point at
 * (/verified, /verify-already, /verify-expired, /verify-failed). The waitlist is closed, so they
 * just say what happened and send people on to the site. Not indexed.
 */
export function NoticePage({
  title,
  children,
  secondary,
}: {
  title: string;
  children: ReactNode;
  secondary?: { href: string; label: string };
}) {
  return (
    <main>
      <section className="px-5 lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center gap-6 border-border-soft border-r border-l px-4 py-24 text-center md:py-32 xl:py-44">
          <h1 className="max-w-[720px] font-medium text-[36px] text-text leading-[42px] tracking-[-0.02em] md:text-[52px] md:leading-[58px]">
            {title}
          </h1>
          <p className="max-w-[560px] text-[16px] text-text-secondary leading-6 tracking-[-0.16px] md:text-[18px] md:leading-7 md:tracking-[-0.18px]">
            {children}
          </p>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <FilledLink href={ROUTES.paths}>Explore paths</FilledLink>
            {secondary ? (
              <OutlineLink href={secondary.href}>{secondary.label}</OutlineLink>
            ) : (
              <OutlineLink href={ROUTES.home}>Back to home</OutlineLink>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
