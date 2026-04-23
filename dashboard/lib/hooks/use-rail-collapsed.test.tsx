/**
 * useRailCollapsed tests — C2 fix-wave Class 7.
 *
 * Coverage:
 *   - Default returns initialCollapsed when storage is empty.
 *   - Reads `cae.rail.collapsed` from localStorage on mount and reconciles.
 *   - `toggle()` flips the bool AND writes the new value to storage.
 *   - `setCollapsed(bool)` writes through.
 *   - Cross-tab storage event updates state.
 *   - Storage throws are swallowed (no crash on disabled storage).
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import {
  useRailCollapsed,
  readRailCollapsedFromStorage,
  writeRailCollapsedToStorage,
  RAIL_COLLAPSED_STORAGE_KEY,
} from "./use-rail-collapsed"

// Minimal localStorage mock that survives the whole test file.
let store: Record<string, string> = {}
const memStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = v
  },
  removeItem: (k: string) => {
    delete store[k]
  },
  clear: () => {
    store = {}
  },
  get length() {
    return Object.keys(store).length
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
}

beforeEach(() => {
  store = {}
  Object.defineProperty(window, "localStorage", {
    value: memStorage,
    writable: true,
    configurable: true,
  })
})

describe("readRailCollapsedFromStorage()", () => {
  it("returns undefined when nothing is stored", () => {
    expect(readRailCollapsedFromStorage()).toBeUndefined()
  })

  it("returns true when stored value is 'true'", () => {
    store[RAIL_COLLAPSED_STORAGE_KEY] = "true"
    expect(readRailCollapsedFromStorage()).toBe(true)
  })

  it("returns false when stored value is 'false'", () => {
    store[RAIL_COLLAPSED_STORAGE_KEY] = "false"
    expect(readRailCollapsedFromStorage()).toBe(false)
  })

  it("returns undefined for garbage values (not a valid bool string)", () => {
    store[RAIL_COLLAPSED_STORAGE_KEY] = "maybe"
    expect(readRailCollapsedFromStorage()).toBeUndefined()
  })

  it("returns undefined when localStorage throws", () => {
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: () => {
          throw new Error("disabled")
        },
      },
      writable: true,
      configurable: true,
    })
    expect(readRailCollapsedFromStorage()).toBeUndefined()
  })
})

describe("writeRailCollapsedToStorage()", () => {
  it("writes 'true' when value is true", () => {
    writeRailCollapsedToStorage(true)
    expect(store[RAIL_COLLAPSED_STORAGE_KEY]).toBe("true")
  })

  it("writes 'false' when value is false", () => {
    writeRailCollapsedToStorage(false)
    expect(store[RAIL_COLLAPSED_STORAGE_KEY]).toBe("false")
  })

  it("swallows errors if localStorage.setItem throws", () => {
    Object.defineProperty(window, "localStorage", {
      value: {
        setItem: () => {
          throw new Error("quota")
        },
      },
      writable: true,
      configurable: true,
    })
    // Must not throw.
    expect(() => writeRailCollapsedToStorage(true)).not.toThrow()
  })
})

describe("useRailCollapsed()", () => {
  it("defaults to initialCollapsed when storage is empty", () => {
    const { result } = renderHook(() => useRailCollapsed(false))
    expect(result.current.collapsed).toBe(false)
  })

  it("respects the initialCollapsed=true seed when storage is empty", () => {
    const { result } = renderHook(() => useRailCollapsed(true))
    expect(result.current.collapsed).toBe(true)
  })

  it("adopts the stored value on mount even when it disagrees with the seed", () => {
    store[RAIL_COLLAPSED_STORAGE_KEY] = "true"
    const { result } = renderHook(() => useRailCollapsed(false))
    // After the mount effect runs, the stored value wins.
    expect(result.current.collapsed).toBe(true)
  })

  it("toggle() flips from false → true and writes 'true' to storage", () => {
    const { result } = renderHook(() => useRailCollapsed(false))
    act(() => {
      result.current.toggle()
    })
    expect(result.current.collapsed).toBe(true)
    expect(store[RAIL_COLLAPSED_STORAGE_KEY]).toBe("true")
  })

  it("toggle() twice returns to original state", () => {
    const { result } = renderHook(() => useRailCollapsed(false))
    act(() => {
      result.current.toggle()
    })
    act(() => {
      result.current.toggle()
    })
    expect(result.current.collapsed).toBe(false)
    expect(store[RAIL_COLLAPSED_STORAGE_KEY]).toBe("false")
  })

  it("setCollapsed(true) writes through", () => {
    const { result } = renderHook(() => useRailCollapsed(false))
    act(() => {
      result.current.setCollapsed(true)
    })
    expect(result.current.collapsed).toBe(true)
    expect(store[RAIL_COLLAPSED_STORAGE_KEY]).toBe("true")
  })

  it("setCollapsed(false) writes through", () => {
    const { result } = renderHook(() => useRailCollapsed(true))
    act(() => {
      result.current.setCollapsed(false)
    })
    expect(result.current.collapsed).toBe(false)
    expect(store[RAIL_COLLAPSED_STORAGE_KEY]).toBe("false")
  })

  it("reacts to cross-tab storage events", () => {
    const { result } = renderHook(() => useRailCollapsed(false))
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: RAIL_COLLAPSED_STORAGE_KEY,
          newValue: "true",
        }),
      )
    })
    expect(result.current.collapsed).toBe(true)
  })

  it("ignores storage events for other keys", () => {
    const { result } = renderHook(() => useRailCollapsed(false))
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "some.other.key",
          newValue: "true",
        }),
      )
    })
    expect(result.current.collapsed).toBe(false)
  })

  it("toggle() is stable across renders (callback identity preserved)", () => {
    const { result, rerender } = renderHook(() => useRailCollapsed(false))
    const firstToggle = result.current.toggle
    rerender()
    expect(result.current.toggle).toBe(firstToggle)
  })

  // Sanity check: we don't intend to throw if the caller is somehow server-
  // rendered (no window). renderHook forces a jsdom window, so we can't
  // truly simulate SSR, but we can verify the helpers return undefined /
  // no-op when window is absent — by stubbing typeof window.
  it("helpers are defensive when window is undefined (SSR-safe)", () => {
    // We can't blow away `window` in jsdom without breaking renderHook, so
    // just verify the code paths in the helpers. The hook itself is
    // exercised via renderHook (always client) above.
    const originalWindow = globalThis.window
    // @ts-expect-error — deliberately forcing SSR shape for this unit.
    delete globalThis.window
    try {
      expect(readRailCollapsedFromStorage()).toBeUndefined()
      expect(() => writeRailCollapsedToStorage(true)).not.toThrow()
    } finally {
      globalThis.window = originalWindow
    }
  })
})
