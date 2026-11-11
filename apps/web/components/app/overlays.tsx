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
import { CommandPalette } from "../app-command/palette";
import { SubmitDialog } from "../app-submit/submit-dialog";

/**
 * Shell-level overlays: the Submit a resource dialog and the command palette. Their open state
 * lives here so the top bar buttons, the palette's "Submit a resource" action and the ⌘K / Ctrl+K
 * shortcut all drive the same two dialogs. Mounted once, inside the signed-in shell.
 */
type Overlays = {
  openSubmit: () => void;
  openPalette: () => void;
};

const OverlaysContext = createContext<Overlays | null>(null);

export function useOverlays(): Overlays {
  const value = useContext(OverlaysContext);
  if (!value) throw new Error("useOverlays must be used inside the app shell");
  return value;
}

export function OverlaysProvider({ children }: { children: ReactNode }) {
  const [submitOpen, setSubmitOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const submitOpenRef = useRef(false);
  submitOpenRef.current = submitOpen;

  const openSubmit = useCallback(() => setSubmitOpen(true), []);
  const closeSubmit = useCallback(() => setSubmitOpen(false), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const value = useMemo(() => ({ openSubmit, openPalette }), [openSubmit, openPalette]);

  // The combination works anywhere, even inside another field; it toggles the palette. It does
  // nothing while the Submit dialog is open (that dialog is modal too).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "k" || submitOpenRef.current) return;
      event.preventDefault();
      setPaletteOpen((open) => !open);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <OverlaysContext.Provider value={value}>
      {children}
      {paletteOpen ? <CommandPalette onClose={closePalette} /> : null}
      <SubmitDialog open={submitOpen} onClose={closeSubmit} />
    </OverlaysContext.Provider>
  );
}
