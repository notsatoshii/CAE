"use client";

import { useEffect } from "react";

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

    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      // Esc (no modifier) → close
      if (
        e.key === "Escape" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        e.stopPropagation();
        config.onClose();
        return;
      }

      // Ctrl/Cmd + . → pause
      // Ctrl/Cmd + Shift + . → abort
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.altKey && e.key === ".") {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          config.onAbort();
        } else {
          config.onPause();
        }
        return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [config.enabled, config.onClose, config.onPause, config.onAbort]);
}
