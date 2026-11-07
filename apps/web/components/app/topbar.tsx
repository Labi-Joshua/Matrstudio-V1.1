"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, type RefObject, useEffect, useRef, useState } from "react";
import { currentLabel } from "../../lib/app/nav";
import { ROUTES } from "../../lib/routes";
import { MenuIcon, SearchIcon, UploadIcon } from "./icons";
import { NotificationsBell } from "./notifications";
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
  const pathname = usePathname();
  return (
    <nav aria-label="Breadcrumb">
      <ol className="m-0 flex list-none items-center gap-1 p-0 text-[14px] leading-5 tracking-[-0.14px]">
        <li className="text-text-secondary">Learn</li>
        <li aria-hidden="true" className="px-1 text-text-tertiary">
          /
        </li>
        <li aria-current="page" className="text-text">
          {currentLabel(pathname)}
        </li>
      </ol>
    </nav>
  );
}

/** A visual search field: submitting goes to the library with the text as ?q= (no in-app search yet). */
function SearchField() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `${ROUTES.library}?q=${encodeURIComponent(q)}` : ROUTES.library);
  }

  return (
    <search className="hidden h-10 w-[320px] items-center gap-2 rounded-[10px] border border-border-soft bg-bg-base px-3 focus-within:border-primary-border xl:flex">
      <form onSubmit={submit} className="contents">
        <SearchIcon size={18} className="shrink-0 text-text-tertiary" />
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search paths and resources"
          aria-label="Search paths and resources"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-text leading-5 tracking-[-0.14px] outline-none placeholder:text-text-tertiary"
        />
        <span
          aria-hidden="true"
          className="rounded-md border border-border-soft bg-bg-fill2 px-1.5 py-0.5 font-medium font-sans text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]"
        >
          ⌘K
        </span>
      </form>
    </search>
  );
}

const ICON_BUTTON = `flex size-10 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary hover:text-text ${FOCUS}`;

function SearchLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href={ROUTES.library}
      aria-label="Search the library"
      className={`${ICON_BUTTON} ${className}`}
    >
      <SearchIcon size={20} />
    </Link>
  );
}

export function DesktopTopBar() {
  return (
    <header className="hidden items-center gap-4 py-[18px] pr-8 pl-12 md:flex">
      <div className="min-w-0 flex-1">
        <Breadcrumb />
      </div>
      <SearchField />
      <SearchLink className="xl:hidden" />
      <Link
        href={ROUTES.submit}
        className={`btn-lift hidden h-10 items-center gap-1.5 rounded-lg border border-border bg-bg-base px-3 font-medium text-[14px] text-text leading-5 tracking-[-0.14px] shadow-e1 xl:flex ${FOCUS}`}
      >
        <UploadIcon size={20} />
        Submit a resource
      </Link>
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
      <SearchLink />
      <NotificationsBell />
    </header>
  );
}
