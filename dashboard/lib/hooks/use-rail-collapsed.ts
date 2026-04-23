"use client"

/**
 * useRailCollapsed — localStorage-backed boolean state for the left rail
 * collapse toggle (C2 fix-wave Class 7).
 *
 * Eric (2026-04-23): "current left side tab and other icons have no labels
 * so I can't know WTF they are. If I want to go from with labels to just
 * icons there should be minimizable menu but there currently isn't."
 *
 * Design notes:
 *   - Default is EXPANDED (labels visible). The prior sidebar default was
 *     collapsed, which is exactly what Eric complained about.
 *   - Persisted under localStorage key `cae.rail.collapsed` (boolean-string:
 *     "true" / "false"). Reading "true" means collapsed; anything else —
 *     including missing keys, SSR, or parse failure — means expanded.
 *   - SSR-safe: on first render (no window / no localStorage), we fall back
 *     to the optional `initialCollapsed` arg (threaded through from the
 *     server-rendered cookie). On mount we re-read localStorage to overwrite
 *     if the user previously persisted a different value.
 *   - Cross-tab: listens for the native `storage` event so two open tabs
 *     stay in sync.
 *   - A `toggle()` and `setCollapsed(boolean)` are returned; both write
 *     through to localStorage synchronously.
 *
 * NOT handled here:
 *   - Keyboard shortcut registration (lives in sidebar.tsx so the
 *     window-level listener is scoped to when the sidebar is mounted).
 *   - Cookie mirroring — sidebar.tsx still writes the `cae-sidebar-state`
 *     cookie on toggle so the server-render gets the right initial width
 *     on next navigation (no hydration flash).
 */

import { useCallback, useEffect, useState } from "react"

export const RAIL_COLLAPSED_STORAGE_KEY = "cae.rail.collapsed"

export interface UseRailCollapsedResult {
  readonly collapsed: boolean
  readonly setCollapsed: (next: boolean) => void
  readonly toggle: () => void
}

/**
 * Reads the persisted boolean. Returns `undefined` when no storage is
 * available (SSR / private-mode / disabled) or the stored value is
 * unparsable. Callers should fall back to a default in that case.
 */
export function readRailCollapsedFromStorage(): boolean | undefined {
  if (typeof window === "undefined") return undefined
  try {
    const raw = window.localStorage.getItem(RAIL_COLLAPSED_STORAGE_KEY)
    if (raw === "true") return true
    if (raw === "false") return false
    return undefined
  } catch {
    // Some browsers throw when localStorage is disabled (e.g. Safari private).
    return undefined
  }
}

/**
 * Writes the boolean to storage. Silently swallows errors — a failed write
 * must not break the UI.
 */
export function writeRailCollapsedToStorage(value: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(RAIL_COLLAPSED_STORAGE_KEY, value ? "true" : "false")
  } catch {
    // ignore
  }
}

export function useRailCollapsed(initialCollapsed = false): UseRailCollapsedResult {
  // Start from the server-provided default so first paint matches the cookie;
  // we re-read localStorage on mount below.
  const [collapsed, setCollapsedState] = useState<boolean>(initialCollapsed)

  // After mount, reconcile against localStorage (the authoritative client
  // value). If storage has a newer choice, adopt it.
  useEffect(() => {
    const stored = readRailCollapsedFromStorage()
    if (stored !== undefined && stored !== collapsed) {
      setCollapsedState(stored)
    }
    // Intentionally only runs once on mount — we don't want to thrash state
    // every time `collapsed` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cross-tab sync: if another tab writes to our key, mirror here.
  useEffect(() => {
    if (typeof window === "undefined") return
    function onStorage(e: StorageEvent) {
      if (e.key !== RAIL_COLLAPSED_STORAGE_KEY) return
      if (e.newValue === "true") setCollapsedState(true)
      else if (e.newValue === "false") setCollapsedState(false)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next)
    writeRailCollapsedToStorage(next)
  }, [])

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev
      writeRailCollapsedToStorage(next)
      return next
    })
  }, [])

  return { collapsed, setCollapsed, toggle }
}
