"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiFailure } from "../../lib/api";
import {
  type AdminNotification,
  getNotifications,
  markAllNotificationsRead,
} from "../../lib/session/api";
import { useAdminSession } from "../../lib/session/provider";
import { isToday, relativeTime } from "../../lib/session/time";
import { ICON_BUTTON } from "../ui/button";
import { FOCUS } from "../ui/focus";
import { useMediaQuery, usePopover, useSkeletonGate } from "../ui/hooks";
import { BellIcon, CircleCheckIcon } from "../ui/icons";
import { Modal } from "../ui/modal";
import { Skeleton } from "../ui/skeleton";

type Load =
  | { status: "loading" }
  | { status: "ready"; items: AdminNotification[] }
  | { status: "error"; failure: ApiFailure };

/** Panel body: list with All / Unread chips, Today and Earlier groups, empty state, error + retry. */
function NotificationsPanel({
  onUnread,
  onNavigate,
  titled = true,
}: {
  onUnread: (n: number) => void;
  onNavigate: () => void;
  titled?: boolean;
}) {
  const { handleFailure } = useAdminSession();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [marking, setMarking] = useState(false);
  const showSkeleton = useSkeletonGate(load.status === "loading");

  const fetchAll = useCallback(async () => {
    const result = await getNotifications();
    if (result.ok) {
      setLoad({ status: "ready", items: result.data.notifications });
      onUnread(result.data.unread);
    } else if (!handleFailure(result)) setLoad({ status: "error", failure: result });
  }, [onUnread, handleFailure]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  async function markAll() {
    setMarking(true);
    const result = await markAllNotificationsRead();
    setMarking(false);
    if (result.ok) {
      setLoad((l) =>
        l.status === "ready"
          ? { status: "ready", items: l.items.map((n) => ({ ...n, read: true })) }
          : l,
      );
      onUnread(0);
    } else handleFailure(result);
  }

  const items = load.status === "ready" ? load.items : [];
  const shown = filter === "unread" ? items.filter((n) => !n.read) : items;
  const today = shown.filter((n) => isToday(n.createdAt));
  const earlier = shown.filter((n) => !isToday(n.createdAt));
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="flex max-h-[min(588px,80dvh)] flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        {titled ? (
          <h2 className="font-semibold text-[16px] text-text leading-6 tracking-[-0.16px]">
            Notifications
          </h2>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={markAll}
          aria-disabled={marking || unread === 0}
          className={`rounded-sm font-medium text-[13px] text-primary-text hover:underline aria-disabled:opacity-50 ${FOCUS}`}
        >
          Mark all as read
        </button>
      </div>
      <div className="flex gap-1.5 px-4 pb-2">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 font-medium text-[12px] leading-4 ${FOCUS} ${
              filter === f
                ? "border-ink bg-ink text-bg-base"
                : "border-border-soft bg-bg-base text-text-secondary hover:text-text"
            }`}
          >
            {f === "all" ? "All" : `Unread${unread > 0 ? ` ${unread}` : ""}`}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {load.status === "loading" ? (
          showSkeleton ? (
            <div aria-busy="true" className="flex flex-col gap-3 px-2 py-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-3/5" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : null
        ) : load.status === "error" ? (
          <div role="alert" className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <p className="font-medium text-[14px] text-text">We couldn’t load notifications</p>
            <p className="text-[13px] text-text-secondary">Try again in a moment.</p>
            <button
              type="button"
              onClick={() => {
                setLoad({ status: "loading" });
                void fetchAll();
              }}
              className={`mt-1 h-8 rounded-lg border border-border bg-bg-elevation-1 px-3 font-medium text-[13px] text-text ${FOCUS}`}
            >
              Try again
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
            <CircleCheckIcon size={24} className="text-text-tertiary" />
            <p className="mt-1 font-medium text-[15px] text-text leading-5">
              {filter === "unread" && items.length > 0
                ? "No unread notifications"
                : "You’re all caught up"}
            </p>
            <p className="text-[13px] text-text-secondary leading-[18px]">
              New submissions, reports and requests show up here.
            </p>
          </div>
        ) : (
          <>
            <Group label="Today" items={today} onNavigate={onNavigate} />
            <Group label="Earlier" items={earlier} onNavigate={onNavigate} />
          </>
        )}
      </div>
    </div>
  );
}

function Group({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: AdminNotification[];
  onNavigate: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label={label}>
      <h3 className="px-2 pt-2 pb-1 font-medium text-[11px] text-text-tertiary uppercase leading-4 tracking-[0.6px]">
        {label}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {items.map((n) => {
          const body = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
                  {n.title}
                </span>
                {n.body ? (
                  <span className="block text-[13px] text-text-secondary leading-[18px]">
                    {n.body}
                  </span>
                ) : null}
                <span className="block pt-0.5 text-[12px] text-text-tertiary leading-4">
                  {relativeTime(n.createdAt)}
                </span>
              </span>
              {n.read ? null : (
                <>
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                  />
                  <span className="sr-only">Unread</span>
                </>
              )}
            </>
          );
          const cls = `flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left ${FOCUS} ${n.read ? "" : "bg-bg-fill1"}`;
          return (
            <li key={n.id}>
              {n.href ? (
                <Link href={n.href} onClick={onNavigate} className={`${cls} hover:bg-bg-fill2`}>
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The bell (Figma Nav 6). Desktop and tablet: a 420px popover under the bell. Phone: a modal sheet
 * with a focus trap. The dot shows while anything is unread (count from /me, then from the panel).
 */
export function NotificationsBell() {
  const { me } = useAdminSession();
  const phone = useMediaQuery("(max-width: 767px)");
  const { open, setOpen, toggle, close, buttonRef, panelRef } = usePopover();
  const [unread, setUnread] = useState<number | null>(null);
  const count = unread ?? me.unreadNotifications;
  const lastMe = useRef(me.unreadNotifications);
  useEffect(() => {
    // A fresh /me answer is newer than what the panel last saw.
    if (lastMe.current !== me.unreadNotifications) {
      lastMe.current = me.unreadNotifications;
      setUnread(null);
    }
  }, [me.unreadNotifications]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
        onClick={toggle}
        className={`${ICON_BUTTON} relative`}
      >
        <BellIcon size={20} />
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 size-2 rounded-full border border-bg-base bg-primary"
          />
        ) : null}
      </button>
      {open && !phone ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          className="absolute top-12 right-0 z-40 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border-soft bg-bg-elevation-1 shadow-e2"
        >
          <NotificationsPanel onUnread={setUnread} onNavigate={() => setOpen(false)} />
        </div>
      ) : null}
      {open && phone ? (
        <Modal title="Notifications" icon={<BellIcon size={20} />} onClose={close} width={480}>
          <div className="-mx-5 -my-4">
            <NotificationsPanel
              titled={false}
              onUnread={setUnread}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
