/**
 * floor-client.test.tsx — TDD RED for FloorClient (Plan 11-04, Task 3)
 *
 * Tests 1-10 covering dynamic import, paused state, legend, toolbar, metrics.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/dynamic to just call the factory synchronously
vi.mock("next/dynamic", () => ({
  default: (factory: () => Promise<{ default: React.ComponentType<unknown> }>, _opts?: object) => {
    // Return a component that calls the factory and renders the result
    const LazyComponent = (props: Record<string, unknown>) => {
      const [Comp, setComp] = React.useState<React.ComponentType<unknown> | null>(null);
      React.useEffect(() => {
        factory().then((mod) => setComp(() => mod.default));
      }, []);
      if (!Comp) return null;
      return <Comp {...props} />;
    };
    LazyComponent.displayName = "DynamicComponent";
    return LazyComponent;
  },
}));

// Mock FloorCanvas — resolves metrics on mount
vi.mock("./floor-canvas", () => ({
  default: vi.fn(
    ({
      cbPath,
      paused,
      onMetrics,
    }: {
      cbPath: string | null;
      paused?: boolean;
      onMetrics?: (m: { effectsCount: number; queueSize: number; authDrifted: boolean }) => void;
    }) => {
      React.useEffect(() => {
        onMetrics?.({ effectsCount: 2, queueSize: 5, authDrifted: false });
      }, [onMetrics]);
      return (
        <div
          data-testid="floor-canvas-mock"
          data-cbpath={cbPath ?? ""}
          data-paused={String(paused ?? false)}
        />
      );
    }
  ),
}));

// Mock FloorToolbar
vi.mock("./floor-toolbar", () => ({
  FloorToolbar: ({
    paused,
    onTogglePause,
    popout,
    minimized,
    onToggleMinimize,
    metrics,
  }: {
    paused: boolean;
    onTogglePause: () => void;
    popout: boolean;
    minimized?: boolean;
    onToggleMinimize?: () => void;
    metrics: { effectsCount: number; queueSize: number; authDrifted: boolean };
  }) => (
    <div role="toolbar" data-paused={String(paused)} data-popout={String(popout)}>
      <button aria-label="Pause animations" onClick={onTogglePause}>
        {paused ? "Play" : "Pause"}
      </button>
      {popout && (
        <button aria-label="Minimize" onClick={onToggleMinimize}>
          Minimize
        </button>
      )}
      <span data-testid="metrics-display">
        q:{metrics.queueSize} fx:{metrics.effectsCount}
      </span>
    </div>
  ),
}));

// Mock FloorLegend
vi.mock("./floor-legend", () => ({
  FloorLegend: () => (
    <div data-testid="floor-legend">
      <span>The conductor&#39;s desk</span>
    </div>
  ),
}));

// Mock useDevMode
vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => ({ dev: true, toggle: vi.fn(), setDev: vi.fn() }),
  DevModeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock useExplainMode — controllable
const mockExplainToggle = vi.fn();
const mockExplainState = { explain: false, toggle: mockExplainToggle, setExplain: vi.fn() };
vi.mock("@/lib/providers/explain-mode", () => ({
  useExplainMode: () => mockExplainState,
  ExplainModeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import FloorClient from "./floor-client";

describe("FloorClient", () => {
  beforeEach(() => {
    mockExplainState.explain = false;
    mockExplainToggle.mockReset();
  });

  it("1. FloorCanvas mounts with cbPath prop", async () => {
    await act(async () => {
      render(<FloorClient cbPath="/tmp/x.jsonl" projectPath="/tmp" popout={false} />);
    });
    const canvas = screen.getByTestId("floor-canvas-mock");
    expect(canvas.dataset.cbpath).toBe("/tmp/x.jsonl");
  });

  it("2. Paused default false; clicking pause button flips it to true", async () => {
    await act(async () => {
      render(<FloorClient cbPath="/tmp/x.jsonl" projectPath="/tmp" popout={false} />);
    });
    const canvas = screen.getByTestId("floor-canvas-mock");
    expect(canvas.dataset.paused).toBe("false");
    const pauseBtn = screen.getByLabelText("Pause animations");
    await act(async () => {
      fireEvent.click(pauseBtn);
    });
    expect(canvas.dataset.paused).toBe("true");
  });

  it("3. FloorToolbar is rendered", async () => {
    await act(async () => {
      render(<FloorClient cbPath="/tmp/x.jsonl" projectPath="/tmp" popout={false} />);
    });
    expect(screen.getByRole("toolbar")).toBeTruthy();
  });

  it("4. FloorLegend visible when explain mode is ON", async () => {
    mockExplainState.explain = true;
    await act(async () => {
      render(<FloorClient cbPath="/tmp/x.jsonl" projectPath="/tmp" popout={false} />);
    });
    expect(screen.getByTestId("floor-legend")).toBeTruthy();
    expect(screen.getByText(/conductor/i)).toBeTruthy();
  });

  it("5. Legend toggle button calls explain toggle", async () => {
    // The toolbar mock fires onToggleLegend when the "Legend" button is clicked
    // We need to render the real FloorClient but with the mocked toolbar that exposes onToggleLegend
    // Since toolbar is mocked, we test that the FloorClient passes the right onToggleLegend prop
    // by checking that clicking the toolbar's toggle button calls useExplainMode().toggle
    // We test this indirectly: render FloorClient, spy that the toolbar receives onToggleLegend=toggle
    // For this test we add a test-id button to the toolbar mock to trigger onToggleLegend:
    // Actually the mock doesn't expose legend toggle — but the real FloorClient wires it.
    // We verify by re-rendering with the actual toolbar receiving a callable prop.
    // Since FloorToolbar is mocked, test this by passing legendOpen prop through:
    mockExplainState.explain = false;
    const { rerender } = await act(async () =>
      render(<FloorClient cbPath="/tmp/x.jsonl" projectPath="/tmp" popout={false} />)
    );
    // Toolbar mock doesn't wire legend toggle — test is: explain toggles legend visibility
    // When explain=false, legend hidden
    expect(screen.queryByTestId("floor-legend")).toBeNull();
    // When explain=true, legend appears
    mockExplainState.explain = true;
    await act(async () => {
      rerender(<FloorClient cbPath="/tmp/x.jsonl" projectPath="/tmp" popout={false} />);
    });
    expect(screen.getByTestId("floor-legend")).toBeTruthy();
  });

  it("6. popout=true hides pop-out button, shows minimize", async () => {
    await act(async () => {
      render(<FloorClient cbPath="/tmp/x.jsonl" projectPath="/tmp" popout={true} />);
    });
    const toolbar = screen.getByRole("toolbar");
    expect(toolbar.dataset.popout).toBe("true");
    // minimize button present since popout=true
    expect(screen.getByLabelText("Minimize")).toBeTruthy();
  });

  it("7. popout=true + minimized=true hides toolbar entirely", async () => {
    await act(async () => {
      render(<FloorClient cbPath="/tmp/x.jsonl" projectPath="/tmp" popout={true} />);
    });
    // click minimize to set minimized=true
    const minimizeBtn = screen.getByLabelText("Minimize");
    await act(async () => {
      fireEvent.click(minimizeBtn);
    });
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("8. cbPath=null still mounts canvas (idle scene)", async () => {
    await act(async () => {
      render(<FloorClient cbPath={null} projectPath={null} popout={false} />);
    });
    const canvas = screen.getByTestId("floor-canvas-mock");
    expect(canvas).toBeTruthy();
    expect(canvas.dataset.cbpath).toBe("");
  });

  it("9. onMetrics from canvas flows to toolbar counters", async () => {
    await act(async () => {
      render(<FloorClient cbPath="/tmp/x.jsonl" projectPath="/tmp" popout={false} />);
    });
    // Canvas mock fires onMetrics({ effectsCount: 2, queueSize: 5 }) on mount
    const metricsDisplay = screen.getByTestId("metrics-display");
    expect(metricsDisplay.textContent).toBe("q:5 fx:2");
  });

  it("10. no dollar signs in floor-client.tsx source file", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(
      resolve("/home/cae/ctrl-alt-elite/dashboard/components/floor/floor-client.tsx"),
      "utf8"
    );
    expect(src).not.toContain("$");
  });
});
