"use client";

import { type Ref, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Cloudflare Turnstile widget. Loads https://challenges.cloudflare.com/turnstile/v0/api.js on
 * demand (only when a Turnstile is first rendered, so pages that never need it never load it) and
 * renders the widget with NEXT_PUBLIC_TURNSTILE_SITE_KEY.
 *
 * When the key is missing (development) it renders nothing and calls onUnavailable once, so the
 * screen can decide what to do; the API skips captcha checks in development.
 *
 * Use it only when the API answered captcha_required (sign in after 3 failures) or on forms that
 * always need it. After every submit that used the token, call ref.current?.reset(): a token is
 * single use.
 *
 *   const captcha = useRef<TurnstileHandle>(null);
 *   <Turnstile ref={captcha} onToken={setToken} />   // token is null when it expires or errors
 *   ...later: captcha.current?.reset();
 *
 * CSP: the page must allow script-src and frame-src for https://challenges.cloudflare.com.
 */
export type TurnstileHandle = { reset: () => void };

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
export const TURNSTILE_CONFIGURED = TURNSTILE_SITE_KEY.length > 0;

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "auto" | "light" | "dark";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () =>
        window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing"));
      script.onerror = () => {
        scriptPromise = null; // allow a later retry
        reject(new Error("turnstile failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function Turnstile({
  onToken,
  onUnavailable,
  ref,
}: {
  /** Called with the token when the check passes, and with null when it expires or errors. */
  onToken: (token: string | null) => void;
  /** Called once if the widget cannot run: no site key, or the script failed to load. */
  onUnavailable?: () => void;
  ref?: Ref<TurnstileHandle>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // Keep the latest callbacks without re-rendering the widget when a parent re-renders.
  const callbacks = useRef({ onToken, onUnavailable });
  callbacks.current = { onToken, onUnavailable };

  useImperativeHandle(ref, () => ({
    reset: () => {
      callbacks.current.onToken(null);
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    if (!TURNSTILE_CONFIGURED) {
      callbacks.current.onUnavailable?.();
      return;
    }
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !container.current) return;
        widgetId.current = api.render(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "auto",
          callback: (token) => callbacks.current.onToken(token),
          "expired-callback": () => callbacks.current.onToken(null),
          "error-callback": () => callbacks.current.onToken(null),
        });
      })
      .catch(() => {
        if (!cancelled) callbacks.current.onUnavailable?.();
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  if (!TURNSTILE_CONFIGURED) return null;
  return <div ref={container} className="min-h-[65px]" />;
}
