"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * Makes floating badges drift toward the cursor (community arc, footer logo composition).
 * Writes --mx / --my (each -1..1, the cursor relative to this wrapper's centre) onto the wrapper,
 * eased every frame, while the pointer is anywhere in the enclosing section or footer. Each
 * badge turns them into a transform scaled by its own --depth, via the `parallax` class below.
 * No React state is touched per frame. Mouse/trackpad only, and off for reduced motion.
 */
export function CursorParallax({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const area = el?.closest<HTMLElement>("section, footer");
    if (!el || !area) return;
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frame = 0;

    const step = () => {
      // Ease ~12% of the remaining distance per frame: smooth follow, settles in ~0.5s.
      current.x += (target.x - current.x) * 0.12;
      current.y += (target.y - current.y) * 0.12;
      el.style.setProperty("--mx", current.x.toFixed(4));
      el.style.setProperty("--my", current.y.toFixed(4));
      const settled =
        Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(step);
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };

    const onMove = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      target.x = clamp((event.clientX - (box.left + box.width / 2)) / (box.width / 2));
      target.y = clamp((event.clientY - (box.top + box.height / 2)) / (box.height / 2));
      kick();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      kick();
    };

    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerleave", onLeave);
    return () => {
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
