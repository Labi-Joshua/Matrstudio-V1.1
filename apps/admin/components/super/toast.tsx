"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertIcon, CheckCircleIcon, XIcon } from "./icons";

type Toast = { id: number; tone: "success" | "error"; title: string; body?: string };
type Push = (toast: Omit<Toast, "id">) => void;

const ToastContext = createContext<Push | null>(null);

/** Toasts: top right on desktop, full width at the top on phones; announced politely (errors assertively). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback<Push>((toast) => {
    const id = next.current++;
    setItems((list) => [...list.slice(-2), { ...toast, id }]);
  }, []);
  const dismiss = useCallback(
    (id: number) => setItems((list) => list.filter((t) => t.id !== id)),
    [],
  );
  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-6 sm:w-[440px]">
        {items.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.tone === "error" ? 9000 : 6000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border-soft bg-bg-elevation-1 p-3.5 shadow-card"
    >
      <span className={toast.tone === "error" ? "text-error-text" : "text-success-text"}>
        {toast.tone === "error" ? <AlertIcon size={18} /> : <CheckCircleIcon size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[14px] text-text leading-5">{toast.title}</p>
        {toast.body ? (
          <p className="text-[13px] text-text-secondary leading-[18px]">{toast.body}</p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
        className="rounded-md text-text-tertiary hover:text-text focus-visible:outline-2 focus-visible:outline-primary-border"
      >
        <XIcon size={16} />
      </button>
    </div>
  );
}

export function useToast(): Push {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast needs a ToastProvider");
  return push;
}
