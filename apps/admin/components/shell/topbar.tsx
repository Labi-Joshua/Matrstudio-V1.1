"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RefObject } from "react";
import { breadcrumbs } from "../../lib/nav/breadcrumbs";
import { ADMIN_ROUTES } from "../../lib/nav/routes";
import { useAdminSession } from "../../lib/session/provider";
import { ICON_BUTTON } from "../ui/button";
import { FOCUS } from "../ui/focus";
import { MenuIcon, SearchIcon } from "../ui/icons";
import { NotificationsBell } from "./notifications";
import { useOverlays } from "./overlays";
import { ProfileMenu } from "./profile-menu";
import { WORDMARK_LABEL, Wordmark } from "./wordmark";

/**
 * Breadcrumb: every level is a link except the page you are on ("Overview / Metrics / Learners").
 */
export function Breadcrumb() {
  const { me } = useAdminSession();
  const crumbs = breadcrumbs(usePathname(), me);
  return (
    <nav aria-label="Breadcrumb">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0 text-[14px] leading-5 tracking-[-0.14px]">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.href ?? crumb.label} className="flex items-center gap-1">
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

/** The search field (xl): a button that looks like an input; pressing it opens the palette. */
function SearchField() {
  const { openPalette } = useOverlays();
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-haspopup="dialog"
      aria-label="Search users, resources and paths"
      className={`hidden h-10 w-[320px] items-center gap-2 rounded-[10px] border border-border-soft bg-bg-base px-3 text-left hover:border-border xl:flex ${FOCUS}`}
    >
      <SearchIcon size={18} className="shrink-0 text-text-tertiary" />
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]">
        Search users, resources, paths
      </span>
      <span
        aria-hidden="true"
        className="rounded-md border border-border-soft bg-bg-fill2 px-1.5 py-0.5 font-medium text-[12px] text-text-tertiary leading-4"
      >
        ⌘K
      </span>
    </button>
  );
}

function SearchButton({ className = "" }: { className?: string }) {
  const { openPalette } = useOverlays();
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-haspopup="dialog"
      aria-label="Search users, resources and paths"
      className={`${ICON_BUTTON} ${className}`}
    >
      <SearchIcon size={20} />
    </button>
  );
}

/** Top bar from md up: breadcrumb left; search, notifications and profile right. */
export function DesktopTopBar() {
  return (
    <header className="hidden h-[76px] shrink-0 items-center gap-3 pr-6 pl-12 md:flex">
      <div className="min-w-0 flex-1">
        <Breadcrumb />
      </div>
      <SearchField />
      <SearchButton className="xl:hidden" />
      <NotificationsBell />
      <ProfileMenu />
    </header>
  );
}

/** Phone bar: menu button, logo, search, bell. */
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
        href={ADMIN_ROUTES.dashboard}
        aria-label={WORDMARK_LABEL}
        className={`flex flex-1 items-center rounded-md ${FOCUS}`}
      >
        <Wordmark />
      </Link>
      <SearchButton />
      <NotificationsBell />
    </header>
  );
}
