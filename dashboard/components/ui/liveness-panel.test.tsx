/**
 * Tests for components/ui/liveness-panel.tsx
 *
 * C2-FIX-WAVE/Class 3 acceptance:
 *   - data-liveness attribute present and correctly set per state
 *   - sr-only data-truth marker rendered with matching state token
 *   - LastUpdated chip mounted (unless hideLastUpdated)
 *   - fallback copy rendered for empty/error/loading states
 *   - resolveLivenessState() picks the right bucket
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LivenessPanel, resolveLivenessState } from "./liveness-panel";

describe("resolveLivenessState", () => {
  it("returns 'error' when error is present", () => {
    expect(
      resolveLivenessState({
        data: { rows: [1] },
        error: new Error("boom"),
        lastUpdated: Date.now(),
      })
    ).toBe("error");
  });

  it("returns 'loading' before first fetch (lastUpdated null)", () => {
    expect(
      resolveLivenessState({
        data: null,
        error: null,
        lastUpdated: null,
      })
    ).toBe("loading");
  });

  it("returns 'empty' when isEmpty predicate matches", () => {
    expect(
      resolveLivenessState({
        data: { rows: [] },
        error: null,
        lastUpdated: Date.now(),
        isEmpty: (d) => d.rows.length === 0,
      })
    ).toBe("empty");
  });

  it("returns 'stale' when lastUpdated is older than stale_ms", () => {
    const now = Date.now();
    expect(
      resolveLivenessState({
        data: { rows: [1] },
        error: null,
        lastUpdated: now - 120_000,
        stale_ms: 60_000,
        now,
      })
    ).toBe("stale");
  });

  it("returns 'healthy' for fresh non-empty data", () => {
    const now = Date.now();
    expect(
      resolveLivenessState({
        data: { rows: [1] },
        error: null,
        lastUpdated: now - 1_000,
        stale_ms: 60_000,
        isEmpty: (d) => d.rows.length === 0,
        now,
      })
    ).toBe("healthy");
  });
});

describe("LivenessPanel", () => {
  it("emits data-liveness attribute for every state", () => {
    const states = ["loading", "empty", "stale", "healthy", "error"] as const;
    for (const s of states) {
      const { container, unmount } = render(
        <LivenessPanel testId="x" state={s} lastUpdated={null}>
          <span>child</span>
        </LivenessPanel>
      );
      expect(container.querySelector(`[data-liveness="${s}"]`)).toBeTruthy();
      unmount();
    }
  });

  it("emits sr-only data-truth marker with state suffix", () => {
    const { container } = render(
      <LivenessPanel testId="metrics-x" state="healthy" lastUpdated={Date.now()} />
    );
    expect(
      container.querySelector('[data-truth="metrics-x.healthy"]')
    ).toBeTruthy();
  });

  it("renders emptyLabel when state is empty", () => {
    render(
      <LivenessPanel
        testId="p"
        state="empty"
        lastUpdated={Date.now()}
        emptyLabel="Nothing to show."
      />
    );
    expect(screen.getByText("Nothing to show.")).toBeInTheDocument();
  });

  it("renders errorLabel when state is error", () => {
    render(
      <LivenessPanel
        testId="p"
        state="error"
        lastUpdated={null}
        errorLabel="Fetch failed."
      />
    );
    expect(screen.getByText("Fetch failed.")).toBeInTheDocument();
  });

  it("renders children when healthy", () => {
    render(
      <LivenessPanel testId="p" state="healthy" lastUpdated={Date.now()}>
        <span data-testid="child">child</span>
      </LivenessPanel>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("srOnly mode renders no visible LastUpdated chrome", () => {
    const { container } = render(
      <LivenessPanel testId="p" state="healthy" lastUpdated={Date.now()} srOnly>
        <span>child</span>
      </LivenessPanel>
    );
    // sr-only truth marker still present
    expect(container.querySelector('[data-truth="p.healthy"]')).toBeTruthy();
    // no LastUpdated span rendered
    expect(container.querySelector(".font-mono")).toBeNull();
  });

  it("renders stale hint above children when state is stale", () => {
    render(
      <LivenessPanel
        testId="p"
        state="stale"
        lastUpdated={Date.now() - 120_000}
        staleHint="Data older than 60s."
      >
        <span data-testid="child">child</span>
      </LivenessPanel>
    );
    expect(screen.getByText("Data older than 60s.")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
