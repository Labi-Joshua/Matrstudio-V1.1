"use client";

import { useEffect } from "react";

/**
 * Makes the hero cursors drift toward the visitor's pointer while it is over the hero: the closer
 * a cursor is, the harder it leans in, up to ~28px, and they settle back when the pointer leaves.
 * Only on devices with a hover-capable pointer and no reduced-motion preference.
 */
const REACH = 520;
const MAX_PULL = 28;

export function HeroPointer() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
    const hero = document.querySelector<HTMLElement>("[data-hero]");
    if (!hero) return;
    const cursors = [...hero.querySelectorAll<HTMLElement>("[data-cursor]")];
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;

    const update = () => {
      frame = 0;
      for (const cursor of cursors) {
        if (!pointer || cursor.offsetParent === null) {
          cursor.style.setProperty("--px", "0px");
          cursor.style.setProperty("--py", "0px");
          continue;
        }
        const rect = cursor.getBoundingClientRect();
        const dx = pointer.x - (rect.left + 7);
        const dy = pointer.y - (rect.top + 11);
        const distance = Math.hypot(dx, dy) || 1;
        const pull = Math.max(0, 1 - distance / REACH) * MAX_PULL;
        cursor.style.setProperty("--px", `${((dx / distance) * pull).toFixed(1)}px`);
        cursor.style.setProperty("--py", `${((dy / distance) * pull).toFixed(1)}px`);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const onLeave = () => {
      pointer = null;
      schedule();
    };

    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return null;
}
