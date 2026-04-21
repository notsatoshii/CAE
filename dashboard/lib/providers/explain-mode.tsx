"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ExplainModeContextValue = {
  explain: boolean;
  toggle: () => void;
  setExplain: (v: boolean) => void;
};

const ExplainModeContext = createContext<ExplainModeContextValue | null>(null);
const STORAGE_KEY = "explainMode";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target.isContentEditable) return true;
  return false;
}

export function ExplainModeProvider({ children }: { children: React.ReactNode }) {
  const [explain, setExplainState] = useState<boolean>(true);

  // Hydrate from localStorage on mount (client-only to avoid hydration mismatch).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "false") setExplainState(false);
  }, []);

  // Persist on change.
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(explain));
  }, [explain]);

  const setExplain = useCallback((v: boolean) => setExplainState(v), []);
  const toggle = useCallback(() => setExplainState((prev) => !prev), []);

  // Ctrl+E global toggle.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey)) return;
      if (e.key.toLowerCase() !== "e") return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      setExplainState((prev) => !prev);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <ExplainModeContext.Provider value={{ explain, toggle, setExplain }}>
      {children}
    </ExplainModeContext.Provider>
  );
}

export function useExplainMode(): ExplainModeContextValue {
  const ctx = useContext(ExplainModeContext);
  if (!ctx) throw new Error("useExplainMode must be used inside ExplainModeProvider");
  return ctx;
}
