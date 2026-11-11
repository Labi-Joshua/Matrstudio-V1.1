"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RefObject } from "react";
import { breadcrumbs } from "../../lib/app/nav";
import { ROUTES } from "../../lib/routes";
import { MenuIcon, SearchIcon, UploadIcon } from "./icons";
import { NotificationsBell } from "./notifications";
import { useOverlays } from "./overlays";
import { Wordmark } from "./sidebar";
import { FOCUS } from "./ui";
import { UserMenu } from "./user-menu";

/**
 * Top bar (Figma "Top bar": breadcrumb, search field with the K shortcut, Submit a resource,
 * bell, profile menu). From md up it sits inside the content panel; on phones it is the separate
 * 66px bar with the menu button, logo, search and bell. Below xl the search field collapses to
 * an icon button, as in the tablet frames.
 */
export function Breadcrumb() {
  const crumbs = breadcrumbs(usePathname());
  return (
    <nav aria-label="Breadcrumb">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0 text-[14px] leading-5 tracking-[-0.14px]">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.label} className="flex items-center gap-1">
              {index > 0 ? (
                <span aria-hidden="true" className="px-1 text-text-tertiary">
                  /
                </span>
              ) : null}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className={`rounded text-text-secondary hover:text-text hover:underline ${FOCUS}`}
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "text-text" : "text-text-secondary"}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The search field (xl). It looks like an input but is a button: pressing it opens the command
 * palette (as does ⌘K / Ctrl+K), where the typing happens.
 */
function SearchField() {
  const { openPalette } = useOverlays();
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-haspopup="dialog"
      aria-label="Search paths and resources"
      className={`hidden h-10 w-[320px] items-center gap-2 rounded-[10px] border border-border-soft bg-bg-base px-3 text-left hover:border-border xl:flex ${FOCUS}`}
    >
      <SearchIcon size={18} className="shrink-0 text-text-tertiary" />
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]">
        Search paths and resources
      </span>
      <span
        aria-hidden="true"
        className="rounded-md border border-border-soft bg-bg-fill2 px-1.5 py-0.5 font-medium font-sans text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]"
      >
        ⌘K
      </span>
    </button>
  );
}

const ICON_BUTTON = `flex size-10 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary hover:text-text ${FOCUS}`;

function SearchButton({ className = "" }: { className?: string }) {
  const { openPalette } = useOverlays();
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-haspopup="dialog"
      aria-label="Search paths and resources"
      className={`${ICON_BUTTON} ${className}`}
    >
      <SearchIcon size={20} />
    </button>
  );
}

export function DesktopTopBar() {
  const { openSubmit } = useOverlays();
  return (
    <header className="hidden items-center gap-4 py-[18px] pr-8 pl-12 md:flex">
      <div className="min-w-0 flex-1">
        <Breadcrumb />
      </div>
      <SearchField />
      <SearchButton className="xl:hidden" />
      <button
        type="button"
        onClick={openSubmit}
        aria-haspopup="dialog"
        className={`btn-lift hidden h-10 items-center gap-1.5 rounded-lg border border-border bg-bg-base px-3 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] shadow-e1 xl:flex ${FOCUS}`}
      >
        <UploadIcon size={20} />
        Submit a resource
      </button>
      <NotificationsBell />
      <UserMenu />
    </header>
  );
}

export function PhoneBar({
  onOpenMenu,
  menuOpen,
  menuButtonRef,
  menuId,
}: {
  onOpenMenu: () => void;
  menuOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  menuId: string;
}) {
  return (
    <header className="flex h-[66px] shrink-0 items-center gap-3 px-4 md:hidden">
      <button
        ref={menuButtonRef}
        type="button"
        aria-label="Open menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={onOpenMenu}
        className={ICON_BUTTON}
      >
        <MenuIcon size={20} />
      </button>
      <Link
        href={ROUTES.dashboard}
        aria-label="Matr Studio home"
        className={`flex flex-1 items-center rounded-md ${FOCUS}`}
      >
        <Wordmark />
      </Link>
      <SearchButton />
      <NotificationsBell />
    </header>
  );
}
