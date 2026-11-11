"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SettingsToast } from "../../lib/app/settings-state";
import { Banner, ToastRegion } from "../auth/banner";

const DURATION_MS = 5000;
const Context = createContext<((toast: SettingsToast) => void) | null>(null);

/** One toast host for all of Settings; a new toast replaces the one showing. */
export function SettingsToastProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<{ key: number; toast: SettingsToast } | null>(null);
  const show = useCallback(
    (toast: SettingsToast) => setShown((prev) => ({ key: (prev?.key ?? 0) + 1, toast })),
    [],
  );
  const key = shown?.key;
  useEffect(() => {
    if (key === undefined) return;
    const timer = window.setTimeout(() => setShown(null), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [key]);
  const value = useMemo(() => show, [show]);
  return (
    <Context.Provider value={value}>
      {children}
      <ToastRegion politeness={shown?.toast.tone === "error" ? "assertive" : "polite"}>
        {shown ? (
          <Banner
            key={shown.key}
            tone={shown.toast.tone}
            title={shown.toast.title}
            onDismiss={() => setShown(null)}
          >
            {shown.toast.body}
          </Banner>
        ) : null}
      </ToastRegion>
    </Context.Provider>
  );
}

export function useSettingsToast(): (toast: SettingsToast) => void {
  const value = useContext(Context);
  if (!value) throw new Error("useSettingsToast must be used inside the settings layout");
  return value;
}
