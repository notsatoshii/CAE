"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { keybindingById, matchesKeydown } from "@/lib/keybindings";

export interface ShortcutOverlayValue {
  readonly open: boolean;
  readonly setOpen: (v: boolean) => void;
  readonly toggle: () => void;
}

const Ctx = createContext<ShortcutOverlayValue | null>(null);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target.isContentEditable) return true;
  return false;
}

export function ShortcutOverlayProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    const kbRaw = keybindingById("shortcuts.open");
    if (!kbRaw) {
      console.error("[shortcuts] KEYBINDINGS missing 'shortcuts.open' entry");
      return;
    }
    // Narrow to non-undefined so TS is happy inside the closure.
    const kb = kbRaw;

    function onKeyDown(e: KeyboardEvent) {
      // Guard: don't intercept when typing in an input
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement))
        return;
      // "?" fires as key="?" directly (matchesKeydown handles this), or as
      // key="/" with shiftKey on US keyboard layout — keep the layout fallback.
      const isShiftSlash =
        e.key === "/" && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (!matchesKeydown(kb, e) && !isShiftSlash) return;
      e.preventDefault();
      setOpen((v) => !v);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return <Ctx.Provider value={{ open, setOpen, toggle }}>{children}</Ctx.Provider>;
}

export function useShortcutOverlay(): ShortcutOverlayValue {
  const v = useContext(Ctx);
  if (!v)
    throw new Error(
      "useShortcutOverlay must be used within ShortcutOverlayProvider",
    );
  return v;
}
