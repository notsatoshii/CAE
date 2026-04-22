/**
 * IN-04 regression — use-command-palette.tsx empty-keys guard.
 *
 * Before the fix at line 48:
 *   const lastKey = kb.keys[kb.keys.length - 1].toLowerCase();
 * If kb.keys is [], kb.keys[-1] === undefined and .toLowerCase() throws a
 * TypeError on every keydown, freezing the app's global keyboard handler.
 *
 * After the fix, a guard returns early when kb.keys.length === 0 and logs
 * a console.error — no throw, palette stays closed.
 *
 * This file is separate from use-command-palette.test.tsx so that its
 * vi.mock("@/lib/keybindings") override is scoped only to this module and
 * doesn't affect the tests in the sibling file (vitest hoists vi.mock to
 * the top of each file independently).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";

// Override keybindingById so palette.open returns an empty-keys binding.
// matchesKeydown is kept real so other code paths are unaffected.
vi.mock("@/lib/keybindings", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/keybindings")>();
  return {
    ...real,
    keybindingById: (id: string) =>
      id === "palette.open"
        ? {
            id: "palette.open",
            keys: [] as readonly string[],
            area: "global" as const,
            founderLabel: "",
            devLabel: "",
          }
        : real.keybindingById(id),
  };
});

import { CommandPaletteProvider, useCommandPalette } from "./use-command-palette";

function wrapper({ children }: { children: React.ReactNode }) {
  return <CommandPaletteProvider>{children}</CommandPaletteProvider>;
}

describe("useCommandPalette IN-04: empty keys guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does NOT crash on keydown when palette.open.keys is empty", () => {
    // Before fix: kb.keys[kb.keys.length - 1].toLowerCase() threw TypeError.
    // After fix: guard returns early — palette stays closed, no throw.
    const { result } = renderHook(() => useCommandPalette(), { wrapper });

    expect(() => {
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
        );
      });
    }).not.toThrow();

    // Palette must stay closed — empty-keys guard suppresses the event.
    expect(result.current.open).toBe(false);
  });

  it("logs a console.error (not throw) when palette.open.keys is empty", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderHook(() => useCommandPalette(), { wrapper });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
      );
    });

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("[palette] palette.open has no keys defined"),
    );

    errSpy.mockRestore();
  });
});
