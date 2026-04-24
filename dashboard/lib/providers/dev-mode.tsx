"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { keybindingById, matchesKeydown } from "@/lib/keybindings";

type DevModeContextValue = {
  dev: boolean;
  toggle: () => void;
  setDev: (v: boolean) => void;
};

const DevModeContext = createContext<DevModeContextValue | null>(null);
const STORAGE_KEY = "devMode";
const COOKIE_KEY = "devMode";
// 1 year — matches typical preference-cookie lifetime. Surfaced to the server
// via next/headers `cookies()` so SSR can render the correct copy/aria-labels
// and avoid hydration mismatches (Class 9 fix for /chat aria-label flip).
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function writeDevModeCookie(dev: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie =
    `${COOKIE_KEY}=${dev ? "true" : "false"}; ` +
    `path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target.isContentEditable) return true;
  return false;
}

export function DevModeProvider({ children }: { children: React.ReactNode }) {
  const [dev, setDevState] = useState<boolean>(false);

  // Hydrate from localStorage on mount (client-only to avoid hydration mismatch).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setDevState(true);
  }, []);

  // Persist on change — both localStorage (for this provider on next load)
  // and a cookie (for server-rendered pages like /chat that need the value
  // during SSR to avoid hydration mismatches).
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(dev));
    writeDevModeCookie(dev);
  }, [dev]);

  const setDev = useCallback((v: boolean) => setDevState(v), []);
  const toggle = useCallback(() => setDevState((prev) => !prev), []);

  // ⌘Shift+D global toggle — key spec driven by KEYBINDINGS registry (SHO-01).
  // Note: KEYBINDINGS uses "⌘" (mac cmd). On win/linux, metaKey maps to the
  // Windows/Super key which is rarely used; Ctrl+Shift+D is the practical
  // equivalent but is NOT in the registry. The registry entry covers mac;
  // win/linux users may use DevMode via the UI toggle instead.
  useEffect(() => {
    const kb = keybindingById("devmode.toggle");
    if (!kb) return; // defensive: registry hole = no-op, don't crash
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      if (!matchesKeydown(kb!, e)) return;
      e.preventDefault();
      setDevState((prev) => !prev);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <DevModeContext.Provider value={{ dev, toggle, setDev }}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode(): DevModeContextValue {
  const ctx = useContext(DevModeContext);
  if (!ctx) throw new Error("useDevMode must be used inside DevModeProvider");
  return ctx;
}
