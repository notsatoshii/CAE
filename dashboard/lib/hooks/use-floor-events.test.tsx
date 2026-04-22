/**
 * use-floor-events.test.tsx — Tests for the useFloorEvents hook.
 *
 * 16 tests covering:
 * 1.  cbPath=null opens NO EventSource
 * 2.  cbPath truthy opens EventSource with encoded path
 * 3.  cbPath change closes old SSE + opens new
 * 4.  Unmount closes SSE + clears auth-drift interval
 * 5.  Valid event applies to scene (not paused)
 * 6.  Paused=true queues but does not apply; unpause drains
 * 7.  Oversize line dropped (D-15)
 * 8.  Invalid JSON dropped (D-16)
 * 9.  Unknown event dropped (D-16)
 * 10. QUEUE_CAP=500 drop-oldest (D-14)
 * 11. EFFECTS_CAP=10 drop-oldest (D-14)
 * 12. Reduced-motion gate
 * 13. Reduced-motion flip mid-session
 * 14. Auth-drift probe fires at 30s
 * 15. Auth-drift probe 401 flips authDrifted
 * 16. Auth-drift probe stops when cbPath becomes null
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { createScene } from "@/lib/floor/scene";
import type { Scene } from "@/lib/floor/scene";
import { useFloorEvents, __test } from "./use-floor-events";

// ---------------------------------------------------------------------------
// FakeEventSource
// ---------------------------------------------------------------------------

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  url: string;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  emit(data: string) {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  close() {
    this.closed = true;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupRef(): MutableRefObject<Scene> {
  return { current: createScene() } as MutableRefObject<Scene>;
}

function makeValidEvent(event = "forge_begin", extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ ts: "2026-04-23T00:00:00Z", event, ...extra });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let matchMediaListeners: ((e: { matches: boolean }) => void)[] = [];
let matchMediaMatches = false;

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);

  matchMediaListeners = [];
  matchMediaMatches = false;

  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return query.includes("reduce") ? matchMediaMatches : false; },
    media: query,
    addEventListener: vi.fn((_: string, cb: (e: { matches: boolean }) => void) => {
      if (query.includes("reduce")) matchMediaListeners.push(cb);
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ breakers: {} }), { status: 200 })),
  );
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useFloorEvents", () => {
  // Test 1: cbPath=null opens NO EventSource
  it("1. cbPath=null opens no EventSource", () => {
    renderHook(() =>
      useFloorEvents({ cbPath: null, paused: false, sceneRef: setupRef() }),
    );
    expect(FakeEventSource.instances.length).toBe(0);
  });

  // Test 2: cbPath truthy opens EventSource with encoded path
  it("2. cbPath truthy opens EventSource with correctly encoded URL", () => {
    const cbPath = "/abs/.cae/metrics/circuit-breakers.jsonl";
    renderHook(() =>
      useFloorEvents({ cbPath, paused: false, sceneRef: setupRef() }),
    );
    expect(FakeEventSource.instances.length).toBe(1);
    expect(FakeEventSource.instances[0].url).toBe(
      "/api/tail?path=" + encodeURIComponent(cbPath),
    );
  });

  // Test 3: cbPath change closes old SSE + opens new
  it("3. cbPath change closes old SSE and opens new one", () => {
    const sceneRef = setupRef();
    const cbPath1 = "/project1/.cae/metrics/circuit-breakers.jsonl";
    const cbPath2 = "/project2/.cae/metrics/circuit-breakers.jsonl";

    const { rerender } = renderHook(
      ({ cbPath }: { cbPath: string }) =>
        useFloorEvents({ cbPath, paused: false, sceneRef }),
      { initialProps: { cbPath: cbPath1 } },
    );

    expect(FakeEventSource.instances.length).toBe(1);

    rerender({ cbPath: cbPath2 });

    expect(FakeEventSource.instances[0].closed).toBe(true);
    expect(FakeEventSource.instances.length).toBe(2);
    expect(FakeEventSource.instances[1].url).toBe(
      "/api/tail?path=" + encodeURIComponent(cbPath2),
    );
  });

  // Test 4: Unmount closes SSE + clears auth-drift interval
  it("4. unmount closes SSE and stops auth-drift interval", async () => {
    const cbPath = "/abs/.cae/metrics/circuit-breakers.jsonl";
    const { unmount } = renderHook(() =>
      useFloorEvents({ cbPath, paused: false, sceneRef: setupRef() }),
    );

    const fetchBefore = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    unmount();

    // Advance past the probe interval — fetch should NOT be called again after unmount
    await act(async () => {
      vi.advanceTimersByTime(__test.AUTH_POLL_MS + 1000);
    });

    expect(FakeEventSource.instances[0].closed).toBe(true);
    const fetchAfter = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(fetchAfter).toBe(fetchBefore);
  });

  // Test 5: Valid event applies to scene (not paused)
  it("5. valid forge_begin event applies status to scene when not paused", async () => {
    const sceneRef = setupRef();
    const cbPath = "/abs/.cae/metrics/circuit-breakers.jsonl";

    const { result } = renderHook(() =>
      useFloorEvents({ cbPath, paused: false, sceneRef }),
    );

    await act(async () => {
      FakeEventSource.instances[0].emit(makeValidEvent("forge_begin"));
      // Drain microtasks
      await Promise.resolve();
    });

    expect(sceneRef.current.stations.forge.status).toBe("active");
    expect(result.current.effectsCount).toBeGreaterThanOrEqual(1);
  });

  // Test 6: Paused=true queues but does not apply; unpause drains
  it("6. paused=true queues events but does not apply; unpausing drains queue", async () => {
    const sceneRef = setupRef();
    const cbPath = "/abs/.cae/metrics/circuit-breakers.jsonl";

    const { result, rerender } = renderHook(
      ({ paused }: { paused: boolean }) =>
        useFloorEvents({ cbPath, paused, sceneRef }),
      { initialProps: { paused: true } },
    );

    await act(async () => {
      FakeEventSource.instances[0].emit(makeValidEvent("forge_begin"));
      FakeEventSource.instances[0].emit(makeValidEvent("forge_begin"));
      FakeEventSource.instances[0].emit(makeValidEvent("forge_begin"));
      await Promise.resolve();
    });

    // Status should remain idle — not applied while paused
    expect(sceneRef.current.stations.forge.status).toBe("idle");
    expect(result.current.queueSize).toBe(3);

    // Now unpause
    await act(async () => {
      rerender({ paused: false });
      await Promise.resolve();
    });

    expect(result.current.queueSize).toBe(0);
    expect(result.current.effectsCount).toBeGreaterThan(0);
  });

  // Test 7: Oversize line dropped (D-15)
  it("7. oversize line (>4096 bytes) is dropped and queue stays 0", async () => {
    const sceneRef = setupRef();
    const cbPath = "/abs/.cae/metrics/circuit-breakers.jsonl";

    renderHook(() =>
      useFloorEvents({ cbPath, paused: false, sceneRef }),
    );

    await act(async () => {
      FakeEventSource.instances[0].emit("x".repeat(__test.MAX_LINE_BYTES + 1));
      await Promise.resolve();
    });

    expect(sceneRef.current.stations.forge.status).toBe("idle");
  });

  // Test 8: Invalid JSON dropped (D-16)
  it("8. invalid JSON SSE frame is silently dropped", async () => {
    const sceneRef = setupRef();
    const cbPath = "/abs/.cae/metrics/circuit-breakers.jsonl";

    const { result } = renderHook(() =>
      useFloorEvents({ cbPath, paused: false, sceneRef }),
    );

    await act(async () => {
      FakeEventSource.instances[0].emit("not json at all {{{{");
      await Promise.resolve();
    });

    expect(result.current.queueSize).toBe(0);
  });

  // Test 9: Unknown event dropped (D-16)
  it("9. event with unknown event name is silently dropped", async () => {
    const sceneRef = setupRef();
    const cbPath = "/abs/.cae/metrics/circuit-breakers.jsonl";

    const { result } = renderHook(() =>
      useFloorEvents({ cbPath, paused: false, sceneRef }),
    );

    await act(async () => {
      FakeEventSource.instances[0].emit(
        JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "totally_unknown_event" }),
      );
      await Promise.resolve();
    });

    expect(result.current.queueSize).toBe(0);
  });

  // Test 10: QUEUE_CAP=500 drop-oldest (D-14)
  it("10. QUEUE_CAP=500 — 600 events while paused caps queue at 500", async () => {
    const sceneRef = setupRef();
    const cbPath = "/abs/.cae/metrics/circuit-breakers.jsonl";

    const { result } = renderHook(() =>
      useFloorEvents({ cbPath, paused: true, sceneRef }),
    );

    await act(async () => {
      for (let i = 0; i < 600; i++) {
        FakeEventSource.instances[0].emit(makeValidEvent("forge_slot_acquired"));
      }
      await Promise.resolve();
    });

    expect(result.current.queueSize).toBeLessThanOrEqual(__test.QUEUE_CAP);
    expect(result.current.queueSize).toBe(__test.QUEUE_CAP);
  });

  // Test 11: EFFECTS_CAP=10 drop-oldest (D-14)
  it("11. EFFECTS_CAP=10 — 15 forge_end success events caps effects at 10", async () => {
    const sceneRef = setupRef();
    const cbPath = "/abs/.cae/metrics/circuit-breakers.jsonl";

    renderHook(() =>
      useFloorEvents({ cbPath, paused: false, sceneRef }),
    );

    await act(async () => {
      for (let i = 0; i < 15; i++) {
        FakeEventSource.instances[0].emit(makeValidEvent("forge_end", { success: true }));
      }
      await Promise.resolve();
    });

    expect(sceneRef.current.effects.length).toBeLessThanOrEqual(__test.EFFECTS_CAP);
  });

  // Test 12: Reduced-motion gate
  it("12. reduced-motion=true: no effects added, but status still applied", async () => {
    matchMediaMatches = true;
    const sceneRef = setupRef();
    const cbPath = "/abs/.cae/metrics/circuit-breakers.jsonl";

    const { result } = renderHook(() =>
      useFloorEvents({ cbPath, paused: false, sceneRef }),
    );

    await act(async () => {
      FakeEventSource.instances[0].emit(makeValidEvent("forge_end", { success: true }));
      await Promise.resolve();
    });

    expect(sceneRef.current.effects.length).toBe(0);
    expect(result.current.effectsCount).toBe(0);
    // Status still applied (forge_end success → forge idle)
    expect(sceneRef.current.stations.forge.status).toBe("idle");
  });

  // Test 13: Reduced-motion flip mid-session
  it("13. reduced-motion flip mid-session: post-flip emit does not add effects", async () => {
    matchMediaMatches = false;
    const sceneRef = setupRef();
    const cbPath = "/abs/.cae/metrics/circuit-breakers.jsonl";

    renderHook(() =>
      useFloorEvents({ cbPath, paused: false, sceneRef }),
    );

    // First emit: reduced-motion OFF → effects should be added
    await act(async () => {
      FakeEventSource.instances[0].emit(makeValidEvent("forge_end", { success: true }));
      await Promise.resolve();
    });

    const effectsAfterFirst = sceneRef.current.effects.length;
    expect(effectsAfterFirst).toBeGreaterThan(0);

    // Flip reduced-motion to true
    matchMediaMatches = true;
    await act(async () => {
      for (const listener of matchMediaListeners) {
        listener({ matches: true });
      }
    });

    const effectsBeforeSecond = sceneRef.current.effects.length;

    // Second emit: reduced-motion ON → no additional effects
    await act(async () => {
      FakeEventSource.instances[0].emit(makeValidEvent("forge_end", { success: true }));
      await Promise.resolve();
    });

    // No new effects added
    expect(sceneRef.current.effects.length).toBeLessThanOrEqual(effectsBeforeSecond);
  });

  // Test 14: Auth-drift probe fires at 30s
  it("14. auth-drift probe calls /api/state after 30s", async () => {
    const cbPath = "/abs/.cae/metrics/circuit-breakers.jsonl";

    const { result } = renderHook(() =>
      useFloorEvents({ cbPath, paused: false, sceneRef: setupRef() }),
    );

    const fetchBefore = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(__test.AUTH_POLL_MS + 100);
      await Promise.resolve();
    });

    const fetchAfter = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(fetchAfter).toBeGreaterThan(fetchBefore);

    // The URL should include /api/state
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    const lastUrl = calls[calls.length - 1][0] as string;
    expect(lastUrl).toMatch(/\/api\/state/);

    // Default stub returns 200 → authDrifted stays false
    expect(result.current.authDrifted).toBe(false);
  });

  // Test 15: Auth-drift probe 401 flips authDrifted
  it("15. auth-drift probe — 401 response flips authDrifted to true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 401 })),
    );

    const cbPath = "/abs/.cae/metrics/circuit-breakers.jsonl";

    const { result } = renderHook(() =>
      useFloorEvents({ cbPath, paused: false, sceneRef: setupRef() }),
    );

    await act(async () => {
      vi.advanceTimersByTime(__test.AUTH_POLL_MS + 100);
      await Promise.resolve();
    });

    expect(result.current.authDrifted).toBe(true);
  });

  // Test 16: Auth-drift probe stops when cbPath becomes null
  it("16. auth-drift probe stops when cbPath becomes null", async () => {
    const sceneRef = setupRef();
    const cbPath = "/abs/.cae/metrics/circuit-breakers.jsonl";

    const { rerender } = renderHook(
      ({ cbPath }: { cbPath: string | null }) =>
        useFloorEvents({ cbPath, paused: false, sceneRef }),
      { initialProps: { cbPath } },
    );

    // Trigger the initial probe
    await act(async () => {
      vi.advanceTimersByTime(__test.AUTH_POLL_MS + 100);
      await Promise.resolve();
    });

    const fetchCountAfterProbe = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    // Switch to null — interval should be cleared
    await act(async () => {
      rerender({ cbPath: null });
    });

    // Advance another 60s — no more probes
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    const fetchCountAfterNull = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(fetchCountAfterNull).toBe(fetchCountAfterProbe);
  });
});
