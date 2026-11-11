"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { isNavActive, type NavIconName, type NavItem, visibleSections } from "../../lib/nav/menu";
import { ADMIN_ROUTES } from "../../lib/nav/routes";
import { useAdminSession } from "../../lib/session/provider";
import { FOCUS } from "../ui/focus";
import {
  AuditIcon,
  DashboardIcon,
  MetricsIcon,
  PathsIcon,
  ResourcesIcon,
  ReviewIcon,
  RolesIcon,
  SettingsIcon,
  SupportIcon,
  TeamIcon,
  UsersIcon,
} from "../ui/icons";
import { Mark, WORDMARK_LABEL, Wordmark } from "./wordmark";

/**
 * Side navigation (Figma Nav 1: 280 wide, sections OVERVIEW, CONTENT, REVIEW, PEOPLE and ADMIN
 * pinned to the bottom; Nav 3: 88px icon rail; Nav 4 and the phone frames: drawer). Items come from
 * the role: `visibleSections(me)` mirrors the backend menu, so Curator and Support see their own
 * views. The review item carries the queue count from /me.
 */
export type SidebarVariant = "full" | "rail" | "drawer";

const ICONS: Record<NavIconName, (p: { size?: number }) => ReactNode> = {
  dashboard: DashboardIcon,
  metrics: MetricsIcon,
  resources: ResourcesIcon,
  paths: PathsIcon,
  review: ReviewIcon,
  users: UsersIcon,
  support: SupportIcon,
  team: TeamIcon,
  roles: RolesIcon,
  audit: AuditIcon,
  settings: SettingsIcon,
};

function RailTip({ label, children }: { label: string; children: ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: wrapper only observes events bubbling from the link inside
    <span
      role="presentation"
      className="group relative flex"
      onKeyDown={(event) => {
        if (event.key === "Escape") setDismissed(true);
      }}
      onPointerLeave={() => setDismissed(false)}
      onBlur={() => setDismissed(false)}
    >
      {children}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-text px-2.5 py-1.5 font-medium text-[13px] text-bg-base leading-[18px] tracking-[-0.13px] opacity-0 shadow-e2 transition-opacity duration-100 motion-reduce:transition-none ${
          dismissed ? "" : "group-focus-within:opacity-100 group-hover:opacity-100"
        }`}
      >
        {label}
      </span>
    </span>
  );
}

function NavRow({
  item,
  variant,
  badge,
  onNavigate,
}: {
  item: NavItem;
  variant: SidebarVariant;
  badge: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const rail = variant === "rail";
  const active = isNavActive(item, pathname);
  const Icon = ICONS[item.icon];
  const badgeText = badge > 99 ? "99+" : String(badge);
  const label = badge > 0 ? `${item.label}, ${badge} waiting` : item.label;
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={rail || badge > 0 ? label : undefined}
      onClick={onNavigate}
      className={`relative flex items-center rounded-xl text-[14px] leading-5 tracking-[-0.14px] ${FOCUS} ${
        rail ? "size-12 justify-center" : "w-full gap-3 px-3 py-2.5"
      } ${
        active
          ? "border border-border-soft bg-bg-base font-medium text-text shadow-e1"
          : "font-normal text-text-secondary hover:bg-bg-fill2 hover:text-text"
      }`}
    >
      <Icon size={20} />
      {rail ? null : <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>}
      {badge > 0 ? (
        <span
          aria-hidden="true"
          className={
            rail
              ? "absolute top-1 right-1 min-w-4 rounded-full bg-primary px-1 text-center font-medium text-[10px] text-static-white leading-4"
              : "rounded-md bg-primary-accent px-1.5 font-medium text-[12px] text-primary-text leading-[18px]"
          }
        >
          {badgeText}
        </span>
      ) : null}
    </Link>
  );
  return rail ? <RailTip label={item.label}>{link}</RailTip> : link;
}

function SectionBlock({
  label,
  items,
  variant,
  reviewBadge,
  onNavigate,
}: {
  label: string;
  items: readonly NavItem[];
  variant: SidebarVariant;
  reviewBadge: number;
  onNavigate?: () => void;
}) {
  const rail = variant === "rail";
  return (
    <nav aria-label={label} className="flex flex-col gap-0.5">
      {rail ? (
        <div aria-hidden="true" className="mx-auto my-1.5 h-px w-8 bg-border-soft first:hidden" />
      ) : (
        <p className="px-3.5 pt-3 pb-1.5 font-medium text-[11px] text-text-tertiary uppercase leading-4 tracking-[0.6px]">
          {label}
        </p>
      )}
      <ul
        className={`m-0 flex list-none flex-col p-0 ${rail ? "items-center gap-1.5" : "gap-0.5"}`}
      >
        {items.map((item) => (
          <li key={item.id} className={rail ? "" : "w-full"}>
            <NavRow
              item={item}
              variant={variant}
              badge={item.id === "review_queues" ? reviewBadge : 0}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Sidebar({
  variant,
  onNavigate,
}: {
  variant: SidebarVariant;
  /** Called after a destination is chosen (closes the drawer). */
  onNavigate?: () => void;
}) {
  const { me } = useAdminSession();
  const sections = visibleSections(me);
  const top = sections.filter((s) => s.id !== "admin");
  const bottom = sections.find((s) => s.id === "admin");
  const rail = variant === "rail";
  const drawer = variant === "drawer";
  const props = { variant, reviewBadge: me.reviewBadge, onNavigate };

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg-fill1">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-120px] left-1/2 h-[260px] w-[420px] -translate-x-1/2 bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--matr-primary)_22%,transparent),transparent)]"
      />
      <div
        className={`relative flex h-full w-full flex-col overflow-y-auto overflow-x-hidden pb-4 ${
          rail ? "items-center px-0 pt-5" : drawer ? "px-3 pt-16" : "px-3 pt-5"
        }`}
      >
        {drawer ? null : (
          <Link
            href={ADMIN_ROUTES.dashboard}
            aria-label={WORDMARK_LABEL}
            className={`flex shrink-0 items-center rounded-md ${FOCUS} ${rail ? "justify-center" : "h-10 gap-2 px-3"}`}
          >
            {rail ? (
              <Mark />
            ) : (
              <>
                <Wordmark />
                <span className="max-w-[92px] truncate rounded-md border border-border-soft bg-bg-base px-1.5 font-medium text-[11px] text-text-secondary leading-[18px]">
                  {me.role.name}
                </span>
              </>
            )}
          </Link>
        )}
        <div
          className={`flex w-full flex-col ${rail ? "mt-4 items-center gap-0.5" : "mt-2 gap-0.5"}`}
        >
          {top.map((s) => (
            <SectionBlock key={s.id} label={s.label} items={s.items} {...props} />
          ))}
        </div>
        <div className="min-h-6 flex-1" />
        {bottom ? (
          <div className="w-full">
            <SectionBlock label={bottom.label} items={bottom.items} {...props} />
          </div>
        ) : null}
        {sections.length === 0 ? (
          <p className="px-3.5 py-3 text-[13px] text-text-secondary leading-[18px]">
            Your role has no pages yet. Ask a Super admin to update it.
          </p>
        ) : null}
      </div>
    </div>
  );
}
