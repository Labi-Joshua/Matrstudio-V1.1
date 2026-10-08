"use client";

import { useEffect } from "react";

/**
 * Marks [data-reveal] elements with [data-revealed] the first time they scroll into view, which
 * starts their entrance animation (see globals.css). Each element is revealed once, then
 * unobserved. Content already on screen at load is revealed immediately (the hero's load-in).
 */
export function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement;
    const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");

    /** Longest delay + duration among the element's own entrance and its children's, in ms. */
    const entranceLength = (el: Element) => {
      let longest = 0;
      for (const node of [el, ...el.querySelectorAll("[data-reveal-child]")]) {
        const style = getComputedStyle(node);
        const delay =
          Number.parseFloat(style.animationDelay) *
          (style.animationDelay.endsWith("ms") ? 1 : 1000);
        const duration =
          Number.parseFloat(style.animationDuration) *
          (style.animationDuration.endsWith("ms") ? 1 : 1000);
        longest = Math.max(longest, (delay || 0) + (duration || 0));
      }
      return longest;
    };

    const reveal = (el: Element) => {
      el.setAttribute("data-revealed", "");
      // Release the will-change layers once every entrance inside this element has finished.
      window.setTimeout(() => el.setAttribute("data-reveal-done", ""), entranceLength(el) + 100);
    };

    if (!("IntersectionObserver" in window)) {
      targets.forEach(reveal);
      root.setAttribute("data-reveal-ready", "");
      return;
    }

    const pending = new Set<Element>(targets);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal(entry.target);
          observer.unobserve(entry.target);
          pending.delete(entry.target);
        }
      },
      // No bottom inset: the last elements on the page (the footer bar) can never scroll
      // higher than the bottom edge, so an inset would keep them hidden on tall screens.
      { threshold: 0.1 },
    );
    for (const el of targets) observer.observe(el);

    // Safety net: once the reader reaches the end of the page, show anything still waiting.
    const onScroll = () => {
      const atBottom = window.scrollY + window.innerHeight >= root.scrollHeight - 4;
      if (!atBottom) return;
      for (const el of pending) {
        reveal(el);
        observer.unobserve(el);
      }
      pending.clear();
      window.removeEventListener("scroll", onScroll);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    root.setAttribute("data-reveal-ready", "");

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
