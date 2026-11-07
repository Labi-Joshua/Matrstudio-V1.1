"use client";

import { useId } from "react";
import { displayName, levelBadge } from "../../lib/app/profile";
import { usePopover } from "./hooks";
import { ChevronDownIcon, ChevronRightIcon, LogOutIcon, SpinnerIcon } from "./icons";
import { useSession } from "./session";
import { Avatar, FOCUS, ThemeSwitch } from "./ui";

/**
 * Profile menu (Figma "Home / Desktop profile menu open"): avatar and chevron in the top bar
 * open a popover with who is signed in, the account rows, the theme choice and Sign out. The
 * profile stats and "View profile" from the frame are left out (no progress or profile screens
 * yet); the three account rows have no destination, so they render disabled with "Coming soon".
 */
const DISABLED_ROWS = [
  { label: "Account settings", hint: "Name, email and password" },
  { label: "Notification settings", hint: "Email and in-app alerts" },
  { label: "Learning preferences", hint: "Goal, level and topics" },
] as const;

export function UserMenu() {
  const { me, signOut, signingOut, signOutError } = useSession();
  const { open, toggle, buttonRef, panelRef } = usePopover();
  const panelId = useId();
  const level = levelBadge(me.onboarding.level);

  return (
    <div className="relative hidden md:block">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Account menu for ${displayName(me)}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={`flex items-center gap-2 rounded-full ${FOCUS}`}
      >
        <Avatar me={me} size={36} />
        <ChevronDownIcon size={16} className="text-text-tertiary" />
      </button>
      {open ? (
        <div
          id={panelId}
          ref={panelRef}
          className="absolute top-full right-0 z-50 mt-2 w-[330px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border-soft bg-bg-base shadow-card"
        >
          <div className="flex items-start gap-3 p-4">
            <Avatar me={me} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-[15px] text-text leading-5 tracking-[-0.15px]">
                {displayName(me)}
              </p>
              {me.name ? (
                <p className="truncate text-[13px] text-text-tertiary leading-[18px] tracking-[-0.13px]">
                  {me.email}
                </p>
              ) : null}
              {level ? (
                <span className="mt-1.5 inline-block rounded-md bg-success-focus px-1.5 py-0.5 font-medium text-[12px] text-success-text leading-4 tracking-[-0.12px]">
                  {level}
                </span>
              ) : null}
            </div>
          </div>
          <div className="border-border-soft border-t px-2 py-2">
            <p className="px-2 pt-1 pb-1.5 font-medium text-[12px] text-text-tertiary uppercase leading-4 tracking-[0.6px]">
              Account &amp; preferences
            </p>
            {DISABLED_ROWS.map((row) => (
              <button
                key={row.label}
                type="button"
                aria-disabled="true"
                title="Coming soon"
                onClick={(event) => event.preventDefault()}
                className={`flex w-full cursor-not-allowed items-center gap-2 rounded-lg px-2 py-2 text-left ${FOCUS}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]">
                    {row.label}
                    <span className="sr-only"> (coming soon)</span>
                  </span>
                  <span className="block text-[12px] text-text-tertiary leading-4 tracking-[-0.12px]">
                    {row.hint}
                  </span>
                </span>
                <ChevronRightIcon size={16} className="text-text-tertiary" />
              </button>
            ))}
          </div>
          <div className="border-border-soft border-t px-4 py-3">
            <p className="pb-2 font-medium text-[12px] text-text-tertiary uppercase leading-4 tracking-[0.6px]">
              Theme
            </p>
            <ThemeSwitch name="Menu" />
          </div>
          <div className="border-border-soft border-t p-2">
            <button
              type="button"
              onClick={signOut}
              aria-disabled={signingOut}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[16px] text-text-secondary leading-6 tracking-[-0.16px] hover:bg-bg-fill2 hover:text-text ${FOCUS}`}
            >
              {signingOut ? <SpinnerIcon size={20} /> : <LogOutIcon size={20} />}
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
            <p role="alert" className="px-3 text-[12px] text-error-text leading-4">
              {signOutError}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
