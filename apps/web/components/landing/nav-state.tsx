"use client";

import { useEffect } from "react";

/** Marks the sticky nav as data-stuck once the page has scrolled, so it can tighten up. */
export function NavState() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-nav]");
    if (!header) return;
    const update = () => {
      if (scrollY > 8) header.setAttribute("data-stuck", "");
      else header.removeAttribute("data-stuck");
    };
    update();
    addEventListener("scroll", update, { passive: true });
    return () => removeEventListener("scroll", update);
  }, []);
  return null;
}
