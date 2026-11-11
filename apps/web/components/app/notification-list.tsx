import Link from "next/link";
import type { ReactNode } from "react";
import {
  FILTER_LABEL,
  groupNotifications,
  type NotificationFilter,
  type NotificationItem,
  type NotificationKind,
  relativeTime,
} from "../../lib/app/notifications";
import {
  AlertCircleIcon,
  CircleCheckIcon,
  HelpCircleIcon,
  InboxIcon,
  MessageIcon,
  RouteIcon,
  WrenchIcon,
} from "./icons";
import { FOCUS } from "./ui";

/**
 * The pieces of the notifications panel (Figma "Notifications panel", its loading, empty and
 * error states): filter tabs, the grouped list with unread dots, and the three non-list states.
 * Pure view components: the feed and its state live in notifications.tsx.
 */

const KIND_LOOK: Record<NotificationKind, { icon: typeof RouteIcon; tone: string }> = {
  "curator-approved": { icon: CircleCheckIcon, tone: "bg-success-focus text-success-text" },
  "curator-changes": { icon: AlertCircleIcon, tone: "bg-warning-focus text-warning-text" },
  "curator-declined": { icon: AlertCircleIcon, tone: "bg-bg-fill2 text-text-secondary" },
  "new-lesson": { icon: RouteIcon, tone: "bg-primary-focus text-primary-text" },
  "path-reminder": { icon: RouteIcon, tone: "bg-primary-focus text-primary-text" },
  "support-reply": { icon: MessageIcon, tone: "bg-bg-fill2 text-text-secondary" },
  "report-fixed": { icon: WrenchIcon, tone: "bg-success-focus text-success-text" },
  "report-cant-reproduce": { icon: HelpCircleIcon, tone: "bg-bg-fill2 text-text-secondary" },
};

export function NotificationRow({
  item,
  now,
  onOpen,
}: {
  item: NotificationItem;
  now: Date;
  onOpen?: (id: string) => void;
}) {
  const { icon: Icon, tone } = KIND_LOOK[item.kind];
  const body = (
    <>
      <span
        aria-hidden="true"
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone}`}
      >
        <Icon size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium text-[16px] text-text leading-6 tracking-[-0.16px]">
          {item.title}
        </span>
        <span className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
          {item.body}
        </span>
        <span className="pt-0.5 text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
          {relativeTime(item.createdAt, now)}
        </span>
      </span>
      {item.read ? null : (
        <span className="mt-2 size-2 shrink-0 rounded-full bg-primary">
          <span className="sr-only">Unread</span>
        </span>
      )}
    </>
  );
  const row = `flex w-full items-start gap-3.5 rounded-xl px-3 py-3 text-left ${
    item.read ? "" : "bg-bg-fill1"
  }`;
  if (item.href) {
    return (
      <Link
        href={item.href}
        onClick={() => onOpen?.(item.id)}
        className={`${row} hover:bg-bg-fill2 ${FOCUS}`}
      >
        {body}
      </Link>
    );
  }
  return <div className={row}>{body}</div>;
}

export function NotificationList({
  items,
  now,
  onOpen,
  plain = false,
}: {
  items: readonly NotificationItem[];
  now: Date;
  onOpen?: (id: string) => void;
  /** One list without the Today / Earlier headings (Home's "While you were away"). */
  plain?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 px-2 pb-3">
      {(plain
        ? [{ label: "Notifications", items: [...items] }]
        : groupNotifications(items, now)
      ).map((group) => (
        <section key={group.label} aria-label={group.label} className="flex flex-col gap-1">
          {plain ? null : (
            <h3 className="px-3 pt-3 pb-1 font-medium text-[12px] text-text-tertiary uppercase leading-4 tracking-[0.6px]">
              {group.label}
            </h3>
          )}
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {group.items.map((item) => (
              <li key={item.id}>
                <NotificationRow item={item} now={now} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const FILTERS: readonly NotificationFilter[] = ["all", "unread", "submissions"];

export function NotificationFilters({
  filter,
  unread,
  onChange,
}: {
  filter: NotificationFilter;
  unread: number;
  onChange: (next: NotificationFilter) => void;
}) {
  return (
    <fieldset className="m-0 flex min-w-0 gap-2 border-0 px-4 pt-0 pb-2">
      <legend className="sr-only">Filter notifications</legend>
      {FILTERS.map((value) => {
        const active = filter === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={`h-8 rounded-full border px-3.5 font-medium text-[14px] leading-5 tracking-[-0.14px] ${FOCUS} ${
              active
                ? "border-text bg-text text-bg-base"
                : "border-border-soft bg-bg-base text-text-secondary hover:text-text"
            }`}
          >
            {FILTER_LABEL[value]}
            {value === "unread" && unread > 0 ? ` ${unread}` : ""}
          </button>
        );
      })}
    </fieldset>
  );
}

function StateBlock({
  icon,
  tone,
  title,
  children,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3.5 px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className={`flex size-16 items-center justify-center rounded-full ${tone}`}
      >
        {icon}
      </span>
      <p className="font-semibold text-[22px] text-text leading-8 tracking-[-0.22px]">{title}</p>
      {children}
    </div>
  );
}

const STATE_TEXT = "max-w-[340px] text-[14px] text-text-secondary leading-5 tracking-[-0.14px]";

export function NotificationsEmpty({ filter = "all" }: { filter?: NotificationFilter }) {
  const caughtUp = filter === "all";
  return (
    <StateBlock
      tone="border-[1.5px] border-border border-dashed bg-bg-fill1 text-text-secondary"
      icon={<InboxIcon size={28} />}
      title={caughtUp ? "You’re all caught up" : `No ${FILTER_LABEL[filter].toLowerCase()}`}
    >
      <p className={STATE_TEXT}>
        {caughtUp
          ? "We’ll let you know when a curator replies or a path you’re on changes."
          : "Nothing here right now. Switch to All to see everything."}
      </p>
    </StateBlock>
  );
}

export function NotificationsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert">
      <StateBlock
        tone="bg-primary-focus text-primary-text"
        icon={<InboxIcon size={28} />}
        title="Notifications didn’t load"
      >
        <p className={STATE_TEXT}>Check your connection and try again.</p>
        <button
          type="button"
          onClick={onRetry}
          className={`btn-lift inline-flex h-10 items-center rounded-lg bg-text px-4 font-medium text-[14px] text-bg-base leading-5 ${FOCUS}`}
        >
          Try again
        </button>
      </StateBlock>
    </div>
  );
}

/** Loading placeholder (Figma "Notifications: loading"): two groups of two grey rows. */
export function NotificationsLoading() {
  const bar = "rounded-md bg-bg-fill2 motion-safe:animate-pulse";
  return (
    <div className="flex flex-col gap-1 px-2 pb-3">
      <p role="status" className="sr-only">
        Loading notifications
      </p>
      {[2, 2].map((rows, group) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder groups
        <div key={group} aria-hidden="true" className="flex flex-col gap-0.5">
          <div className={`${bar} mx-3 mt-3 mb-1 h-3 w-12`} />
          {Array.from({ length: rows }, (_, row) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
            <div key={row} className={`${bar} h-[110px] rounded-xl`} />
          ))}
        </div>
      ))}
    </div>
  );
}
