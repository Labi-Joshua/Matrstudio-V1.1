"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Banner, type BannerTone } from "./banner";

/**
 * Toast region (Figma Toast: 440 wide, bottom of the screen). `useToast().show(...)` adds one that
 * dismisses itself after 6 seconds (errors stay until closed). The region always exists, so
 * screen readers announce new toasts politely (errors assertively).
 */
export type ToastInput = { tone: BannerTone; title: string; message?: string; action?: ReactNode };
type Toast = ToastInput & { id: number };

type ToastApi = { show: (toast: ToastInput) => void; dismiss: (id: number) => void };
const ToastContext = createContext<ToastApi>({ show: () => {}, dismiss: () => {} });

export const useToast = () => useContext(ToastContext);

const AUTO_DISMISS_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const show = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-2), { ...toast, id }]);
      if (toast.tone !== "error") setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex justify-center md:inset-x-auto md:bottom-6 md:left-1/2 md:w-[440px] md:-translate-x-1/2">
        <div
          role="status"
          aria-live="polite"
          aria-relevant="additions"
          className="pointer-events-auto flex w-full flex-col gap-2"
        >
          {toasts.map((t) => (
            <div key={t.id} role={t.tone === "error" ? "alert" : undefined}>
              <Banner
                tone={t.tone}
                title={t.title}
                action={t.action}
                onDismiss={() => dismiss(t.id)}
              >
                {t.message}
              </Banner>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
