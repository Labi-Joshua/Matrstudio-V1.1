"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { canOpenPath, visibleSections } from "../../lib/nav/menu";
import { SessionProvider, useAdminSession, useSessionInternals } from "../../lib/session/provider";
import { Button, ICON_BUTTON } from "../ui/button";
import { FOCUS } from "../ui/focus";
import { useMediaQuery, useModalSurface, useSkeletonGate } from "../ui/hooks";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, CloseIcon } from "../ui/icons";
import { Modal } from "../ui/modal";
import { Skeleton } from "../ui/skeleton";
import { ToastProvider } from "../ui/toast";
import { AccessScreen } from "./access-screen";
import { OverlaysProvider, useOverlays } from "./overlays";
import { SearchPalette } from "./palette";
import { ReauthModal } from "./reauth-modal";
import { Sidebar } from "./sidebar";
import { Breadcrumb, DesktopTopBar, PhoneBar } from "./topbar";
import { Wordmark } from "./wordmark";

/**
 * The admin portal frame (Figma "Admin - Auth and navigation"). The session is checked in the
 * browser (static export): a skeleton while /me loads, a retry panel when it fails, a redirect to
 * sign-in when unauthorised. Signed-in admins get the side navigation (full from 1280px, an 88px
 * icon rail from 768px, a phone drawer below), the top bar and the page in <main>. A page the
 * role cannot open shows the "no access" screen instead of the page.
 */
export function PortalShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <Gate>{children}</Gate>
      </ToastProvider>
    </SessionProvider>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { state, refresh } = useSessionInternals();
  const showSkeleton = useSkeletonGate(state.status === "loading");

  if (state.status === "authenticated") {
    return (
      <OverlaysProvider>
        <Frame>{children}</Frame>
        <ReauthModal />
        <IdleModal />
      </OverlaysProvider>
    );
  }
  if (state.status === "error") {
    return (
      <AccessScreen
        kind="load_error"
        action={
          <Button fit onClick={() => void refresh()}>
            Try again
          </Button>
        }
      />
    );
  }
  if (state.status === "loading" && !showSkeleton) {
    return <div aria-busy="true" className="min-h-dvh bg-bg-fill1" />;
  }
  return (
    <ShellSkeleton
      message={
        state.status === "unauthenticated" ? "Taking you to sign in…" : "Loading the admin portal…"
      }
    />
  );
}

function ShellSkeleton({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh bg-bg-fill1">
      <aside
        aria-hidden="true"
        className="hidden w-[88px] shrink-0 flex-col gap-3 p-6 md:flex xl:w-[280px]"
      >
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-6 h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </aside>
      <main
        aria-busy="true"
        className="min-w-0 flex-1 rounded-t-3xl border-border-soft border-t bg-bg-base px-5 pt-8 md:mt-4 md:rounded-tr-none md:border-l md:px-12 md:pt-24"
      >
        <p role="status" aria-live="polite" className="sr-only">
          {message}
        </p>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
        <div className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </main>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { me } = useAdminSession();
  const pathname = usePathname();
  const { paletteOpen, closePalette } = useOverlays();
  const phone = useMediaQuery("(max-width: 767px)");
  const wide = useMediaQuery("(min-width: 1280px)");
  // null = follow the screen (full from 1280px, rail below); true/false = the admin's choice.
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const rail = !phone && (collapsed ?? !wide);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const sidebarId = useId();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!phone) setMenuOpen(false);
  }, [phone]);

  // After a client-side navigation, move focus to the page so keyboard and screen reader users start at its top.
  const firstPath = useRef(pathname);
  useEffect(() => {
    if (firstPath.current === pathname) return;
    firstPath.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const noAreas = visibleSections(me).length === 0;
  const allowed = canOpenPath(me, pathname);

  return (
    <div className="bg-bg-fill1 text-text">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1920px]">
        <a
          href="#main"
          className={`sr-only z-[80] rounded-lg bg-bg-base px-4 py-2 font-medium text-[14px] text-text focus:not-sr-only focus:fixed focus:top-3 focus:left-3 ${FOCUS}`}
        >
          Skip to main content
        </a>

        {phone ? null : (
          <aside
            id={sidebarId}
            aria-label="Sidebar"
            className={`sticky top-0 z-30 h-dvh shrink-0 ${rail ? "w-[88px]" : "w-[280px]"}`}
          >
            <Sidebar variant={rail ? "rail" : "full"} />
          </aside>
        )}

        <div className="relative flex min-w-0 flex-1 flex-col md:pt-2">
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
              className={`absolute top-[26px] z-30 flex size-8 items-center justify-center rounded-full border border-border-soft bg-bg-base text-text-secondary hover:text-text ${FOCUS} ${
                rail ? "-left-4" : "-left-4"
              }`}
            >
              {rail ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
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
              ref={mainRef}
              tabIndex={-1}
              className="flex-1 px-5 pt-6 pb-16 outline-none md:px-12 md:pt-2"
            >
              {noAreas ? (
                <AccessScreen kind="no_access" showHome={false} />
              ) : allowed ? (
                children
              ) : (
                <AccessScreen kind="forbidden" />
              )}
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
        {paletteOpen ? <SearchPalette onClose={closePalette} /> : null}
      </div>
    </div>
  );
}

/** The phone menu (Figma Nav 4 mobile frames): a modal drawer 330 wide over a scrim, focus trapped. */
function PhoneDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalSurface(panelRef, onClose);
  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-static-black/60 backdrop-blur-sm"
      />
      <div
        id={id}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="absolute inset-y-0 left-0 w-[330px] max-w-[88vw] border-border-soft border-r bg-bg-fill1"
      >
        <div className="absolute top-5 left-6 z-10">
          <Wordmark />
        </div>
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className={`${ICON_BUTTON} absolute top-3.5 right-4 z-10`}
        >
          <CloseIcon size={20} />
        </button>
        <Sidebar variant="drawer" onNavigate={onClose} />
      </div>
    </div>
  );
}

/** "Still there?" warning shown in the last two minutes before the idle timeout. */
function IdleModal() {
  const { idleWarning, stayActive, signOut } = useSessionInternals();
  const [busy, setBusy] = useState(false);
  if (idleWarning === null) return null;
  const minutes = Math.floor(idleWarning / 60);
  const seconds = String(idleWarning % 60).padStart(2, "0");
  return (
    <Modal
      title="Still there?"
      subtitle="For your security, admin sessions end after a period of inactivity."
      icon={<ClockIcon size={20} />}
      width={440}
      onClose={() => void stayActive()}
      footer={
        <>
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
          <Button
            pending={busy}
            onClick={async () => {
              setBusy(true);
              await stayActive();
              setBusy(false);
            }}
          >
            Stay signed in
          </Button>
        </>
      }
    >
      <p aria-live="off" className="text-[14px] text-text-secondary leading-5">
        You’ll be signed out in{" "}
        <span className="font-medium text-text">
          {minutes}:{seconds}
        </span>
        .
      </p>
    </Modal>
  );
}
