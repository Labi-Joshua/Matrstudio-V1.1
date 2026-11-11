"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertCircleIcon, CheckCircleIcon, FOCUS, XIcon } from "./ui";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Which element a Tab press should jump to so focus stays inside the dialog; null = let it go. */
export function trapTarget(count: number, active: number, backwards: boolean): number | null {
  if (count === 0) return null;
  if (backwards) return active <= 0 ? count - 1 : null;
  return active === -1 || active === count - 1 ? 0 : null;
}

/**
 * Settings dialog (Figma ST2/ST3): a centred card from md up, a full-screen sheet on phones.
 * Focus moves in and is trapped, Escape and the scrim close it (not while `busy`), page scroll is
 * locked and focus returns to the trigger.
 */
export function Modal({
  title,
  subtitle,
  icon,
  tone = "neutral",
  onClose,
  busy = false,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  tone?: "neutral" | "danger";
  onClose: () => void;
  busy?: boolean;
  footer: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus], input, select, textarea");
    (first ?? panel)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const active = items.indexOf(document.activeElement as HTMLElement);
      const target = trapTarget(items.length, active, event.shiftKey);
      if (target === null) return;
      event.preventDefault();
      items[target]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center md:items-center md:p-6">
      <div
        aria-hidden="true"
        onClick={() => {
          if (!busy) onClose();
        }}
        className="absolute inset-0 bg-static-black/60 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex w-full flex-col overflow-hidden bg-bg-base outline-none md:max-h-full md:max-w-[520px] md:rounded-3xl md:border md:border-border md:shadow-card"
      >
        <div className="flex shrink-0 items-center gap-3 border-border-soft border-b p-4 md:items-start md:gap-4 md:border-dashed md:px-8 md:pt-8 md:pb-6">
          <span
            aria-hidden="true"
            className={`hidden size-14 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed md:flex ${tone === "danger" ? "border-error-border bg-error-focus text-error-text" : "border-border bg-bg-fill1 text-text-secondary"}`}
          >
            {icon}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2
              id={titleId}
              className="font-medium text-[18px] text-text leading-7 tracking-[-0.18px]"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="text-[14px] text-text-tertiary leading-5 tracking-[-0.14px]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-disabled={busy || undefined}
            aria-label="Close"
            className={`flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:text-text md:bg-bg-fill1 ${FOCUS}`}
          >
            <XIcon size={16} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 md:px-8 md:pt-6 md:pb-6">
          {children}
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-border-soft border-t p-4 md:flex-row md:justify-end md:border-0 md:px-8 md:pt-0 md:pb-8">
          {footer}
        </div>
      </div>
    </div>
  );
}

export type ToastMessage = { tone: "success" | "error"; title: string; body?: string };
const ToastContext = createContext<((toast: ToastMessage) => void) | null>(null);
const TOAST_MS = 5000;

/** One toast host for Settings (Figma toasts): top centre, a new toast replaces the old one. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<{ key: number; toast: ToastMessage } | null>(null);
  const show = useCallback(
    (toast: ToastMessage) => setShown((prev) => ({ key: (prev?.key ?? 0) + 1, toast })),
    [],
  );
  const key = shown?.key;
  useEffect(() => {
    if (key === undefined) return;
    const timer = window.setTimeout(() => setShown(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [key]);
  const value = useMemo(() => show, [show]);
  const error = shown?.toast.tone === "error";
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex justify-center md:inset-x-auto md:left-1/2 md:w-[440px] md:-translate-x-1/2">
        <div
          role={error ? "alert" : "status"}
          aria-live={error ? "assertive" : "polite"}
          aria-atomic="true"
          className="pointer-events-auto w-full"
        >
          {shown ? (
            <div
              key={shown.key}
              className="flex items-start gap-2 rounded-[10px] border border-border bg-bg-elevation-1 py-3 pr-3 pl-3 shadow-e2"
            >
              <span
                className={`mt-0.5 shrink-0 ${error ? "text-error-text" : "text-success-text"}`}
              >
                {error ? <AlertCircleIcon /> : <CheckCircleIcon />}
              </span>
              <div className="min-w-0 flex-1 text-[14px] leading-5 tracking-[-0.14px]">
                <p className="font-medium text-text">{shown.toast.title}</p>
                {shown.toast.body ? (
                  <p className="text-text-secondary">{shown.toast.body}</p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setShown(null)}
                className={`flex size-6 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-bg-fill2 hover:text-text ${FOCUS}`}
              >
                <XIcon size={16} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (toast: ToastMessage) => void {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside <ToastProvider>");
  return value;
}
