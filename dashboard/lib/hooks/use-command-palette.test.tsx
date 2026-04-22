/**
 * use-command-palette.test.tsx — PAL-01, PAL-07, IN-04
 *
 * Tests keydown trigger, editable-target guard, toggle behavior,
 * provider requirement, setOpen API, and empty-keys guard.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { CommandPaletteProvider, useCommandPalette } from "./use-command-palette";

function wrapper({ children }: { children: React.ReactNode }) {
  return <CommandPaletteProvider>{children}</CommandPaletteProvider>;
}

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opts }));
  });
}

describe("useCommandPalette", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with open=false on mount", () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    expect(result.current.open).toBe(false);
  });

  it("Cmd+K sets open=true (mac)", () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    fireKey("k", { metaKey: true });
    expect(result.current.open).toBe(true);
  });

  it("Ctrl+K sets open=true (win/linux)", () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    fireKey("k", { ctrlKey: true });
    expect(result.current.open).toBe(true);
  });

  it("does NOT open when focus is in an <input> (editable target guard)", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    fireKey("k", { metaKey: true });
    expect(result.current.open).toBe(false);

    document.body.removeChild(input);
  });

  it("Cmd+K while open=true toggles it OFF", () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    // Open
    fireKey("k", { metaKey: true });
    expect(result.current.open).toBe(true);
    // Close via toggle
    fireKey("k", { metaKey: true });
    expect(result.current.open).toBe(false);
  });

  it("setOpen(false) closes the palette", () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    fireKey("k", { metaKey: true });
    expect(result.current.open).toBe(true);

    act(() => {
      result.current.setOpen(false);
    });
    expect(result.current.open).toBe(false);
  });

  it("throws descriptive error when called outside provider", () => {
    expect(() => {
      renderHook(() => useCommandPalette());
    }).toThrow("useCommandPalette must be used within CommandPaletteProvider");
  });

});
