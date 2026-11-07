"use client";

import { useEffect } from "react";

/**
 * Scroll reveal for the whole page, attached once from the layout. For every section after the
 * hero (and the footer) it marks the section's content blocks with data-reveal and flips
 * data-visible as they scroll into view; blocks that arrive in the same batch are staggered.
 * Blocks already on screen at load are shown at once, with no animation. The CSS lives in
 * globals.css. Nothing is attached for reduced motion, so the page is simply static then.
 */
function blocksOf(root: Element, out: Element[] = []): Element[] {
  for (const child of Array.from(root.children)) {
    // Blocks with their own scroll-driven motion (the stacked cards) opt out.
    if (child.hasAttribute("data-no-reveal")) continue;
    // A tall wrapper (a list of big rows, say) reveals row by row rather than all at once.
    if (child.children.length > 1 && child.getBoundingClientRect().height > innerHeight * 0.9) {
      blocksOf(child, out);
    } else {
      out.push(child);
    }
  }
  return out;
}

/** Sections hold their content in one or two single-child wrappers (the rail); look inside. */
function contentRoot(section: Element): Element {
  let root = section;
  for (let depth = 0; depth < 2; depth++) {
    const only = root.children.length === 1 ? root.children[0] : undefined;
    if (!(only instanceof HTMLDivElement)) break;
    root = only;
  }
  return root;
}

export function Reveal() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const sections = [...document.querySelectorAll("main > section:not(:first-child), footer")];
    const blocks = sections.flatMap((section) => blocksOf(contentRoot(section)));

    const observer = new IntersectionObserver(
      (entries) => {
        let order = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.style.setProperty("--reveal-delay", `${Math.min(order++, 5) * 80}ms`);
          el.setAttribute("data-visible", "");
          observer.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );

    for (const block of blocks) {
      block.setAttribute("data-reveal", "");
      if (block.getBoundingClientRect().top < innerHeight * 0.92) {
        block.setAttribute("data-visible", "");
      } else {
        observer.observe(block);
      }
    }

    return () => {
      observer.disconnect();
      for (const block of blocks) {
        block.removeAttribute("data-reveal");
        block.removeAttribute("data-visible");
      }
    };
  }, []);

  return null;
}
