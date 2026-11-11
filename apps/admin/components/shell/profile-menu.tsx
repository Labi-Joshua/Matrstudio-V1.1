"use client";

import { useAdminSession } from "../../lib/session/provider";
import { Avatar } from "../ui/avatar";
import { FOCUS } from "../ui/focus";
import { usePopover } from "../ui/hooks";
import { ChevronDownIcon, LogOutIcon, SpinnerIcon } from "../ui/icons";
import { ThemeSwitch } from "../ui/theme";

/**
 * Profile content (Figma Nav 5): avatar, name, email, role badge, the Theme switch and Sign out.
 * ("My account" and "2-step and sessions" in the design have no screen yet, so they are not shown.)
 */
export function ProfileContent({ name = "Profile menu" }: { name?: string }) {
  const { me, signOut, signingOut, signOutError } = useAdminSession();
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Avatar me={me} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-[14px] text-text leading-5 tracking-[-0.14px]">
            {me.name}
          </p>
          <p className="truncate text-[12px] text-text-secondary leading-4">{me.email}</p>
        </div>
      </div>
      <div className="px-4 pb-3">
        <span className="rounded-md bg-primary-accent px-1.5 py-0.5 font-medium text-[12px] text-primary-text leading-4">
          {me.role.name}
        </span>
      </div>
      <div className="border-border-soft border-t px-4 py-3">
        <p className="pb-1.5 text-[12px] text-text-tertiary leading-4">Theme</p>
        <ThemeSwitch name={name} />
      </div>
      <div className="border-border-soft border-t p-2">
        <button
          type="button"
          onClick={signOut}
          aria-disabled={signingOut}
          className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[14px] text-text leading-5 tracking-[-0.14px] hover:bg-bg-fill2 ${FOCUS}`}
        >
          {signingOut ? <SpinnerIcon size={18} /> : <LogOutIcon size={18} />}
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        <p role="alert" className="px-2.5 text-[12px] text-error-text leading-4">
          {signOutError}
        </p>
      </div>
    </div>
  );
}

/** The avatar button in the top bar with its popover (Esc closes, outside click closes). */
export function ProfileMenu() {
  const { me } = useAdminSession();
  const { open, toggle, buttonRef, panelRef } = usePopover();
  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Profile menu for ${me.name}`}
        onClick={toggle}
        className={`flex h-10 items-center gap-1 rounded-full pr-1 pl-0.5 text-text-secondary hover:text-text ${FOCUS}`}
      >
        <Avatar me={me} size={36} />
        <ChevronDownIcon size={16} />
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="absolute top-12 right-0 z-40 w-[260px] rounded-xl border border-border-soft bg-bg-elevation-1 shadow-e2"
        >
          <ProfileContent />
        </div>
      ) : null}
    </div>
  );
}
