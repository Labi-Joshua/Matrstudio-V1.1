"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Matches a CSS media query. The server snapshot is `false`; the shell only renders after the
 * session check, which runs in the browser, so nothing here is ever server rendered.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

/**
 * Open/close state for a disclosure popover (user menu, notifications, info tips). Escape closes
 * it and returns focus to the button, a press outside or Tab leaving it closes it without moving
 * focus. The panel is plain content, not role="menu": the button carries aria-expanded.
 */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (panelRef.current?.contains(target) || buttonRef.current?.contains(target));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointer = (event: PointerEvent) => {
      if (!inside(event.target)) setOpen(false);
    };
    const onFocus = (event: FocusEvent) => {
      if (!inside(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open, close]);

  return { open, setOpen, toggle, close, buttonRef, panelRef };
}

/** Browser connectivity (navigator.onLine plus the online/offline events). Assumed online on the server. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener("online", notify);
      window.addEventListener("offline", notify);
      return () => {
        window.removeEventListener("online", notify);
        window.removeEventListener("offline", notify);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/** A skeleton waits this long before showing, so fast responses never flash one. */
export const SKELETON_DELAY_MS = 150;
/** Once shown, a skeleton stays at least this long, so it never flickers away. */
export const SKELETON_MIN_MS = 300;

/** How much longer a skeleton shown at `shownAt` must stay up when the data arrived at `now`. */
export function skeletonRemainingMs(shownAt: number, now: number): number {
  return Math.max(0, SKELETON_MIN_MS - (now - shownAt));
}

/**
 * Whether to draw the skeleton for a request that is `pending`: false for the first
 * SKELETON_DELAY_MS, then true until the data has arrived and SKELETON_MIN_MS have passed.
 */
export function useSkeletonGate(pending: boolean): boolean {
  const [shown, setShown] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (pending) {
      if (shown) return;
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setShown(true);
      }, SKELETON_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (!shown) return;
    const timer = setTimeout(
      () => setShown(false),
      skeletonRemainingMs(shownAt.current, Date.now()),
    );
    return () => clearTimeout(timer);
  }, [pending, shown]);

  return shown;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Behaviour of a modal surface (phone menu, phone notifications sheet) while it is mounted: focus
 * moves into it, Tab stays inside, Escape closes it, the page behind does not scroll, and focus
 * goes back to whatever had it before (the button that opened it) when it unmounts.
 */
export function useModalSurface(
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  active = true,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [panelRef, active]);
}
