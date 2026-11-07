"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * Wrapper for the tile strips. The tiles run a looping wave animation (see .tile-anim in
 * globals.css); this flags the strip with data-live only while it is on screen, so the loop
 * is paused (and costs nothing) whenever the strip is scrolled out of view.
 */
export function AmbientStrip({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) el.setAttribute("data-live", "");
        else el.removeAttribute("data-live");
      },
      { rootMargin: "80px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className={className}>
      {children}
    </div>
  );
}
