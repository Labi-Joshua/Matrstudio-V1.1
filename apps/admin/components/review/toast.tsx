"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { AlertIcon, CheckIcon, CrossIcon } from "./icons";
import { FOCUS } from "./ui";

type Tone = "success" | "warning" | "error";
type ToastItem = { id: number; tone: Tone; title: string; body?: string };
type Push = (toast: Omit<ToastItem, "id">) => void;

/**
 * Toasts live in a module-level store, so one pushed just before a route change (approve, then
 * the next item opens) is still on screen on the next page. Each page renders <ToastHost />.
 */
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

const push: Push = (toast) => {
  const id = nextId++;
  items = [...items.slice(-2), { ...toast, id }];
  emit();
  setTimeout(() => dismiss(id), 7000);
};

export const useToast = (): Push => push;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const TONE_ICON: Record<Tone, string> = {
  success: "text-success-text",
  warning: "text-warning-text",
  error: "text-error-text",
};

/** Toast cards (440px wide), top centre as in the "already reviewed" frame; a polite live region. */
export function ToastHost() {
  const list = useSyncExternalStore(
    subscribe,
    () => items,
    () => [],
  );
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col items-center gap-2"
    >
      {list.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-full max-w-[440px] items-start gap-3 rounded-xl border border-border bg-bg-elevation-1 p-3.5 shadow-lg"
        >
          <span className={`mt-0.5 ${TONE_ICON[t.tone]}`}>
            {t.tone === "success" ? <CheckIcon /> : <AlertIcon />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[14px] text-text leading-5">{t.title}</p>
            {t.body ? <p className="text-[13px] text-text-secondary leading-5">{t.body}</p> : null}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
            className={`rounded-md p-1 text-text-tertiary hover:text-text ${FOCUS}`}
          >
            <CrossIcon />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ToastHost />
    </>
  );
}
