"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useId, useState } from "react";
import { isNavActive, LEARN_NAV, type NavItem, SUPPORT_NAV } from "../../lib/app/nav";
import { displayName, levelBadge } from "../../lib/app/profile";
import { ROUTES } from "../../lib/routes";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LogOutIcon,
  NavGlyph,
  RouteIcon,
  SpinnerIcon,
} from "./icons";
import { useSession } from "./session";
import { Avatar, FOCUS, ThemeSwitch } from "./ui";

/**
 * Side navigation (Figma "Navigation and notification": Sidebar 320 wide, Sidebar (icon rail) 88
 * wide, Menu drawer 330 wide). One component, three variants:
 * - "full": logo, Learn group, Your paths, Support card (help, settings, theme, sign out).
 * - "rail": the same destinations as icon buttons with labels in aria-label and title.
 * - "drawer": the full content inside the phone menu, with the profile card on top.
 */
export type SidebarVariant = "full" | "rail" | "drawer";

const ITEM_BASE = `flex w-full items-center rounded-xl text-[16px] leading-6 tracking-[-0.16px] ${FOCUS}`;

function NavRow({
  item,
  variant,
  onNavigate,
}: {
  item: NavItem;
  variant: SidebarVariant;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const rail = variant === "rail";
  const active = isNavActive(item, pathname);
  const layout = rail ? "size-12 justify-center" : "gap-3 px-3 py-2.5";
  const icon = <NavGlyph icon={item.icon} size={20} />;
  const label = rail ? null : (
    <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
  );

  if (item.href === null) {
    return (
      <button
        type="button"
        aria-disabled="true"
        title="Coming soon"
        aria-label={rail ? `${item.label} (coming soon)` : undefined}
        onClick={(event) => event.preventDefault()}
        className={`${ITEM_BASE} ${layout} cursor-not-allowed font-normal text-text-tertiary`}
      >
        {icon}
        {label}
        {rail ? null : <span className="sr-only">(coming soon)</span>}
      </button>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={rail ? item.label : undefined}
      title={rail ? item.label : undefined}
      onClick={onNavigate}
      className={`${ITEM_BASE} ${layout} ${
        active
          ? "border border-border-soft bg-bg-base font-medium text-text shadow-e1"
          : "font-normal text-text-secondary hover:bg-bg-fill2 hover:text-text"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

/** Group label with the collapse chevron the design shows ("LEARN", "YOUR PATHS", "SUPPORT"). */
function Group({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return (
    <div className="flex w-full flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center justify-between rounded-md pt-1 pr-2 pb-1.5 pl-3.5 font-medium text-[12px] text-text-tertiary uppercase leading-4 tracking-[0.6px] hover:text-text-secondary ${FOCUS}`}
      >
        {label}
        <ChevronDownIcon size={16} className={open ? "" : "-rotate-90"} />
      </button>
      <div id={id} className={open ? "flex flex-col gap-1" : "hidden"}>
        {children}
      </div>
    </div>
  );
}

/** "Your paths" has no progress to list yet (no progress API): always the designed empty card. */
function YourPaths() {
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-border-soft border-dashed bg-bg-fill1 p-3.5">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-accent text-primary-text"
        >
          <RouteIcon size={16} />
        </span>
        <p className="font-semibold text-[14px] text-text leading-5 tracking-[-0.14px]">
          No paths yet
        </p>
      </div>
      <p className="text-[12px] text-text-secondary leading-4 tracking-[-0.12px]">
        Start a path, or star one to save it for later. It’ll show up here.
      </p>
      <Link
        href={ROUTES.paths}
        className={`link-slide inline-flex items-center gap-1 self-start rounded-md font-semibold text-[14px] text-primary-text leading-5 tracking-[-0.14px] ${FOCUS}`}
      >
        Browse paths
        <ArrowRightIcon size={14} />
      </Link>
    </div>
  );
}

function SignOutButton({ rail }: { rail: boolean }) {
  const { signOut, signingOut } = useSession();
  return (
    <button
      type="button"
      onClick={signOut}
      aria-disabled={signingOut}
      aria-label={rail ? "Sign out" : undefined}
      title={rail ? "Sign out" : undefined}
      className={`${ITEM_BASE} ${
        rail ? "size-12 justify-center" : "gap-3 px-3 py-2.5"
      } font-normal text-text-secondary hover:bg-bg-fill2 hover:text-text`}
    >
      {signingOut ? <SpinnerIcon size={20} /> : <LogOutIcon size={20} />}
      {rail ? null : (
        <span className="flex-1 text-left">{signingOut ? "Signing out…" : "Sign out"}</span>
      )}
    </button>
  );
}

function ProfileCard() {
  const { me } = useSession();
  const level = levelBadge(me.onboarding.level);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border-soft bg-bg-base p-3">
      <Avatar me={me} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[16px] text-text leading-6 tracking-[-0.16px]">
          {displayName(me)}
        </p>
        <p className="truncate text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]">
          {level ? `${level} learner` : me.email}
        </p>
      </div>
      <ChevronRightIcon size={18} className="shrink-0 text-text-tertiary" />
    </div>
  );
}

export function Sidebar({
  variant,
  onNavigate,
}: {
  variant: SidebarVariant;
  /** Called after a destination is chosen (closes the phone drawer). */
  onNavigate?: () => void;
}) {
  const { signOutError } = useSession();

  if (variant === "rail") {
    return (
      <div className="relative flex h-full w-full flex-col items-center gap-1 overflow-hidden pt-[35px] pb-6">
        <Glow />
        <Link
          href={ROUTES.dashboard}
          aria-label="Matr Studio home"
          className={`relative flex h-10 items-center rounded-md ${FOCUS}`}
        >
          <Mark />
        </Link>
        <nav aria-label="Learn" className="relative mt-6 flex flex-col items-center gap-1.5">
          {LEARN_NAV.map((item) => (
            <NavRow key={item.id} item={item} variant="rail" />
          ))}
        </nav>
        <div aria-hidden="true" className="relative my-3 h-px w-8 bg-border-soft" />
        <div className="flex-1" />
        <div className="relative flex flex-col items-center gap-0.5 rounded-2xl border border-border-soft bg-bg-base p-2">
          <nav aria-label="Support" className="flex flex-col gap-0.5">
            {SUPPORT_NAV.map((item) => (
              <NavRow key={item.id} item={item} variant="rail" />
            ))}
          </nav>
          <SignOutButton rail />
        </div>
        <p role="alert" className="sr-only">
          {signOutError}
        </p>
      </div>
    );
  }

  const drawer = variant === "drawer";
  return (
    // The glow lives on a clipped background layer, not inside the scrolling area, so it never makes
    // the menu scroll; the menu content sits on top (and only scrolls on very short screens).
    <div className="relative h-full w-full overflow-hidden">
      <Glow />
      <div
        className={`no-scrollbar relative flex h-full w-full flex-col overflow-y-auto overflow-x-hidden px-6 pb-6 ${drawer ? "pt-5" : "pt-[35px]"}`}
      >
        {drawer ? null : (
          <Link
            href={ROUTES.dashboard}
            aria-label="Matr Studio home"
            className={`relative flex h-10 items-center rounded-md pl-3.5 ${FOCUS}`}
          >
            <Wordmark />
          </Link>
        )}
        <div className={`relative flex flex-col ${drawer ? "gap-5 pt-[60px]" : "gap-5 pt-6"}`}>
          {drawer ? <ProfileCard /> : null}
          <nav aria-label="Learn">
            <Group label="Learn">
              {LEARN_NAV.map((item) => (
                <NavRow key={item.id} item={item} variant={variant} onNavigate={onNavigate} />
              ))}
            </Group>
          </nav>
          <section aria-label="Your paths">
            <Group label="Your paths">
              <YourPaths />
            </Group>
          </section>
        </div>
        <div className="min-h-6 flex-1" />
        <div className="relative flex flex-col gap-1">
          <Group label="Support">
            <div className="flex flex-col gap-0.5 rounded-2xl border border-border-soft bg-bg-base p-2">
              <nav aria-label="Support" className="flex flex-col gap-0.5">
                {SUPPORT_NAV.map((item) => (
                  <NavRow key={item.id} item={item} variant={variant} onNavigate={onNavigate} />
                ))}
              </nav>
              <div className="px-1.5 pt-1.5 pb-2.5">
                <ThemeSwitch name={drawer ? "Menu" : "Sidebar"} />
              </div>
              <div aria-hidden="true" className="h-px bg-border-soft" />
              <SignOutButton rail={false} />
              <p role="alert" className="px-3 pb-1 text-[12px] text-error-text leading-4">
                {signOutError}
              </p>
            </div>
          </Group>
        </div>
      </div>
    </div>
  );
}

/** The bottom orange glow of the sidebar (Figma "Nav glow"), drawn from the brand token. */
function Glow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-[-219px] left-1/2 h-[350px] w-[708px] -translate-x-1/2 bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--matr-primary)_45%,transparent),transparent)] opacity-60 dark:opacity-100"
    />
  );
}

/** "matrstudio." wordmark, 126 x 20 in the design; swaps with the theme like the marketing nav. */
export function Wordmark() {
  return (
    <>
      <img
        src="/images/logo-nav.svg"
        alt=""
        width={127}
        height={20}
        className="block h-5 w-auto dark:hidden"
      />
      <img
        src="/images/logo-nav-dark.svg"
        alt=""
        width={127}
        height={20}
        className="hidden h-5 w-auto dark:block"
      />
    </>
  );
}

function Mark() {
  return (
    <svg
      aria-hidden="true"
      width="32"
      height="15"
      viewBox="0 0 32 14.6667"
      fill="none"
      className="text-text"
    >
      <path
        d="M26.1539 14.6667H18.7712V13.7111C19.0066 13.6918 19.2419 13.6725 19.4773 13.6532C19.7228 13.6339 19.9377 13.5953 20.1219 13.5373C20.4084 13.4505 20.6182 13.3009 20.7512 13.0885C20.8944 12.8665 20.9661 12.5818 20.9661 12.2343V4.86476C20.9661 3.86092 20.7205 3.08874 20.2293 2.54821C19.7484 1.99803 19.1447 1.72294 18.4182 1.72294C17.9168 1.72294 17.4461 1.79533 17.0061 1.94011C16.5662 2.0849 16.162 2.28759 15.7936 2.54821C15.4969 2.76056 15.2462 2.99221 15.0415 3.24317C14.8471 3.48448 14.6988 3.68718 14.5964 3.85127V12.0895C14.5964 12.4273 14.6578 12.7073 14.7806 12.9293C14.9034 13.1416 15.1132 13.3057 15.4099 13.4215C15.6452 13.5084 15.855 13.576 16.0392 13.6242C16.2336 13.6628 16.4843 13.6918 16.7913 13.7111V14.6667H9.56212V13.7111C9.79746 13.6918 10.0226 13.6725 10.2375 13.6532C10.4626 13.6339 10.6672 13.5953 10.8514 13.5373C11.1379 13.4505 11.3477 13.3009 11.4807 13.0885C11.6239 12.8665 11.6956 12.5818 11.6956 12.2343V4.86476C11.6956 3.86092 11.45 3.08874 10.9588 2.54821C10.4779 1.99803 9.87421 1.72294 9.14771 1.72294C8.64633 1.72294 8.17564 1.80015 7.73565 1.95459C7.29566 2.09938 6.89148 2.30207 6.52312 2.56269C6.22638 2.77504 5.97569 3.01634 5.77104 3.28661C5.56639 3.54722 5.41291 3.74509 5.31058 3.88022V12.0605C5.31058 12.3887 5.38221 12.6638 5.52546 12.8858C5.66872 13.1078 5.88359 13.2767 6.1701 13.3926C6.38498 13.4891 6.60497 13.5615 6.83009 13.6097C7.0552 13.658 7.30589 13.6918 7.58216 13.7111V14.6667H0.230228V13.7111C0.465571 13.6918 0.706031 13.6725 0.951608 13.6532C1.20742 13.6339 1.42741 13.5953 1.61159 13.5373C1.8981 13.4505 2.10786 13.3009 2.24088 13.0885C2.38414 12.8665 2.45576 12.5818 2.45576 12.2343V3.359C2.45576 3.05013 2.37902 2.77504 2.22553 2.53373C2.08228 2.28277 1.87763 2.07042 1.61159 1.89668C1.41718 1.78085 1.17672 1.68915 0.890213 1.62159C0.603708 1.54437 0.30697 1.49611 0 1.4768V0.535703L5.06501 0.217177L5.27989 0.419875V2.46134H5.38733C5.64314 2.22003 5.95522 1.93529 6.32359 1.60711C6.69195 1.27893 7.03473 1.01349 7.35194 0.810793C7.71007 0.579138 8.15517 0.386092 8.68726 0.231655C9.22957 0.0772184 9.81281 0 10.437 0C11.4193 0 12.2635 0.25096 12.9695 0.752879C13.6755 1.24515 14.182 1.84359 14.489 2.54821C14.8574 2.21038 15.1797 1.91598 15.4559 1.66502C15.7425 1.40441 16.1159 1.12932 16.5764 0.83975C16.9652 0.58879 17.4206 0.386092 17.9424 0.231655C18.4745 0.0772184 19.0628 0 19.7075 0C20.9865 0 21.9995 0.395744 22.7465 1.18723C23.4935 1.97872 23.8669 3.19491 23.8669 4.8358V12.0895C23.8669 12.4273 23.9283 12.7073 24.0511 12.9293C24.1739 13.1416 24.3837 13.3057 24.6804 13.4215C24.9157 13.5084 25.146 13.576 25.3711 13.6242C25.6064 13.6628 25.8674 13.6918 26.1539 13.7111V14.6667Z"
        fill="currentColor"
      />
      <path
        d="M32 12.712C32 13.2525 31.7902 13.7158 31.3707 14.1019C30.9614 14.4784 30.4703 14.6666 29.8973 14.6666C29.3242 14.6666 28.828 14.4784 28.4084 14.1019C27.9992 13.7158 27.7945 13.2525 27.7945 12.712C27.7945 12.1715 27.9992 11.7082 28.4084 11.3221C28.828 10.9263 29.3242 10.7285 29.8973 10.7285C30.4703 10.7285 30.9614 10.9263 31.3707 11.3221C31.7902 11.7082 32 12.1715 32 12.712Z"
        fill="var(--color-primary)"
      />
    </svg>
  );
}
