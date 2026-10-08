"use client";

import { cn } from "@matr/ui";
import { useEffect, useState } from "react";

/**
 * "On this page" list (Figma _Tab Menu V). Highlights the section currently being read: the
 * last heading that has scrolled past the sticky navbar.
 */
export function LegalToc({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    const update = () => {
      // 120px: below the sticky navbar (16px offset + 60px bar + breathing room).
      let current = sections[0]?.id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 120) current = section.id;
      }
      // At the very bottom the last sections may never reach the line; pick the last one.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = sections.at(-1)?.id;
      }
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);

  return (
    <nav aria-label="On this page" className="flex flex-col gap-2">
      <p className="font-medium text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
        On this page
      </p>
      <ul className="flex flex-col">
        {items.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={active === id ? "location" : undefined}
              className={cn(
                "block border-l-2 px-3.5 py-2.5 font-display font-medium text-sm leading-5 tracking-[-0.14px] transition-colors duration-300 ease-smooth",
                active === id
                  ? "border-primary bg-primary-accent text-text"
                  : "border-transparent text-text-secondary hover:bg-bg-fill1 hover:text-text",
              )}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
