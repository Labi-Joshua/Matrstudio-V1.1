import Link from "next/link";
import type { ReactNode, Ref } from "react";
import { FOCUS } from "../app/ui";
import { StateArt } from "./art";

/** Button looks shared by the Library and Saved screens (same as the Home dashboard's). */
export const BTN_PRIMARY = `btn-lift inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 font-medium text-[14px] text-static-white leading-5 tracking-[-0.14px] ${FOCUS}`;
export const BTN_SECONDARY = `btn-lift inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-base px-3 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] shadow-e1 ${FOCUS}`;
export const BTN_DISABLED =
  "inline-flex h-10 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-border-soft bg-bg-fill1 px-3 font-medium text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]";

export const H1 =
  "font-medium text-[30px] text-text leading-9 tracking-[-0.6px] md:text-[34px] md:leading-10 md:tracking-[-0.68px]";

export function PageHeader({
  title,
  intro,
  aside,
  headingRef,
}: {
  title: ReactNode;
  intro?: ReactNode;
  aside?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <h1
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className={`${H1} outline-none`}
        >
          {title}
        </h1>
        {aside}
      </div>
      {intro ? (
        <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">{intro}</p>
      ) : null}
    </header>
  );
}

/** Centred empty / error block: illustration, title, one line of help, then the actions. */
export function StateBlock({
  glyph,
  title,
  body,
  children,
  role,
}: {
  glyph: "saved" | "filter" | "search" | "alert";
  title: string;
  body: string;
  children?: ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <div
      role={role}
      className="mx-auto flex max-w-[420px] flex-col items-center gap-3 px-2 py-16 text-center md:py-24"
    >
      <StateArt glyph={glyph} />
      <div className="flex flex-col gap-1 pt-2">
        <h2 className="font-medium text-[16px] text-text leading-6 tracking-[-0.16px]">{title}</h2>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">{body}</p>
      </div>
      {children ? <div className="flex flex-wrap justify-center gap-2 pt-2">{children}</div> : null}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 self-start rounded-md text-[14px] text-text-secondary leading-5 tracking-[-0.14px] hover:text-text ${FOCUS}`}
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {children}
    </Link>
  );
}
