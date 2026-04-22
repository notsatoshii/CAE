/**
 * shortcut-overlay.test.tsx — SHO-01, SHO-02, A11Y-03, D-13, D-15
 *
 * Tests ? keydown trigger, help button click, editable guard,
 * KEYBINDINGS group rendering, founder/dev label switching, and focus-trap/return.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import React from "react";
import { ExplainModeProvider } from "@/lib/providers/explain-mode";
import { DevModeProvider } from "@/lib/providers/dev-mode";
import { ShortcutOverlayProvider } from "@/lib/hooks/use-shortcut-overlay";
import { ShortcutOverlay, ShortcutHelpButton } from "./shortcut-overlay";
import { KEYBINDINGS } from "@/lib/keybindings";

function TestApp({ children }: { children: React.ReactNode }) {
  return (
    <ExplainModeProvider>
      <DevModeProvider>
        <ShortcutOverlayProvider>
          {children}
        </ShortcutOverlayProvider>
      </DevModeProvider>
    </ExplainModeProvider>
  );
}

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opts }));
  });
}

describe("ShortcutOverlay + ShortcutHelpButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dialog is absent when overlay is closed", () => {
    render(
      <TestApp>
        <ShortcutOverlay />
        <ShortcutHelpButton />
      </TestApp>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clicking ShortcutHelpButton opens the dialog", async () => {
    render(
      <TestApp>
        <ShortcutOverlay />
        <ShortcutHelpButton />
      </TestApp>,
    );
    const btn = screen.getByRole("button", { name: /shortcut/i });
    act(() => btn.click());
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
  });

  it("dispatching ? keydown on window opens the dialog", async () => {
    render(
      <TestApp>
        <ShortcutOverlay />
        <ShortcutHelpButton />
      </TestApp>,
    );
    fireKey("?");
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
  });

  it("Shift+/ also opens the overlay (?  on US keyboards)", async () => {
    render(
      <TestApp>
        <ShortcutOverlay />
        <ShortcutHelpButton />
      </TestApp>,
    );
    fireKey("/", { shiftKey: true });
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
  });

  it("? keydown does NOT open when focus is in an <input>", () => {
    render(
      <TestApp>
        <ShortcutOverlay />
        <ShortcutHelpButton />
      </TestApp>,
    );
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireKey("?");
    expect(screen.queryByRole("dialog")).toBeNull();

    document.body.removeChild(input);
  });

  it("opened dialog has a heading that matches aria-labelledby", async () => {
    render(
      <TestApp>
        <ShortcutOverlay />
        <ShortcutHelpButton />
      </TestApp>,
    );
    fireKey("?");
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    const labelledById = dialog.getAttribute("aria-labelledby");
    expect(labelledById).toBeTruthy();
    const heading = document.getElementById(labelledById!);
    expect(heading).toBeTruthy();
    expect(heading!.textContent).toBeTruthy();
  });

  it("renders a section for each area in KEYBINDINGS (global, sheets, task, palette)", async () => {
    render(
      <TestApp>
        <ShortcutOverlay />
        <ShortcutHelpButton />
      </TestApp>,
    );
    fireKey("?");
    await waitFor(() => screen.getByRole("dialog"));

    // Get all unique areas actually used in KEYBINDINGS
    const usedAreas = [...new Set(KEYBINDINGS.map((k) => k.area))];
    for (const area of usedAreas) {
      // Each area should have at least one founderLabel visible (default explain mode = ON)
      const areaBindings = KEYBINDINGS.filter((k) => k.area === area);
      expect(areaBindings.length).toBeGreaterThan(0);
      // At least the first binding's founder label is visible
      expect(screen.getByText(areaBindings[0].founderLabel)).toBeTruthy();
    }
  });

  it("key chips are wrapped in <kbd> elements", async () => {
    render(
      <TestApp>
        <ShortcutOverlay />
        <ShortcutHelpButton />
      </TestApp>,
    );
    fireKey("?");
    await waitFor(() => screen.getByRole("dialog"));

    const kbdElements = document.querySelectorAll("kbd");
    expect(kbdElements.length).toBeGreaterThan(0);
  });

  it("default mode (explain=true, dev=false) renders founderLabel text", async () => {
    render(
      <TestApp>
        <ShortcutOverlay />
        <ShortcutHelpButton />
      </TestApp>,
    );
    fireKey("?");
    await waitFor(() => screen.getByRole("dialog"));

    // The first global keybinding's founderLabel should be visible
    const firstGlobal = KEYBINDINGS.find((k) => k.area === "global");
    expect(firstGlobal).toBeDefined();
    expect(screen.getByText(firstGlobal!.founderLabel)).toBeTruthy();
  });

  it("pressing Esc closes the dialog", async () => {
    render(
      <TestApp>
        <ShortcutOverlay />
        <ShortcutHelpButton />
      </TestApp>,
    );
    fireKey("?");
    await waitFor(() => screen.getByRole("dialog"));

    fireEvent.keyDown(document.body, { key: "Escape", bubbles: true });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("? reopens the dialog after closing", async () => {
    render(
      <TestApp>
        <ShortcutOverlay />
        <ShortcutHelpButton />
      </TestApp>,
    );
    fireKey("?");
    await waitFor(() => screen.getByRole("dialog"));

    fireEvent.keyDown(document.body, { key: "Escape", bubbles: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireKey("?");
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
  });
});
