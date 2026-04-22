/**
 * Tests for lib/hooks/use-state-poll.tsx (after visibilitychange + lastUpdated patch).
 *
 * Strategy: real async, spied setInterval/clearInterval, spied addEventListener.
 * No fake timers — they deadlock with async fetch in this jsdom environment.
 *
 * 6 tests:
 * 1. initial lastUpdated is null before first fetch resolves
 * 2. lastUpdated is set to a number after first successful fetch
 * 3. when tab goes hidden, clearInterval is called (polling paused)
 * 4. when tab becomes visible again, poll fires immediately (extra fetch call)
 * 5. unmount removes the visibilitychange listener
 * 6. data and error fields present after fetch (regression guard)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { StatePollProvider, useStatePoll } from "./use-state-poll";

// ---------------------------------------------------------------------------
// Minimal StateResponse fixture
// ---------------------------------------------------------------------------

const FAKE_STATE = {
  breakers: {
    activeForgeCount: 0,
    inputTokensToday: 100,
    outputTokensToday: 50,
    retryCount: 0,
    recentPhantomEscalations: 0,
    halted: false,
  },
  metrics: { breakers: [], sentinel: [], compaction: [], approvals: [] },
  rollup: { shipped_today: 1, tokens_today: 150, in_flight: 0, blocked: 0, warnings: 0 },
  home_phases: [],
  events_recent: [],
  needs_you: [],
  live_ops_line: "",
};

// ---------------------------------------------------------------------------
// Setup / teardown — real async, no fake timers
// ---------------------------------------------------------------------------

// Use unknown to avoid MockInstance type incompatibilities across vitest versions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpy = { mock: { calls: any[][] } };
let clearIntervalSpy: AnySpy;
let addEventListenerSpy: AnySpy;
let removeEventListenerSpy: AnySpy;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(FAKE_STATE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );

  // Spy on clearInterval so we can assert it was called (pause on hide)
  clearIntervalSpy = vi.spyOn(window, "clearInterval") as unknown as AnySpy;

  // Spy on document event listener management
  addEventListenerSpy = vi.spyOn(document, "addEventListener") as unknown as AnySpy;
  removeEventListenerSpy = vi.spyOn(document, "removeEventListener") as unknown as AnySpy;

  // Ensure visible state between tests
  Object.defineProperty(document, "hidden", { value: false, configurable: true, writable: true });
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true, writable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }) {
  // Use a long intervalMs so the interval never fires during tests
  return (
    <StatePollProvider projectPath="/test/project" intervalMs={60_000}>
      {children}
    </StatePollProvider>
  );
}

// ---------------------------------------------------------------------------
// Helper: find the visibilitychange handler registered by the hook
// ---------------------------------------------------------------------------
function getVisibilityHandler(): EventListenerOrEventListenerObject | undefined {
  const calls = addEventListenerSpy.mock.calls;
  const match = calls.find((c) => c[0] === "visibilitychange");
  return match ? (match[1] as EventListenerOrEventListenerObject) : undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useStatePoll — lastUpdated + visibilitychange", () => {
  it("1. initial lastUpdated is null before first fetch resolves", () => {
    const { result } = renderHook(() => useStatePoll(), { wrapper });
    // Synchronously on mount, no fetch has completed yet
    expect(result.current.lastUpdated).toBeNull();
  });

  it("2. lastUpdated is set to a number after first successful fetch", async () => {
    const { result } = renderHook(() => useStatePoll(), { wrapper });
    expect(result.current.lastUpdated).toBeNull();

    await waitFor(() => {
      expect(result.current.lastUpdated).not.toBeNull();
    }, { timeout: 3000 });

    expect(typeof result.current.lastUpdated).toBe("number");
    expect(result.current.lastUpdated).toBeGreaterThan(0);
    expect(result.current.data).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("3. when tab goes hidden, clearInterval is called (interval paused)", async () => {
    const { result } = renderHook(() => useStatePoll(), { wrapper });

    // Wait for initial fetch to complete
    await waitFor(() => expect(result.current.data).not.toBeNull(), { timeout: 3000 });

    const clearCalls = clearIntervalSpy.mock.calls.length;

    // Simulate tab going hidden
    Object.defineProperty(document, "hidden", { value: true, configurable: true, writable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // clearInterval must have been called once more (to pause the interval)
    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(clearCalls);
  });

  it("4. when tab becomes visible again, an extra fetch fires immediately", async () => {
    const { result } = renderHook(() => useStatePoll(), { wrapper });

    await waitFor(() => expect(result.current.data).not.toBeNull(), { timeout: 3000 });

    // Hide
    Object.defineProperty(document, "hidden", { value: true, configurable: true, writable: true });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });

    const fetchAfterHide = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    // Show
    Object.defineProperty(document, "hidden", { value: false, configurable: true, writable: true });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });

    // Wait for the immediate poll() from the visibility-change handler
    await waitFor(
      () => expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(fetchAfterHide),
      { timeout: 3000 },
    );
  });

  it("5. unmount removes the visibilitychange listener", async () => {
    const { result, unmount } = renderHook(() => useStatePoll(), { wrapper });

    await waitFor(() => expect(result.current.data).not.toBeNull(), { timeout: 3000 });

    // Capture the handler that was registered
    const handler = getVisibilityHandler();
    expect(handler).toBeDefined();

    unmount();

    // removeEventListener must have been called with "visibilitychange" and the same handler
    const removeCalls = removeEventListenerSpy.mock.calls;
    const matched = removeCalls.some(
      (c) => c[0] === "visibilitychange" && c[1] === handler,
    );
    expect(matched).toBe(true);
  });

  it("6. data and error fields present after fetch (regression guard)", async () => {
    const { result } = renderHook(() => useStatePoll(), { wrapper });

    await waitFor(() => expect(result.current.data).not.toBeNull(), { timeout: 3000 });

    expect(result.current.data).toMatchObject({
      breakers: expect.any(Object),
      rollup: expect.any(Object),
    });
    expect(result.current.error).toBeNull();
  });
});
