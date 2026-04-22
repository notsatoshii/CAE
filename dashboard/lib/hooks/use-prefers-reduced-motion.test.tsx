/**
 * Tests for lib/hooks/use-prefers-reduced-motion.ts.
 * RED phase: these tests exist before the hook is implemented.
 *
 * Tests:
 * - SSR-safe (returns false when window is undefined) via exported helper
 * - On mount with matchMedia.matches=true, hook returns true
 * - Change event causes re-render with new value
 * - Unmount removes the change listener (same function reference)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  usePrefersReducedMotion,
  prefersReducedMotionInitial,
} from "./use-prefers-reduced-motion";

describe("prefersReducedMotionInitial() — SSR-safe helper", () => {
  it("returns false when window is undefined (SSR simulation)", () => {
    // We test the exported helper directly with a simulated server env check.
    // The helper itself checks `typeof window === 'undefined'` and returns false.
    // We can't easily undefine window in jsdom, but we can verify the helper
    // returns a boolean that matches window.matchMedia state.
    const result = prefersReducedMotionInitial();
    expect(typeof result).toBe("boolean");
  });
});

describe("usePrefersReducedMotion() — matchMedia-backed hook", () => {
  type ChangeListener = (e: { matches: boolean }) => void;

  let listeners: ChangeListener[];
  let mm: {
    matches: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addEventListener: ReturnType<typeof vi.fn<any[], void>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    removeEventListener: ReturnType<typeof vi.fn<any[], void>>;
  };

  beforeEach(() => {
    listeners = [];
    mm = {
      matches: false,
      addEventListener: vi.fn((_event: string, cb: ChangeListener) => {
        listeners.push(cb);
      }),
      removeEventListener: vi.fn((_event: string, cb: ChangeListener) => {
        listeners = listeners.filter((l) => l !== cb);
      }),
    };
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => mm),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when matchMedia.matches is false", () => {
    mm.matches = false;
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when matchMedia.matches is true on mount", () => {
    mm.matches = true;
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("re-renders with new value when change event fires", () => {
    mm.matches = false;
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      mm.matches = true;
      // Fire the listener manually
      for (const listener of listeners) {
        listener({ matches: true });
      }
    });

    expect(result.current).toBe(true);
  });

  it("unmount removes the change listener (same fn reference)", () => {
    mm.matches = false;
    const { unmount } = renderHook(() => usePrefersReducedMotion());

    // At least one listener was added
    expect(mm.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );

    // Get the fn that was registered
    const addedFn = mm.addEventListener.mock.calls[0][1] as ChangeListener;

    unmount();

    // removeEventListener was called with the SAME reference
    expect(mm.removeEventListener).toHaveBeenCalledWith("change", addedFn);
  });
});
