"use client";

import Link from "next/link";
import { ROUTES } from "../../lib/routes";
import { useOnlineStatus } from "./hooks";
import { HomeIcon, WifiOffIcon } from "./icons";
import { FOCUS } from "./ui";

/** Home's non-content states (Figma "Home: loading", "couldn't load (error)", "offline"). */

const BAR = "rounded-md bg-bg-fill2 motion-safe:animate-pulse";

/** Grey blocks in the shape of Home: greeting, a wide card, then rows of cards. */
export function HomeSkeletonBlocks() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <div className={`${BAR} h-9 w-2/3 max-w-[420px]`} />
        <div className={`${BAR} h-5 w-full max-w-[520px]`} />
      </div>
      <div className="flex flex-col gap-4">
        <div className={`${BAR} h-6 w-44`} />
        <div className={`${BAR} h-[150px] rounded-2xl md:h-[200px]`} />
      </div>
      {["a", "b"].map((key) => (
        <div key={key} className="flex flex-col gap-4">
          <div className={`${BAR} h-6 w-36`} />
          <div className="grid gap-4 md:grid-cols-3">
            <div className={`${BAR} h-[260px] rounded-2xl`} />
            <div className={`${BAR} hidden h-[260px] rounded-2xl md:block`} />
            <div className={`${BAR} hidden h-[260px] rounded-2xl md:block`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-[1240px]">
      <p role="status" className="sr-only">
        Loading your home page
      </p>
      <HomeSkeletonBlocks />
    </div>
  );
}

export function HomeError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-[420px] flex-col items-center gap-3.5 px-4 py-16 text-center md:py-24"
    >
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-full bg-primary-focus text-primary-text"
      >
        <HomeIcon size={28} />
      </span>
      <h1 className="font-semibold text-[24px] text-text leading-8 tracking-[-0.24px]">
        We couldn’t load your home page
      </h1>
      <p className="text-[14px] text-text-secondary leading-5 tracking-[-0.14px]">
        Check your connection and try again.
      </p>
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <Link
          href={ROUTES.app.paths}
          className={`btn-lift inline-flex h-10 items-center rounded-lg border border-border bg-bg-base px-4 font-medium text-[14px] text-text leading-5 ${FOCUS}`}
        >
          Go to Paths
        </Link>
        <button
          type="button"
          onClick={onRetry}
          className={`btn-lift inline-flex h-10 items-center rounded-lg bg-text px-4 font-medium text-[14px] text-bg-base leading-5 ${FOCUS}`}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/** The offline strip; renders nothing while online. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  return <OfflineNotice offline={!online} />;
}

export function OfflineNotice({ offline }: { offline: boolean }) {
  // The live region stays in the page so the change is announced when it fills.
  return (
    <div role="status">
      {offline ? (
        <p className="flex items-center gap-2.5 rounded-xl bg-warning-focus px-4 py-2.5 text-[14px] text-warning-text leading-5 tracking-[-0.14px]">
          <WifiOffIcon size={18} className="shrink-0" />
          You’re offline. What you see may be out of date until you’re back online.
        </p>
      ) : null}
    </div>
  );
}
