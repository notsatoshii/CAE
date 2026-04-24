/**
 * Metrics panels — backend fetch refused resilience (P17 W1-metrics-backend).
 *
 * Verifies that each panel renders an error placeholder (not a crash, not a
 * blank screen) when the /api/metrics fetch rejects with ERR_CONNECTION_REFUSED.
 *
 * Tests the integration of MetricsPollProvider + panel: the provider fetches,
 * fails, sets error state, and the panel renders the error card.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MetricsPollProvider } from "@/lib/hooks/use-metrics-poll";
import { SpendingPanel } from "./spending-panel";
import { ReliabilityPanel } from "./reliability-panel";
import { SpeedPanel } from "./speed-panel";

vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => ({ dev: false, toggle: () => {}, setDev: () => {} }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function withProvider(children: React.ReactNode) {
  return render(
    <MetricsPollProvider intervalMs={60_000}>{children}</MetricsPollProvider>,
  );
}

describe("metrics panels — fetch refused", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ERR_CONNECTION_REFUSED")),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("SpendingPanel renders error placeholder, not blank", async () => {
    withProvider(<SpendingPanel />);
    await waitFor(() =>
      expect(screen.getByTestId("spending-panel-error")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  it("ReliabilityPanel renders error placeholder, not blank", async () => {
    withProvider(<ReliabilityPanel />);
    await waitFor(() =>
      expect(screen.getByTestId("reliability-panel-error")).toBeInTheDocument(),
    );
  });

  it("SpeedPanel renders error placeholder, not blank", async () => {
    withProvider(<SpeedPanel />);
    await waitFor(() =>
      expect(screen.getByTestId("speed-panel-error")).toBeInTheDocument(),
    );
  });
});
