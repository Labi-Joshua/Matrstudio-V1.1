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
import { Icon, PATHS } from "./ui";

export type Toast = { tone: "success" | "error" | "info"; title: string; body?: string };
const DURATION_MS = 5000;
const Context = createContext<((toast: Toast) => void) | null>(null);

const ICON = { success: PATHS.checkCircle, error: PATHS.alert, info: PATHS.alert } as const;
const COLOR = {
  success: "text-success-text",
  error: "text-error-text",
  info: "text-primary-text",
} as const;

/** One toast host for the People pages; a new toast replaces the one showing. Errors are announced assertively. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<{ key: number; toast: Toast } | null>(null);
  const show = useCallback(
    (toast: Toast) => setShown((prev) => ({ key: (prev?.key ?? 0) + 1, toast })),
    [],
  );
  const key = shown?.key;
  useEffect(() => {
    if (key === undefined) return;
    const timer = window.setTimeout(() => setShown(null), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [key]);
  const value = useMemo(() => show, [show]);
  const t = shown?.toast;
  return (
    <Context.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex justify-center lg:inset-x-auto lg:top-6 lg:left-1/2 lg:w-[440px] lg:-translate-x-1/2">
        <div
          role={t?.tone === "error" ? "alert" : "status"}
          aria-live={t?.tone === "error" ? "assertive" : "polite"}
          aria-atomic="true"
          className="pointer-events-auto w-full"
        >
          {t ? (
            <div
              key={shown?.key}
              className="flex items-start gap-2 rounded-[10px] border border-border bg-bg-elevation-1 py-3 pr-3 pl-3 shadow-e2"
            >
              <span className={`mt-0.5 shrink-0 ${COLOR[t.tone]}`}>
                <Icon d={ICON[t.tone]} size={20} />
              </span>
              <div className="min-w-0 flex-1 text-[14px] leading-5 tracking-[-0.14px]">
                <p className="font-medium text-text">{t.title}</p>
                {t.body ? <p className="text-text-secondary">{t.body}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setShown(null)}
                aria-label="Dismiss"
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-bg-fill2 hover:text-text focus-visible:outline-2 focus-visible:outline-primary-border"
              >
                <Icon d={PATHS.x} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </Context.Provider>
  );
}

export function useToast(): (toast: Toast) => void {
  const value = useContext(Context);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

/** A toast for a failed request: the API's own message when it has one. */
export function failureToast(title: string, message?: string): Toast {
  return { tone: "error", title, body: message };
}
