"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Banner, type BannerTone, ToastRegion } from "../auth/banner";

/** A toast of the profile screens (Figma "Profile updated", "Edit profile: photo too big / couldn't save"). */
export type ProfileToast = { key: number; tone: BannerTone; title: string; body: string };

const DURATION_MS = 6000;

/** One toast at a time; a new one replaces the one showing and restarts the timer. */
export function useProfileToast() {
  const [toast, setToast] = useState<ProfileToast | null>(null);
  const counter = useRef(0);
  const show = useCallback((tone: BannerTone, title: string, body: string) => {
    counter.current += 1;
    setToast({ key: counter.current, tone, title, body });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);
  return { toast, show, dismiss };
}

/**
 * Top centre, announced politely. It dismisses itself after a few seconds, but not while the
 * pointer is over it or focus is inside. The region is always in the page so screen readers
 * announce what appears in it.
 */
export function ProfileToastHost({
  toast,
  onDismiss,
}: {
  toast: ProfileToast | null;
  onDismiss: () => void;
}) {
  const [heldKey, setHeldKey] = useState<number | null>(null);
  const key = toast?.key;
  const held = key !== undefined && heldKey === key;

  useEffect(() => {
    if (key === undefined || held) return;
    const timer = window.setTimeout(onDismiss, DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [key, held, onDismiss]);

  return (
    <ToastRegion>
      {toast ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: only pauses the auto-dismiss timer; the control inside is a real button
        <div
          key={toast.key}
          onPointerEnter={() => setHeldKey(toast.key)}
          onPointerLeave={() => setHeldKey(null)}
          onFocus={() => setHeldKey(toast.key)}
          onBlur={() => setHeldKey(null)}
        >
          <Banner tone={toast.tone} title={toast.title} onDismiss={onDismiss}>
            {toast.body}
          </Banner>
        </div>
      ) : null}
    </ToastRegion>
  );
}
