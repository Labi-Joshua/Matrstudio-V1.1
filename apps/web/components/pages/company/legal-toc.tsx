"use client";

import { useEffect, useState } from "react";

/**
 * "On this page" card (Figma "On this page" 780:27197): a mono label above the numbered section
 * links. The link of the section being read is shown in the brand colour: the last heading that
 * has scrolled past the sticky navbar.
 */
export function LegalToc({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    const update = () => {
      // 120px: just below the sticky navbar.
      let current = sections[0]?.id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 120) current = section.id;
      }
      // At the very bottom the last sections may never reach the line; pick the last one.
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) {
        current = sections.at(-1)?.id;
      }
      setActive(current);
    };
    update();
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    return () => {
      removeEventListener("scroll", update);
      removeEventListener("resize", update);
    };
  }, [items]);

  return (
    <nav
      aria-label="On this page"
      className="flex flex-col gap-2.5 rounded-2xl bg-bg-fill1 p-6 font-medium text-[14px] leading-5 tracking-[-0.14px]"
    >
      <p className="font-mono font-normal text-[11px] text-text-tertiary uppercase leading-[normal] tracking-[0.66px]">
        On this page
      </p>
      <ul className="flex flex-col gap-2.5">
        {items.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={active === id ? "location" : undefined}
              className={`block transition-colors hover:text-text ${
                active === id ? "text-primary" : "text-text-secondary"
              }`}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
