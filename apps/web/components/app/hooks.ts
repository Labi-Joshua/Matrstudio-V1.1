"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

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
