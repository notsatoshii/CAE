/**
 * floor-popout-host.test.tsx — TDD for FloorPopoutHost (Plan 11-05, Task 2)
 *
 * 9 tests: render, document.title, resizeTo, no-resizeTo without opener,
 * Escape closes, Escape no-op without opener, cleanup removes listener,
 * document.title restored on unmount.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock FloorClient — records props
vi.mock("./floor-client", () => ({
  default: vi.fn((props: { cbPath: string | null; projectPath: string | null; popout: boolean }) => (
    <div
      data-testid="floor-client-mock"
      data-popout={String(props.popout)}
      data-cbpath={props.cbPath ?? ""}
      data-projectpath={props.projectPath ?? ""}
    />
  )),
}));

// Mock useDevMode — controllable
const mockUseDevMode = vi.fn(() => ({ dev: false, toggle: vi.fn(), setDev: vi.fn() }));
vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => mockUseDevMode(),
  DevModeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { FloorPopoutHost } from "./floor-popout-host";

// ---------------------------------------------------------------------------
// window stub helpers
// ---------------------------------------------------------------------------

function setOpener(value: { focus: ReturnType<typeof vi.fn> } | null) {
  Object.defineProperty(window, "opener", { configurable: true, writable: true, value });
}

describe("FloorPopoutHost", () => {
  let originalResizeTo: typeof window.resizeTo;
  let originalClose: typeof window.close;
  let openerFocus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalResizeTo = window.resizeTo;
    originalClose = window.close;
    window.resizeTo = vi.fn();
    window.close = vi.fn();
    openerFocus = vi.fn();
    setOpener({ focus: openerFocus });
    mockUseDevMode.mockReturnValue({ dev: false, toggle: vi.fn(), setDev: vi.fn() });
  });

  afterEach(() => {
    window.resizeTo = originalResizeTo;
    window.close = originalClose;
    setOpener(null);
  });

  // -------------------------------------------------------------------------
  // Test 1: renders FloorClient with popout=true
  // -------------------------------------------------------------------------
  it("1. Renders FloorClient with popout=true and correct props", async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<FloorPopoutHost cbPath="/x/.cae/metrics/cb.jsonl" projectPath="/x" />));
    });
    const mock = container.querySelector("[data-testid='floor-client-mock']");
    expect(mock).not.toBeNull();
    expect(mock?.getAttribute("data-popout")).toBe("true");
    expect(mock?.getAttribute("data-cbpath")).toBe("/x/.cae/metrics/cb.jsonl");
  });

  // -------------------------------------------------------------------------
  // Test 2: document.title set on mount (founder mode)
  // -------------------------------------------------------------------------
  it("2. Sets document.title to floorPageTitle + ' — pop out' on mount (founder)", async () => {
    mockUseDevMode.mockReturnValue({ dev: false, toggle: vi.fn(), setDev: vi.fn() });
    await act(async () => {
      render(<FloorPopoutHost cbPath={null} projectPath={null} />);
    });
    // FOUNDER floorPageTitle = "CAE Home"
    expect(document.title).toBe("CAE Home — pop out");
  });

  // -------------------------------------------------------------------------
  // Test 3: window.resizeTo called when opener set
  // -------------------------------------------------------------------------
  it("3. Calls window.resizeTo(960, 720) on mount when opener is set", async () => {
    await act(async () => {
      render(<FloorPopoutHost cbPath={null} projectPath={null} />);
    });
    expect(window.resizeTo).toHaveBeenCalledWith(960, 720);
  });

  // -------------------------------------------------------------------------
  // Test 4: window.resizeTo NOT called when opener is null
  // -------------------------------------------------------------------------
  it("4. Does NOT call window.resizeTo when opener is null", async () => {
    setOpener(null);
    await act(async () => {
      render(<FloorPopoutHost cbPath={null} projectPath={null} />);
    });
    expect(window.resizeTo).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 5: Escape key closes window when opener set
  // -------------------------------------------------------------------------
  it("5. Escape key calls opener.focus + window.close when opener is set", async () => {
    await act(async () => {
      render(<FloorPopoutHost cbPath={null} projectPath={null} />);
    });
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(openerFocus).toHaveBeenCalledTimes(1);
    expect(window.close).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Test 6: Escape key does NOT close when opener is null
  // -------------------------------------------------------------------------
  it("6. Escape key does NOT call window.close when opener is null", async () => {
    setOpener(null);
    await act(async () => {
      render(<FloorPopoutHost cbPath={null} projectPath={null} />);
    });
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(window.close).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 7: Escape listener removed on unmount
  // -------------------------------------------------------------------------
  it("7. Escape listener is removed after unmount — no close call after unmount", async () => {
    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = render(<FloorPopoutHost cbPath={null} projectPath={null} />));
    });
    // Fire Escape once while mounted — should close
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    const callsBefore = (window.close as ReturnType<typeof vi.fn>).mock.calls.length;
    // Unmount
    await act(async () => { unmount(); });
    // Fire Escape again — listener should be gone
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    const callsAfter = (window.close as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBe(callsBefore); // no additional calls
  });

  // -------------------------------------------------------------------------
  // Test 8: document.title restored on unmount
  // -------------------------------------------------------------------------
  it("8. document.title is restored to the previous title on unmount", async () => {
    const prevTitle = "My Dashboard";
    document.title = prevTitle;
    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = render(<FloorPopoutHost cbPath={null} projectPath={null} />));
    });
    // Title is now changed to pop-out title
    expect(document.title).toContain("pop out");
    // Unmount
    await act(async () => { unmount(); });
    // Title should be restored
    expect(document.title).toBe(prevTitle);
  });

  // -------------------------------------------------------------------------
  // Test 9: no dollar signs in source
  // -------------------------------------------------------------------------
  it("9. No dollar signs in floor-popout-host.tsx source", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync(
      "/home/cae/ctrl-alt-elite/dashboard/components/floor/floor-popout-host.tsx",
      "utf8"
    );
    expect(src).not.toContain("$");
  });
});
