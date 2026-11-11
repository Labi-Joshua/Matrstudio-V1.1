"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SETTINGS_SECTIONS, sectionFromPath } from "../../lib/app/settings-nav";
import { FOCUS } from "../app/ui";
import { PageHeader } from "../app-library/ui";
import { SettingsToastProvider } from "./toast";

/**
 * /settings/*: the title, then the section menu beside the content (a left column from md up,
 * as in the desktop and tablet frames) or as a row of tabs on phones. Each section is its own
 * route, so the browser's back button and reload keep the place.
 */
export function SettingsShell({ children }: { children: ReactNode }) {
  const current = sectionFromPath(usePathname());
  return (
    <SettingsToastProvider>
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        <PageHeader
          title="Settings"
          intro="Manage your account, notifications, learning preferences and privacy."
        />
        <div className="flex flex-col gap-6 md:flex-row md:gap-10 xl:gap-10">
          <nav
            aria-label="Settings sections"
            className="-mx-5 overflow-x-auto px-5 shadow-[inset_0_-1px_0_var(--color-border-soft)] [scrollbar-width:none] md:mx-0 md:w-[240px] md:shrink-0 md:overflow-visible md:px-0 md:shadow-none xl:w-[217px]"
          >
            <ul className="m-0 flex min-w-max list-none gap-5 p-0 md:min-w-0 md:flex-col md:gap-1">
              {SETTINGS_SECTIONS.map((section) => {
                const active = section.id === current;
                return (
                  <li key={section.id}>
                    <Link
                      href={section.href}
                      aria-current={active ? "page" : undefined}
                      className={`block whitespace-nowrap border-transparent border-b-2 py-3 text-[14px] leading-5 tracking-[-0.14px] md:rounded-lg md:px-3 md:py-2 ${FOCUS} ${
                        active
                          ? "border-primary font-medium text-primary-text md:border-transparent md:bg-primary-focus"
                          : "text-text-secondary hover:text-text md:hover:bg-bg-fill1"
                      }`}
                    >
                      {section.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="flex min-w-0 max-w-[632px] flex-1 flex-col gap-8">{children}</div>
        </div>
      </div>
    </SettingsToastProvider>
  );
}
