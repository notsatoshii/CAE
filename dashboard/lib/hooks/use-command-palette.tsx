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

export interface CommandPaletteValue {
  readonly open: boolean;
  readonly setOpen: (v: boolean) => void;
  readonly toggle: () => void;
}

const Ctx = createContext<CommandPaletteValue | null>(null);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target.isContentEditable) return true;
  return false;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    // Sanity: registry entry exists (dev-only; fails loudly if someone deletes the row)
    if (!keybindingById("palette.open")) {
      console.error("[palette] KEYBINDINGS missing 'palette.open' entry");
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "k") return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey || e.altKey) return;
      // Check both e.target (real events) and document.activeElement (jsdom/test env)
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;
      e.preventDefault();
      setOpen((v) => !v);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return <Ctx.Provider value={{ open, setOpen, toggle }}>{children}</Ctx.Provider>;
}

export function useCommandPalette(): CommandPaletteValue {
  const v = useContext(Ctx);
  if (!v)
    throw new Error(
      "useCommandPalette must be used within CommandPaletteProvider",
    );
  return v;
}
