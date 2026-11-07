"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * Drives the stacked-cards effect on the Features rows. The cards are CSS-sticky (see .stack-card
 * in globals.css), so each one slides up over the previous. This sets --t (0 to 1) on a card
 * while the next one covers it, and the CSS shrinks and dims it by that amount.
 * Only runs where the stacking CSS applies (wide and tall enough screens, no reduced motion);
 * everywhere else the rows are a plain list.
 */
const STACKING = "(min-width: 1280px) and (prefers-reduced-motion: no-preference)";

export function StackedCards({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const query = matchMedia(STACKING);
    const cards = [...container.querySelectorAll<HTMLElement>("[data-stack-card]")];
    let frame = 0;

    const update = () => {
      frame = 0;
      cards.forEach((card, index) => {
        const next = cards[index + 1];
        if (!query.matches || !next) {
          card.style.setProperty("--t", "0");
          return;
        }
        // The next card starts covering this one when its top meets this card's bottom, and has
        // fully stacked when it reaches its own sticky offset (a little below this card's top).
        const rect = card.getBoundingClientRect();
        const nextTop = next.getBoundingClientRect().top;
        const start = rect.top + rect.height;
        const end = rect.top + 14;
        const t = Math.min(1, Math.max(0, (start - nextTop) / (start - end)));
        card.style.setProperty("--t", t.toFixed(3));
      });
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    query.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      query.removeEventListener("change", schedule);
    };
  }, []);

  return <div ref={ref}>{children}</div>;
}
