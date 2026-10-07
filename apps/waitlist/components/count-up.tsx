"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Number that counts up from 0 the first time it scrolls into view. The server render (and
 * visitors who prefer reduced motion) get the final value, so it is never wrong without JS.
 */
export function CountUp({
  value,
  suffix = "",
  duration = 1800,
  delay = 0,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  /** ms to wait after it comes into view, to line up with the card's entrance. */
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    setShown(0);
    let frame = 0;
    let timer = 0;

    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - (1 - t) ** 4; // ease-out quart: quick start, long soft landing
        setShown(Math.round(value * eased));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        timer = window.setTimeout(run, delay);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value, duration, delay]);

  return (
    <span ref={ref} className="tabular-nums">
      {shown}
      {suffix}
    </span>
  );
}
