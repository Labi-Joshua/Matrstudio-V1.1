import type { ReactNode } from "react";
import { ADMIN_ROUTES } from "../../lib/nav/routes";
import { ButtonLink } from "../ui/button";
import { BanIcon, SearchXIcon, WifiOffIcon } from "../ui/icons";

/**
 * Full-panel message for a page that is missing (404), forbidden (403) or an account with no
 * access at all. Used by the portal layout (inside the shell) and by app/not-found.tsx.
 */
export type AccessKind = "not_found" | "forbidden" | "no_access" | "load_error";

const COPY: Record<AccessKind, { title: string; body: string; icon: ReactNode }> = {
  not_found: {
    title: "We couldn’t find that page",
    body: "The link may be old, or the page may have moved. Check the address or go back to the dashboard.",
    icon: <SearchXIcon size={24} />,
  },
  forbidden: {
    title: "You don’t have access to this page",
    body: "Your role doesn’t include it. If you need it, ask a Super admin to update your role.",
    icon: <BanIcon size={24} />,
  },
  no_access: {
    title: "Your role has no pages yet",
    body: "You’re signed in, but no area is switched on for your role. Ask a Super admin to update it.",
    icon: <BanIcon size={24} />,
  },
  load_error: {
    title: "We couldn’t load your account",
    body: "Check your connection and try again.",
    icon: <WifiOffIcon size={24} />,
  },
};

export function AccessScreen({
  kind,
  action,
  homeHref = ADMIN_ROUTES.dashboard,
  showHome = true,
}: {
  kind: AccessKind;
  /** Replaces the default "Go to dashboard" button (for example Try again). */
  action?: ReactNode;
  homeHref?: string;
  showHome?: boolean;
}) {
  const { title, body, icon } = COPY[kind];
  return (
    <div className="flex min-h-[50dvh] items-center justify-center px-5 py-16">
      <div
        role={kind === "load_error" ? "alert" : undefined}
        className="flex w-full max-w-[420px] flex-col items-start gap-4"
      >
        <span className="flex size-14 items-center justify-center rounded-xl border border-border-soft bg-bg-fill1 text-text-secondary">
          {icon}
        </span>
        <h1 className="font-medium text-[28px] text-text leading-9 tracking-[-0.56px]">{title}</h1>
        <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">{body}</p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {action}
          {!action && showHome ? (
            <ButtonLink href={homeHref} fit>
              Go to dashboard
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}
