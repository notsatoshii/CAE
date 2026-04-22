/**
 * WR-02 regression — metrics panels must not show EmptyState during loading.
 *
 * Before the fix all three panels collapsed loading + empty into a single
 * `!data` branch that rendered the "No numbers yet." EmptyState copy even
 * while the first fetch was still in-flight (~0–5 s window on every page
 * load). After the fix:
 *   - loading && !data  → loading copy ("Pulling the numbers…")
 *   - !loading && !data → EmptyState ("No numbers yet.")
 *   - data present      → full panel (no empty state at all)
 *
 * We mock useMetricsPoll() so each test can control {data, error, loading}
 * independently without touching the real provider or network.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReliabilityPanel } from "./reliability-panel";
import { SpeedPanel } from "./speed-panel";
import { SpendingPanel } from "./spending-panel";

// ── shared mocks ────────────────────────────────────────────────────────────

vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => ({ dev: false, toggle: () => {}, setDev: () => {} }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// useMetricsPoll is controlled per-test via mockReturnValue.
const mockUseMetricsPoll = vi.fn();
vi.mock("@/lib/hooks/use-metrics-poll", () => ({
  useMetricsPoll: () => mockUseMetricsPoll(),
}));

// ── helpers ─────────────────────────────────────────────────────────────────

const LOADING_STATE = { data: null, error: null, loading: true };
const EMPTY_STATE   = { data: null, error: null, loading: false };

// ── ReliabilityPanel ────────────────────────────────────────────────────────

describe("ReliabilityPanel — WR-02 loading vs empty distinction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders loading copy (not EmptyState) while loading=true and data=null", () => {
    mockUseMetricsPoll.mockReturnValue(LOADING_STATE);
    render(<ReliabilityPanel />);

    // The testid stays "reliability-panel-loading"
    expect(screen.getByTestId("reliability-panel-loading")).toBeInTheDocument();
    // Must NOT show the EmptyState heading "No numbers yet." / "Samples empty."
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  it("renders EmptyState only after loading=false and data=null", () => {
    mockUseMetricsPoll.mockReturnValue(EMPTY_STATE);
    render(<ReliabilityPanel />);

    expect(screen.getByTestId("reliability-panel-empty")).toBeInTheDocument();
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });
});

// ── SpeedPanel ───────────────────────────────────────────────────────────────

describe("SpeedPanel — WR-02 loading vs empty distinction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders loading copy (not EmptyState) while loading=true and data=null", () => {
    mockUseMetricsPoll.mockReturnValue(LOADING_STATE);
    render(<SpeedPanel />);

    expect(screen.getByTestId("speed-panel-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  it("renders EmptyState only after loading=false and data=null", () => {
    mockUseMetricsPoll.mockReturnValue(EMPTY_STATE);
    render(<SpeedPanel />);

    expect(screen.getByTestId("speed-panel-empty")).toBeInTheDocument();
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });
});

// ── SpendingPanel ────────────────────────────────────────────────────────────

describe("SpendingPanel — WR-02 loading vs empty distinction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders loading copy (not EmptyState) while loading=true and data=null", () => {
    mockUseMetricsPoll.mockReturnValue(LOADING_STATE);
    render(<SpendingPanel />);

    expect(screen.getByTestId("spending-panel-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  it("renders EmptyState only after loading=false and data=null", () => {
    mockUseMetricsPoll.mockReturnValue(EMPTY_STATE);
    render(<SpendingPanel />);

    expect(screen.getByTestId("spending-panel-empty")).toBeInTheDocument();
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });
});
