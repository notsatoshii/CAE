"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { keybindingById } from "@/lib/keybindings";

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
    // Sanity: registry entry exists
    if (!keybindingById("shortcuts.open")) {
      console.error("[shortcuts] KEYBINDINGS missing 'shortcuts.open' entry");
    }

    function onKeyDown(e: KeyboardEvent) {
      // "?" fires as key="?" directly, or as key="/" with shiftKey (US layout)
      const isQuestion =
        e.key === "?" || (e.key === "/" && e.shiftKey === true);
      if (!isQuestion) return;
      // Guard: no modifier combos except Shift (which produces ?)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Guard: don't intercept when typing in an input
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement))
        return;
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
