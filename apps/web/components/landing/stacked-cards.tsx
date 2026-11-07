"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * Drives the stacked-cards effect on the Features rows. The cards are CSS-sticky (see .stack-card
 * in globals.css), so each one slides up over the previous. This sets two custom properties:
 *
 * --stick  where the card pins. Normally just under the nav, a little lower for each later card so
 *          the earlier ones peek out. A card taller than the space under the nav (every row on a
 *          phone, or on a short window) pins with its bottom edge at the bottom of the screen
 *          instead, so its end is never hidden: its top has been read as it scrolled past, and the
 *          next card slides up over it.
 * --t      0 to 1, how far the next card has covered this one; the CSS shrinks and dims it by that.
 *
 * Off for reduced motion, where the rows are a plain list.
 */
const STACKING = "(prefers-reduced-motion: no-preference)";
/** Height of the sticky nav once the page has scrolled (see nav.tsx): desktop pill vs phone pill. */
const NAV_STUCK = { desktop: 87, mobile: 79 };
const GAP = 16;
const PEEK = 10;
const SHRINK = 0.05;

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
      if (!query.matches) {
        for (const card of cards) {
          card.style.removeProperty("--stick");
          card.style.setProperty("--t", "0");
        }
        return;
      }
      const navHeight = innerWidth >= 1024 ? NAV_STUCK.desktop : NAV_STUCK.mobile;

      // Pass 1: where each card pins. Its natural height is its rect divided by the current scale.
      cards.forEach((card, index) => {
        const scale = 1 - SHRINK * Number(card.style.getPropertyValue("--t") || 0);
        const height = card.getBoundingClientRect().height / scale;
        const stick = Math.min(navHeight + GAP + index * PEEK, innerHeight - height - GAP);
        card.style.setProperty("--stick", `${stick.toFixed(1)}px`);
      });

      // Pass 2: how far the next card has covered each one. It starts covering when the next
      // card's top meets this card's bottom, and has fully stacked at the next card's pin.
      cards.forEach((card, index) => {
        const next = cards[index + 1];
        if (!next) {
          card.style.setProperty("--t", "0");
          return;
        }
        const rect = card.getBoundingClientRect();
        const start = rect.bottom;
        const end = Number.parseFloat(next.style.getPropertyValue("--stick"));
        const nextTop = next.getBoundingClientRect().top;
        const span = start - end;
        const t = span > 1 ? Math.min(1, Math.max(0, (start - nextTop) / span)) : 0;
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
