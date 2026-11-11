"use client";

import type { ReactNode } from "react";
import { useSkeletonGate } from "../app-library/browse-loading";
import { BAR } from "../app-library/skeleton";
import { BTN_PRIMARY, StateBlock } from "../app-library/ui";

/**
 * Settings loading frame (Figma "Settings: loading"): per section, a title bar, a line, then
 * field-shaped blocks. `visible` comes from useSkeletonGate (shown after the usual short delay); the busy
 * region and its status text are always there.
 */
export function SettingsSkeleton({ label, visible }: { label: string; visible: boolean }) {
  return (
    <div role="status" aria-busy="true" className="flex min-h-[60vh] flex-col gap-8">
      <p className="sr-only">{label}</p>
      {visible ? (
        <div aria-hidden="true" className="flex flex-col gap-8">
          {["a", "b", "c"].map((key, i) => (
            <div key={key} className="flex flex-col gap-3">
              <div className={`${BAR} h-5 w-24`} />
              <div className={`${BAR} h-4 w-full max-w-[420px]`} />
              <div className="flex items-center gap-3">
                <div className={`${BAR} h-[52px] flex-1 ${i === 2 ? "h-16" : ""}`} />
                {i < 2 ? <div className={`${BAR} hidden h-9 w-28 rounded-lg md:block`} /> : null}
              </div>
              <div className={`${BAR} mt-2 h-1.5 w-full`} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The "couldn't load" state with Try again (nothing is lost; the data is only not here yet). */
export function SettingsLoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <StateBlock
      role="alert"
      glyph="alert"
      title={`Couldn’t load ${what}`}
      body="Check your connection and try again. Nothing has been changed."
    >
      <button type="button" onClick={onRetry} className={BTN_PRIMARY}>
        Try again
      </button>
    </StateBlock>
  );
}

/** Shows the skeleton while loading, the error block on failure, else the content. */
export function LoadedView<T>({
  state,
  what,
  onRetry,
  children,
}: {
  state:
    | { status: "loading" }
    | { status: "ready"; data: T }
    | { status: "error"; failure: unknown };
  what: string;
  onRetry: () => void;
  children: (data: T) => ReactNode;
}) {
  const loading = state.status === "loading";
  const gate = useSkeletonGate(loading);
  if (loading || gate) return <SettingsSkeleton label={`Loading ${what}`} visible={gate} />;
  if (state.status === "error") return <SettingsLoadError what={what} onRetry={onRetry} />;
  return <>{children(state.data)}</>;
}
