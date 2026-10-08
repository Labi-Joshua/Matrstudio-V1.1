"use client";

import { cn } from "@matr/ui";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/mission", label: "Our Mission" },
];

/**
 * Below sm the navbar links move into this menu. The panel drops down under the navbar (its
 * nearest positioned ancestor) on the navbar surface (solid, so the page behind stays out of the way). Closes on a link tap, Escape, a
 * tap outside, or when the window widens past sm.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (button.current?.contains(target) || panel.current?.contains(target)) return;
      setOpen(false);
    };
    const wide = matchMedia("(min-width: 40rem)");
    const onWide = () => wide.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    wide.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  const bar = "absolute left-1/2 h-[1.5px] w-4 -translate-x-1/2 rounded-full bg-text";

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((value) => !value)}
        className="relative size-10 shrink-0 rounded-full border border-border-soft bg-bg-base transition-colors duration-500 ease-smooth hover:border-border sm:hidden"
      >
        {/* Two bars that cross into an X when open. */}
        <span
          className={cn(
            bar,
            "top-1/2 transition-[translate,rotate] duration-500 ease-smooth",
            open ? "-translate-y-1/2 rotate-45" : "-translate-y-[4px]",
          )}
        />
        <span
          className={cn(
            bar,
            "top-1/2 transition-[translate,rotate] duration-500 ease-smooth",
            open ? "-translate-y-1/2 -rotate-45" : "translate-y-[2.5px]",
          )}
        />
      </button>

      <div
        ref={panel}
        id="mobile-menu"
        inert={!open}
        className={cn(
          "absolute inset-x-0 top-full mt-2 origin-top rounded-3xl border border-border-soft bg-bg-fill1 p-2 shadow-card transition-[opacity,translate,scale,visibility] duration-500 ease-smooth sm:hidden",
          open ? "visible opacity-100" : "invisible -translate-y-2 scale-[0.98] opacity-0",
        )}
      >
        <nav aria-label="Main" className="flex flex-col">
          {LINKS.map(({ href, label }) => {
            const current = pathname === href || pathname === `${href}/`;
            return (
              <a
                key={href}
                href={href}
                aria-current={current ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-2xl px-4 py-3 font-medium text-[15px] leading-5 tracking-[-0.15px] transition-colors duration-300 ease-smooth hover:bg-bg-fill2",
                  current ? "text-text" : "text-text-secondary",
                )}
              >
                {label}
              </a>
            );
          })}
        </nav>
        <div className="mx-4 my-1 h-px bg-border-soft" />
        <div className="flex items-center justify-between py-2 pr-2 pl-4">
          <span className="font-medium text-[15px] text-text-secondary tracking-[-0.15px]">
            Theme
          </span>
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
