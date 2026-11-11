"use client";

import { type RefObject, useCallback, useEffect, useId, useState } from "react";
import {
  filterNotifications,
  loadNotifications,
  markAllRead,
  markRead,
  type NotificationFilter,
  type NotificationItem,
  saveReadIds,
  unreadCount,
} from "../../lib/app/notifications";
import {
  useMediaQuery,
  useModalSurface,
  useOnlineStatus,
  usePopover,
  useSkeletonGate,
} from "./hooks";
import { ArrowLeftIcon, BellIcon } from "./icons";
import {
  NotificationFilters,
  NotificationList,
  NotificationsEmpty,
  NotificationsError,
  NotificationsLoading,
} from "./notification-list";
import { FOCUS } from "./ui";

/**
 * Bell and notifications (Figma "Notifications panel": a 420 wide popover from 768px, a full
 * screen sheet with a back button on phones). The feed has no API yet, so production shows the
 * designed "all caught up" state, the loading skeleton while the request is pending and the
 * "didn't load" state with Try again when it fails (offline); the bell only shows an unread dot
 * when there really is something unread.
 */
export type FeedState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: NotificationItem[] };

type Update = (change: (items: NotificationItem[]) => NotificationItem[]) => void;

function useNotificationFeed() {
  const online = useOnlineStatus();
  const [feed, setFeed] = useState<FeedState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the load on Try again
  useEffect(() => {
    let current = true;
    setFeed({ status: "loading" });
    loadNotifications(online).then((result) => {
      if (!current) return;
      setFeed(result.ok ? { status: "ready", items: result.items } : { status: "error" });
    });
    return () => {
      current = false;
    };
  }, [online, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const update: Update = useCallback((change) => {
    setFeed((state) => {
      if (state.status !== "ready") return state;
      const items = change(state.items);
      saveReadIds(items);
      return { status: "ready", items };
    });
  }, []);
  return { feed, retry, update };
}

/** The panel's contents for a feed state (header excluded), separate so it can be tested. */
export function NotificationsBody({
  feed,
  now,
  filter,
  onFilter,
  onRetry,
  onOpen,
}: {
  feed: FeedState;
  now: Date;
  filter: NotificationFilter;
  onFilter: (next: NotificationFilter) => void;
  onRetry: () => void;
  onOpen?: (id: string) => void;
}) {
  const showSkeleton = useSkeletonGate(feed.status === "loading");
  if (feed.status === "error") return <NotificationsError onRetry={onRetry} />;
  if (feed.status === "loading") {
    return (
      <div aria-busy="true">
        <NotificationFilters filter={filter} unread={0} onChange={onFilter} />
        {showSkeleton ? <NotificationsLoading /> : null}
      </div>
    );
  }
  if (feed.items.length === 0) return <NotificationsEmpty />;
  const shown = filterNotifications(feed.items, filter);
  return (
    <>
      <NotificationFilters filter={filter} unread={unreadCount(feed.items)} onChange={onFilter} />
      {shown.length === 0 ? (
        <NotificationsEmpty filter={filter} />
      ) : (
        <NotificationList items={shown} now={now} onOpen={onOpen} />
      )}
    </>
  );
}

const SURFACE =
  "fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg-base md:absolute md:inset-auto md:top-full md:right-0 md:mt-2 md:max-h-[min(628px,calc(100dvh-6rem))] md:w-[420px] md:max-w-[calc(100vw-2rem)] md:rounded-2xl md:border md:border-border-soft md:shadow-card";

function Panel({
  id,
  titleId,
  panelRef,
  phone,
  feed,
  onRetry,
  onUpdate,
  onClose,
}: {
  id: string;
  titleId: string;
  panelRef: RefObject<HTMLDivElement | null>;
  phone: boolean;
  feed: FeedState;
  onRetry: () => void;
  onUpdate: Update;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [now] = useState(() => new Date());
  const unread = feed.status === "ready" ? unreadCount(feed.items) : 0;
  // Only the phone sheet is modal; the popover leaves the page usable behind it.
  useModalSurface(panelRef, onClose, phone);

  const content = (
    <>
      <div className={`flex items-center gap-3 ${phone ? "px-3 py-3" : "px-5 pt-4 pb-3"}`}>
        {phone ? (
          <button
            type="button"
            aria-label="Close notifications"
            onClick={onClose}
            className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary hover:text-text ${FOCUS}`}
          >
            <ArrowLeftIcon size={20} />
          </button>
        ) : null}
        <h2
          id={titleId}
          className={`flex-1 font-semibold text-text leading-7 tracking-[-0.2px] ${phone ? "text-[22px]" : "text-[20px]"}`}
        >
          Notifications
        </h2>
        {unread > 0 ? (
          <button
            type="button"
            onClick={() => onUpdate(markAllRead)}
            className={`rounded-md font-medium text-[14px] text-primary-text leading-5 tracking-[-0.14px] hover:underline ${FOCUS}`}
          >
            Mark all as read
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NotificationsBody
          feed={feed}
          now={now}
          filter={filter}
          onFilter={setFilter}
          onRetry={onRetry}
          onOpen={(itemId) => {
            onUpdate((items) => markRead(items, itemId));
            onClose();
          }}
        />
      </div>
    </>
  );
  return phone ? (
    <div
      id={id}
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={SURFACE}
    >
      {content}
    </div>
  ) : (
    <section id={id} ref={panelRef} aria-labelledby={titleId} className={SURFACE}>
      {content}
    </section>
  );
}

export function NotificationsBell() {
  const { open, toggle, close, buttonRef, panelRef } = usePopover();
  const { feed, retry, update } = useNotificationFeed();
  const phone = useMediaQuery("(max-width: 767px)");
  const panelId = useId();
  const titleId = useId();
  const unread = feed.status === "ready" ? unreadCount(feed.items) : 0;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className={`relative flex size-10 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary hover:text-text ${FOCUS}`}
      >
        <BellIcon size={20} />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-2 right-2.5 size-2 rounded-full border border-bg-base bg-primary"
          />
        ) : null}
      </button>
      {open ? (
        <Panel
          id={panelId}
          titleId={titleId}
          panelRef={panelRef}
          phone={phone}
          feed={feed}
          onRetry={retry}
          onUpdate={update}
          onClose={close}
        />
      ) : null}
    </div>
  );
}
