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
import { AlertIcon, CheckIcon, XIcon } from "./ui";

type Toast = {
  id: number;
  tone: "success" | "error";
  title: string;
  body?: string;
  action?: { label: string; run: () => void };
};
type Push = (toast: Omit<Toast, "id">) => void;

const ToastContext = createContext<Push>(() => {});
export const useToast = () => useContext(ToastContext);

const DISMISS_MS = 6000;

/**
 * Toasts for the content screens: bottom of the screen, 440px wide at most, announced politely
 * (errors assertively). Errors with an action (Try again) stay until dismissed.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback<Push>((toast) => {
    const id = next.current++;
    setToasts((all) => [...all.slice(-2), { ...toast, id }]);
  }, []);
  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Shows the toast named by `?notice=` once (a page we navigated from sets it, because its own
 * toasts go away with it), then removes the parameter from the address.
 */
export function useNotice(messages: Record<string, string>) {
  const toast = useToast();
  const messagesRef = useRef(messages);
  useEffect(() => {
    const url = new URL(window.location.href);
    const key = url.searchParams.get("notice");
    if (!key) return;
    const title = messagesRef.current[key];
    if (title) toast({ tone: "success", title });
    url.searchParams.delete("notice");
    window.history.replaceState(null, "", url);
  }, [toast]);
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.tone === "error" && toast.action) return;
    const timer = setTimeout(onDismiss, DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);
  const error = toast.tone === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
      className="pointer-events-auto flex w-full max-w-[440px] items-center gap-3 rounded-2xl border border-border-soft bg-bg-base px-4 py-3 shadow-card"
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${error ? "bg-error-focus text-error-text" : "bg-success-focus text-success-text"}`}
      >
        {error ? <AlertIcon /> : <CheckIcon />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[14px] leading-5">{toast.title}</p>
        {toast.body ? (
          <p className="text-[13px] text-text-secondary leading-4">{toast.body}</p>
        ) : null}
      </div>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action?.run();
            onDismiss();
          }}
          className="shrink-0 rounded-md font-medium text-[14px] text-primary-text hover:underline focus-visible:outline-2 focus-visible:outline-primary-border"
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 text-text-tertiary hover:text-text focus-visible:outline-2 focus-visible:outline-primary-border"
      >
        <XIcon />
      </button>
    </div>
  );
}
