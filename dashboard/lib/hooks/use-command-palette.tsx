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
    const kbRaw = keybindingById("palette.open");
    if (!kbRaw) {
      console.error("[palette] KEYBINDINGS missing 'palette.open' entry");
      return;
    }
    // Narrow to non-undefined so TS is happy inside the closure.
    const kb = kbRaw;

    function onKeyDown(e: KeyboardEvent) {
      // Check both e.target (real events) and document.activeElement (jsdom/test env)
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;
      // palette.open uses "⌘" but Ctrl+K should also work on win/linux.
      // matchesKeydown checks ⌘ strictly; add a Ctrl+K fallback for cross-platform.
      // Note: "K" is the last chip in kb.keys — reuse it rather than hardcoding.
      const lastKey = kb.keys[kb.keys.length - 1].toLowerCase();
      const isCtrlK = e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === lastKey;
      if (!matchesKeydown(kb, e) && !isCtrlK) return;
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
