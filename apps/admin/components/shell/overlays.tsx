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

/** Open state of the search palette; Cmd/Ctrl+K toggles it from anywhere in the portal. */
type Overlays = { paletteOpen: boolean; openPalette: () => void; closePalette: () => void };

const OverlaysContext = createContext<Overlays | null>(null);

export function OverlaysProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(
    () => ({ paletteOpen, openPalette, closePalette }),
    [paletteOpen, openPalette, closePalette],
  );
  return <OverlaysContext.Provider value={value}>{children}</OverlaysContext.Provider>;
}

export function useOverlays(): Overlays {
  const ctx = useContext(OverlaysContext);
  if (!ctx) throw new Error("useOverlays must be used inside <OverlaysProvider>");
  return ctx;
}
