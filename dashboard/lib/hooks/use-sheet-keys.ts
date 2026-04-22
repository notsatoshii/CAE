"use client";

import { useEffect } from "react";
import { keybindingById, matchesKeydown } from "@/lib/keybindings";

export interface SheetKeysConfig {
  enabled: boolean;
  onClose: () => void;
  onPause: () => void;
  onAbort: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useSheetKeys(config: SheetKeysConfig): void {
  useEffect(() => {
    if (!config.enabled) return;
    if (typeof window === "undefined") return;

    // Key specs from KEYBINDINGS registry (SHO-01). Defensive: if any entry is
    // missing, that action silently becomes a no-op — never crashes.
    const kbClose = keybindingById("sheet.close");
    const kbPause = keybindingById("task.pause");
    const kbAbort = keybindingById("task.abort");

    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      // Esc → close
      if (kbClose && matchesKeydown(kbClose, e)) {
        e.preventDefault();
        e.stopPropagation();
        config.onClose();
        return;
      }

      // Ctrl+Shift+. → abort (must check abort before pause — more specific)
      if (kbAbort && matchesKeydown(kbAbort, e)) {
        e.preventDefault();
        e.stopPropagation();
        config.onAbort();
        return;
      }

      // Ctrl+. → pause
      if (kbPause && matchesKeydown(kbPause, e)) {
        e.preventDefault();
        e.stopPropagation();
        config.onPause();
        return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [config.enabled, config.onClose, config.onPause, config.onAbort]);
}
