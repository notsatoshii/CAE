/**
 * floor-toolbar.test.tsx — TDD RED for FloorToolbar (Plan 11-04, Task 2)
 *
 * 14 tests covering all 5 controls + labelFor + window.open shape + re-auth banner.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock useDevMode — default dev=false
const mockUseDevMode = vi.fn(() => ({ dev: false, toggle: vi.fn(), setDev: vi.fn() }));
vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => mockUseDevMode(),
}));

import { labelFor } from "@/lib/copy/labels";
import { FloorToolbar } from "./floor-toolbar";

const defaultProps = {
  paused: false,
  onTogglePause: vi.fn(),
  popout: false,
  minimized: false,
  onToggleMinimize: vi.fn(),
  projectPath: "/tmp/test-project",
  legendOpen: false,
  onToggleLegend: vi.fn(),
  metrics: { effectsCount: 0, queueSize: 0, authDrifted: false },
};

describe("FloorToolbar", () => {
  let originalOpen: typeof window.open;

  beforeEach(() => {
    originalOpen = window.open;
    window.open = vi.fn();
    mockUseDevMode.mockReturnValue({ dev: false, toggle: vi.fn(), setDev: vi.fn() });
    defaultProps.onTogglePause = vi.fn();
    defaultProps.onToggleMinimize = vi.fn();
    defaultProps.onToggleLegend = vi.fn();
  });

  afterEach(() => {
    window.open = originalOpen;
  });

  it("1. Pause button renders and fires onTogglePause on click", () => {
    render(<FloorToolbar {...defaultProps} paused={false} />);
    const pauseBtn = screen.getByLabelText(/pause/i);
    expect(pauseBtn).toBeTruthy();
    fireEvent.click(pauseBtn);
    expect(defaultProps.onTogglePause).toHaveBeenCalledTimes(1);
  });

  it("2. When paused=true, button aria-label reflects resume/play state", () => {
    render(<FloorToolbar {...defaultProps} paused={true} />);
    // When paused, the button should show "Resume" or "Play" semantics
    const btn = screen.getByRole("button", { name: /resume|play/i });
    expect(btn).toBeTruthy();
  });

  it("3. Pop-out button visible when popout=false; click calls window.open with correct args", () => {
    render(<FloorToolbar {...defaultProps} popout={false} />);
    const popOutBtn = screen.getByLabelText(/pop out|new window|open in/i);
    expect(popOutBtn).toBeTruthy();
    fireEvent.click(popOutBtn);
    expect(window.open).toHaveBeenCalledTimes(1);
    const [url, name, features] = (window.open as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, string];
    expect(url).toMatch(/^\/floor\?popout=1&project=/);
    expect(name).toBe("cae-live-floor");
    expect(features).toMatch(/width=960,height=720/);
  });

  it("4. Pop-out button hidden when popout=true", () => {
    render(<FloorToolbar {...defaultProps} popout={true} />);
    const popOutBtn = screen.queryByLabelText(/pop out|new window|open in/i);
    expect(popOutBtn).toBeNull();
  });

  it("5. Minimize button hidden when popout=false", () => {
    render(<FloorToolbar {...defaultProps} popout={false} />);
    const minimizeBtn = screen.queryByLabelText(/minimize|hide/i);
    expect(minimizeBtn).toBeNull();
  });

  it("6. Minimize button visible when popout=true; click fires onToggleMinimize", () => {
    render(
      <FloorToolbar
        {...defaultProps}
        popout={true}
        minimized={false}
        onToggleMinimize={defaultProps.onToggleMinimize}
      />
    );
    const minimizeBtn = screen.getByLabelText(/minimize|hide/i);
    expect(minimizeBtn).toBeTruthy();
    fireEvent.click(minimizeBtn);
    expect(defaultProps.onToggleMinimize).toHaveBeenCalledTimes(1);
  });

  it("7. Legend toggle button always renders; click fires onToggleLegend; aria-pressed=true when legendOpen=true", () => {
    const { rerender } = render(<FloorToolbar {...defaultProps} legendOpen={false} />);
    const legendBtn = screen.getByLabelText(/legend|what am i/i);
    expect(legendBtn).toBeTruthy();
    fireEvent.click(legendBtn);
    expect(defaultProps.onToggleLegend).toHaveBeenCalledTimes(1);
    rerender(<FloorToolbar {...defaultProps} legendOpen={true} />);
    const pressedBtn = screen.getByLabelText(/legend|what am i/i);
    expect(pressedBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("8. Re-auth banner shown when authDrifted=true", () => {
    render(
      <FloorToolbar
        {...defaultProps}
        metrics={{ effectsCount: 0, queueSize: 0, authDrifted: true }}
      />
    );
    const banner = screen.getByRole("alert");
    expect(banner.textContent?.toLowerCase()).toMatch(/re-auth|sign in/i);
  });

  it("9. Re-auth banner hidden when authDrifted=false", () => {
    render(
      <FloorToolbar
        {...defaultProps}
        metrics={{ effectsCount: 0, queueSize: 0, authDrifted: false }}
      />
    );
    const banner = screen.queryByRole("alert");
    expect(banner).toBeNull();
  });

  it("10. Dev-mode counter strip shows effectsCount and queueSize when dev=true", () => {
    mockUseDevMode.mockReturnValue({ dev: true, toggle: vi.fn(), setDev: vi.fn() });
    render(
      <FloorToolbar
        {...defaultProps}
        metrics={{ effectsCount: 3, queueSize: 7, authDrifted: false }}
      />
    );
    expect(screen.getByText(/3/)).toBeTruthy();
    expect(screen.getByText(/7/)).toBeTruthy();
  });

  it("11. Counter strip hidden in founder mode (dev=false)", () => {
    mockUseDevMode.mockReturnValue({ dev: false, toggle: vi.fn(), setDev: vi.fn() });
    render(
      <FloorToolbar
        {...defaultProps}
        metrics={{ effectsCount: 3, queueSize: 7, authDrifted: false }}
      />
    );
    // The debug strip should not be rendered
    const strip = document.querySelector("[data-testid='floor-debug-strip']");
    expect(strip).toBeNull();
  });

  it("12. projectPath=null disables Pop-out button; click does NOT call window.open", () => {
    render(<FloorToolbar {...defaultProps} popout={false} projectPath={null} />);
    const popOutBtn = screen.getByLabelText(/pop out|new window|open in/i);
    expect(popOutBtn).toBeTruthy();
    expect(popOutBtn.hasAttribute("disabled")).toBe(true);
    fireEvent.click(popOutBtn);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("13. Pause button aria-label uses labelFor(dev) floorPause string", () => {
    // dev=false (founder mode)
    mockUseDevMode.mockReturnValue({ dev: false, toggle: vi.fn(), setDev: vi.fn() });
    const { unmount } = render(<FloorToolbar {...defaultProps} paused={false} />);
    const founderLabel = labelFor(false).floorPause;
    const pauseBtn = screen.getByRole("button", { name: founderLabel });
    expect(pauseBtn).toBeTruthy();
    unmount();

    // dev=true
    mockUseDevMode.mockReturnValue({ dev: true, toggle: vi.fn(), setDev: vi.fn() });
    render(<FloorToolbar {...defaultProps} paused={false} />);
    const devLabel = labelFor(true).floorPause;
    const pauseBtnDev = screen.getByRole("button", { name: devLabel });
    expect(pauseBtnDev).toBeTruthy();
  });

  it("14. no dollar signs in source file", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(
      resolve("/home/cae/ctrl-alt-elite/dashboard/components/floor/floor-toolbar.tsx"),
      "utf8"
    );
    expect(src).not.toContain("$");
  });
});
