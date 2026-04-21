"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type DevModeContextValue = {
  dev: boolean;
  toggle: () => void;
  setDev: (v: boolean) => void;
};

const DevModeContext = createContext<DevModeContextValue | null>(null);
const STORAGE_KEY = "devMode";

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

  // Persist on change.
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(dev));
  }, [dev]);

  const setDev = useCallback((v: boolean) => setDevState(v), []);
  const toggle = useCallback(() => setDevState((prev) => !prev), []);

  // Cmd+Shift+D (mac) / Ctrl+Shift+D (win/linux) global toggle.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey)) return;
      if (e.key.toLowerCase() !== "d") return;
      if (isEditableTarget(e.target)) return;
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
