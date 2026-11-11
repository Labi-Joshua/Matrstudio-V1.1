"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { dayMonth, metaLine, topicChips } from "../../lib/app/profile-view";
import {
  publicLinkHref,
  publicLinkText,
  publicProfilePath,
} from "../../lib/app/profile-visibility";
import { STATUS_PRESENTATION, type StatusTone, submissionDetail } from "../../lib/app/submit-state";
import { hostLabel } from "../../lib/app/submit-url";
import type { PublicSubmission } from "../../lib/auth/profile-api";
import type { Submission } from "../../lib/auth/submissions-api";
import { CircleCheckIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { ProfileAvatar } from "./profile-avatar";
import { CopyIcon, ExternalLinkIcon, UserIcon } from "./profile-icons";

export const CARD = "rounded-2xl border border-border-soft bg-bg-base";

/** Name, @username, level and join month, bio and interests (own view and visitor view). */
export function ProfileCard({
  displayName,
  username,
  level,
  joinedAt,
  bio,
  topics,
  avatarUrl,
  visitor = false,
  badge,
  action,
}: {
  displayName: string;
  username: string;
  level: string | null;
  joinedAt: string;
  bio: string;
  topics: readonly string[];
  avatarUrl: string | null;
  visitor?: boolean;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  const chips = topicChips(topics);
  return (
    <section aria-label="About" className={`${CARD} flex flex-col gap-4 p-5 md:flex-row md:p-6`}>
      <ProfileAvatar url={avatarUrl} name={displayName} size={80} className="max-md:size-16" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="break-words font-medium text-[26px] text-text leading-8 tracking-[-0.52px] md:text-[30px] md:leading-9 md:tracking-[-0.6px]">
            {displayName}
          </h1>
          {badge}
        </div>
        <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          {metaLine({ username, level, joinedAt, visitor })}
        </p>
        {bio ? (
          <p className="max-w-[620px] whitespace-pre-line break-words text-[15px] text-text-secondary leading-[22px] tracking-[-0.15px]">
            {bio}
          </p>
        ) : null}
        {chips.length > 0 ? (
          <ul aria-label="Interests" className="mt-1 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <li
                key={chip}
                className="rounded-md bg-bg-fill2 px-2 py-0.5 text-[12px] text-text-secondary leading-4 tracking-[-0.12px]"
              >
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}

export function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-[3px] font-medium text-[13px] leading-[18px] tracking-[-0.13px] ${
        isPublic ? "bg-success-focus text-success-text" : "bg-bg-fill2 text-text-secondary"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${isPublic ? "bg-success-text" : "bg-text-tertiary"}`}
      />
      {isPublic ? "Public" : "Private"}
    </span>
  );
}

/** The "Public profile" row with its switch. The switch asks `onChange` for the new state; the screen decides. */
export function PublicRow({
  isPublic,
  text,
  pending,
  onChange,
}: {
  isPublic: boolean;
  text: string;
  pending: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <section
      aria-label="Public profile"
      className={`flex items-center gap-3 rounded-xl border p-3 ${
        isPublic ? "border-primary-border bg-primary-accent" : "border-border-soft bg-bg-base"
      }`}
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bg-fill1 text-text-secondary"
      >
        <UserIcon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p
          id="public-profile-label"
          className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]"
        >
          Public profile
        </p>
        <p className="text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">{text}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isPublic}
        aria-labelledby="public-profile-label"
        aria-busy={pending || undefined}
        onClick={() => {
          if (!pending) onChange(!isPublic);
        }}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${FOCUS} ${
          isPublic ? "bg-primary" : "bg-bg-fill3"
        } ${pending ? "opacity-60" : ""}`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-static-white shadow-e1 transition-transform motion-reduce:transition-none ${
            isPublic ? "translate-x-4" : ""
          }`}
        />
      </button>
    </section>
  );
}

/** "Your profile is live at ..." with Copy link and Preview as a visitor (Figma "Public profile: live"). */
export function LiveBanner({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicLinkHref(window.location.origin, username));
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard can be blocked; the link is on screen to copy by hand.
    }
  }

  const action = `inline-flex items-center gap-1.5 rounded-sm font-medium text-[13px] text-success-text leading-[18px] tracking-[-0.13px] hover:underline ${FOCUS}`;
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-success-focus p-3.5">
      <span className="mt-0.5 shrink-0 text-success-text">
        <CircleCheckIcon size={18} />
      </span>
      <div className="min-w-0">
        <p className="break-words font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
          Your profile is live at {publicLinkText(username)}
        </p>
        <p className="text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
          Share the link anywhere. You can turn it off at any time.
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <button type="button" onClick={copy} className={action}>
            <CopyIcon size={14} />
            {copied ? "Link copied" : "Copy link"}
          </button>
          {/* A plain link: /@name is served by the Worker, so the router must not handle it. */}
          <a href={publicProfilePath(username)} target="_blank" rel="noopener" className={action}>
            Preview as a visitor
            <ExternalLinkIcon size={14} />
          </a>
          <span role="status" className="sr-only">
            {copied ? "Link copied to the clipboard" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

export function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-medium text-[18px] text-text leading-7 tracking-[-0.18px]">{title}</h2>
      {href && linkLabel ? (
        <Link
          href={href}
          className={`rounded-sm text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px] hover:text-text ${FOCUS}`}
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

const TONE: Record<StatusTone, string> = {
  amber: "bg-warning-focus text-warning-text",
  green: "bg-success-focus text-success-text",
  orange: "bg-primary-focus text-primary-text",
  red: "bg-error-focus text-error-text",
};

/** Only https links are ever rendered as links, whatever the API returned. */
const isHttps = (url: string) => url.startsWith("https://");

function ResourceRow({
  title,
  detail,
  badge,
  href,
}: {
  title: string;
  detail: string;
  badge: ReactNode;
  href: string | null;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border-soft bg-bg-base py-3 pr-3.5 pl-3.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
          {title}
        </p>
        <p className="truncate text-[12px] text-text-secondary leading-4 tracking-[-0.12px]">
          {detail}
        </p>
      </div>
      {badge}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${title} (opens in a new tab)`}
          className={`flex size-8 shrink-0 items-center justify-center rounded-md text-primary-text hover:bg-bg-fill1 ${FOCUS}`}
        >
          <ExternalLinkIcon size={16} />
        </a>
      ) : null}
    </li>
  );
}

const APPROVED_BADGE = (
  <span
    className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-[3px] font-medium text-[13px] leading-[18px] tracking-[-0.13px] ${TONE.green}`}
  >
    <span aria-hidden="true" className="size-1.5 rounded-full bg-success-text" />
    Approved
  </span>
);

/** The learner's own submissions (any status), newest first. Plain text only. */
export function OwnSubmissions({
  rows,
  topicName,
}: {
  rows: readonly Submission[];
  topicName: (slug: string | null) => string | null;
}) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {rows.map((row) => {
        const { label, tone } = STATUS_PRESENTATION[row.status];
        return (
          <ResourceRow
            key={row.id}
            title={row.title?.trim() || hostLabel(row.url)}
            detail={submissionDetail(row, topicName(row.topic))}
            href={isHttps(row.url) ? row.url : null}
            badge={
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-[3px] font-medium text-[13px] leading-[18px] tracking-[-0.13px] ${TONE[tone]}`}
              >
                {label}
              </span>
            }
          />
        );
      })}
    </ul>
  );
}

/** Approved submissions on a public profile. */
export function PublicSubmissions({ rows }: { rows: readonly PublicSubmission[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {rows.map((row) => (
        <ResourceRow
          key={row.url}
          title={row.title}
          detail={row.approvedAt ? `Approved ${dayMonth(row.approvedAt)}` : "Approved"}
          href={isHttps(row.url) ? row.url : null}
          badge={APPROVED_BADGE}
        />
      ))}
    </ul>
  );
}

/** A quiet box for a section that has nothing to show yet. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-border-soft border-dashed px-4 py-5 text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
      {children}
    </p>
  );
}
