"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useMe } from "../../lib/auth/use-me";
import { ROUTES } from "../../lib/routes";
import { HomeSkeletonBlocks } from "./home-states";
import { useMediaQuery, useModalSurface, useSkeletonGate } from "./hooks";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "./icons";
import { SessionProvider } from "./session";
import { Sidebar, Wordmark } from "./sidebar";
import { Breadcrumb, DesktopTopBar, PhoneBar } from "./topbar";
import { FOCUS } from "./ui";
import { ProfileContent } from "./user-menu";

/**
 * The learner app shell (Figma "Navigation and notification"). It is a static export, so the
 * session is checked in the browser: while /api/me is loading a skeleton shows, a 401 sends the
 * learner to /sign-in, and an API/network failure shows a retry panel instead of guessing.
 * Authenticated learners get the frame: side navigation (full sidebar from 1280px, icon rail from
 * 768px, a phone menu drawer below that), top bar and the page in <main>.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state, refresh } = useMe();
  // No skeleton flash for a fast /api/me; once shown it stays long enough to read as a state.
  const showSkeleton = useSkeletonGate(state.status === "loading");

  useEffect(() => {
    if (state.status === "unauthenticated") router.replace(ROUTES.signIn);
  }, [state.status, router]);

  if (state.status === "authenticated") {
    return (
      <SessionProvider me={state.me}>
        <Frame>{children}</Frame>
      </SessionProvider>
    );
  }
  if (state.status === "error") return <LoadError onRetry={refresh} />;
  if (state.status === "loading" && !showSkeleton) {
    return <div aria-busy="true" className="min-h-dvh bg-bg-fill1" />;
  }
  return (
    <ShellSkeleton
      message={
        state.status === "unauthenticated" ? "Taking you to sign in…" : "Loading your dashboard…"
      }
    />
  );
}

function Frame({ children }: { children: ReactNode }) {
  const phone = useMediaQuery("(max-width: 767px)");
  const wide = useMediaQuery("(min-width: 1280px)");
  // null = follow the screen size (full from 1280px, rail below); true/false = the learner's choice.
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const rail = !phone && (collapsed ?? !wide);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const sidebarId = useId();

  // Leaving the phone layout closes the drawer.
  useEffect(() => {
    if (!phone) setMenuOpen(false);
  }, [phone]);

  return (
    <div className="flex min-h-dvh bg-bg-fill1 text-text">
      <a
        href="#main"
        className={`sr-only z-[60] rounded-lg bg-bg-base px-4 py-2 font-medium text-[14px] text-text focus:not-sr-only focus:fixed focus:top-3 focus:left-3 ${FOCUS}`}
      >
        Skip to main content
      </a>

      {phone ? null : (
        <aside
          id={sidebarId}
          aria-label="Sidebar"
          className={`sticky top-0 z-30 h-dvh shrink-0 ${rail ? "w-[88px]" : "w-[320px]"}`}
        >
          <Sidebar variant={rail ? "rail" : "full"} />
        </aside>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col md:pt-4">
        {phone ? (
          <PhoneBar
            onOpenMenu={() => setMenuOpen(true)}
            menuOpen={menuOpen}
            menuButtonRef={menuButtonRef}
            menuId={menuId}
          />
        ) : (
          <button
            type="button"
            aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!rail}
            aria-controls={sidebarId}
            onClick={() => setCollapsed(!rail)}
            className={`absolute top-[30px] z-30 flex items-center justify-center rounded-full border border-border-soft bg-bg-base text-text-secondary hover:text-text ${FOCUS} ${
              rail ? "-left-4 size-8" : "-left-5 size-10"
            }`}
          >
            {rail ? <ChevronRightIcon size={18} /> : <ChevronLeftIcon size={18} />}
          </button>
        )}

        <div className="flex min-w-0 flex-1 flex-col rounded-t-3xl border-border-soft border-t bg-bg-base md:rounded-tr-none md:border-l">
          {phone ? (
            <div className="px-5 pt-6">
              <Breadcrumb />
            </div>
          ) : (
            <DesktopTopBar />
          )}
          <main
            id="main"
            tabIndex={-1}
            className="flex-1 px-5 pt-6 pb-16 outline-none md:px-10 md:pt-8"
          >
            {children}
          </main>
        </div>
      </div>

      {phone && menuOpen ? (
        <PhoneDrawer
          id={menuId}
          onClose={() => {
            setMenuOpen(false);
            menuButtonRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * The phone menu (Figma "Menu drawer" 330 wide over a scrim): a modal dialog with a focus trap.
 * Tapping the profile card swaps its content for the Profile view (Figma "Profile open: phone
 * menu (context swap)") and the back arrow swaps it back.
 */
function PhoneDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"menu" | "profile">("menu");
  const titleId = useId();
  useModalSurface(panelRef, onClose);

  // The control that was pressed disappears with the swap: put focus on the new view's first control.
  const swapped = useRef(false);
  useEffect(() => {
    if (!swapped.current) {
      swapped.current = true;
      return;
    }
    const target = view === "profile" ? "[data-profile-back]" : "[data-profile-card]";
    panelRef.current?.querySelector<HTMLElement>(target)?.focus();
  }, [view]);

  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-static-black/60" />
      <div
        id={id}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={view === "profile" ? undefined : "Menu"}
        aria-labelledby={view === "profile" ? titleId : undefined}
        className="absolute inset-y-0 left-0 w-[330px] max-w-[88vw] border-border-soft border-r bg-bg-fill1"
      >
        {view === "profile" ? (
          <div className="flex h-full flex-col overflow-y-auto">
            <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
              <button
                type="button"
                data-profile-back
                aria-label="Back to menu"
                onClick={() => setView("menu")}
                className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary hover:text-text ${FOCUS}`}
              >
                <ArrowLeftIcon size={20} />
              </button>
              <h2
                id={titleId}
                className="flex-1 font-semibold text-[22px] text-text leading-7 tracking-[-0.22px]"
              >
                Profile
              </h2>
              <button
                type="button"
                aria-label="Close menu"
                onClick={onClose}
                className={`flex size-10 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary hover:text-text ${FOCUS}`}
              >
                <CloseIcon size={20} />
              </button>
            </div>
            <ProfileContent />
          </div>
        ) : (
          <>
            <div className="absolute top-5 left-6 z-10">
              <Wordmark />
            </div>
            <button
              type="button"
              aria-label="Close menu"
              onClick={onClose}
              className={`absolute top-3.5 right-4 z-10 flex size-10 items-center justify-center rounded-[10px] border border-border-soft bg-bg-base text-text-secondary hover:text-text ${FOCUS}`}
            >
              <CloseIcon size={20} />
            </button>
            <Sidebar
              variant="drawer"
              onNavigate={onClose}
              onOpenProfile={() => setView("profile")}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Placeholder while /api/me loads: the shape of the shell and Home, pulsing, announced politely. */
function ShellSkeleton({ message }: { message: string }) {
  const bar = "rounded-md bg-bg-fill2 motion-safe:animate-pulse";
  return (
    <div className="flex min-h-dvh bg-bg-fill1">
      <aside
        aria-hidden="true"
        className="hidden w-[88px] shrink-0 flex-col gap-3 p-6 md:flex xl:w-[320px]"
      >
        <div className={`${bar} h-5 w-32`} />
        <div className={`${bar} mt-6 h-11 w-full`} />
        <div className={`${bar} h-11 w-full`} />
        <div className={`${bar} h-11 w-full`} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col md:pt-4">
        <div className="h-[66px] shrink-0 md:hidden" />
        <main
          aria-busy="true"
          className="flex-1 rounded-t-3xl border-border-soft border-t bg-bg-base px-5 pt-8 md:rounded-tr-none md:border-l md:pt-24 md:pl-12"
        >
          <p role="status" aria-live="polite" className="sr-only">
            {message}
          </p>
          <div className="mx-auto w-full max-w-[1240px]">
            <HomeSkeletonBlocks />
          </div>
        </main>
      </div>
    </div>
  );
}

/** /api/me could not be read (offline, API down): say so and offer a retry rather than a blank page. */
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-base px-6">
      <div role="alert" className="flex max-w-[400px] flex-col items-start gap-4">
        <h1 className="font-medium text-[28px] text-text leading-9 tracking-[-0.56px]">
          We couldn’t load your account
        </h1>
        <p className="text-[16px] text-text-secondary leading-6 tracking-[-0.16px]">
          Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className={`btn-lift inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-4 font-medium text-[14px] text-static-white leading-5 ${FOCUS}`}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
