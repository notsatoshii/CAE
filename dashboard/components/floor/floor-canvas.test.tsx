/**
 * floor-canvas.test.tsx — React client component tests.
 *
 * Mocks:
 * - HTMLCanvasElement.prototype.getContext → fake ctx
 * - requestAnimationFrame / cancelAnimationFrame → manual tick
 * - EventSource → FakeEventSource class
 * - window.matchMedia → configurable
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import FloorCanvas, { __test } from "./floor-canvas";
import { DevModeProvider } from "@/lib/providers/dev-mode";
import path from "node:path";
import fs from "node:fs";

/** Wrap component in required providers for testing */
function renderCanvas(props: { cbPath: string; paused?: boolean }) {
  return render(
    <DevModeProvider>
      <FloorCanvas {...props} />
    </DevModeProvider>,
  );
}

// ---------------------------------------------------------------------------
// Fake Canvas context
// ---------------------------------------------------------------------------

function mkFakeCtx() {
  const fns = [
    "fillRect", "strokeRect", "beginPath", "closePath", "moveTo", "lineTo",
    "arc", "fill", "stroke", "fillText", "save", "restore", "translate",
    "clearRect", "setTransform",
  ];
  const ctx = {} as Record<string, unknown>;
  for (const f of fns) ctx[f] = vi.fn();
  ctx["canvas"] = { width: 960, height: 720 };
  Object.defineProperties(ctx, {
    fillStyle: { set: vi.fn(), get: () => "#000", configurable: true },
    strokeStyle: { set: vi.fn(), get: () => "#000", configurable: true },
    globalAlpha: { set: vi.fn(), get: () => 1, configurable: true },
    lineWidth: { set: vi.fn(), get: () => 1, configurable: true },
    font: { set: vi.fn(), get: () => "13px sans-serif", configurable: true },
    textAlign: { set: vi.fn(), get: () => "left", configurable: true },
  });
  return ctx as unknown as CanvasRenderingContext2D;
}

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
// Setup / teardown
// ---------------------------------------------------------------------------

let fakeCtx: CanvasRenderingContext2D;
let rafCbs: FrameRequestCallback[];

beforeEach(() => {
  fakeCtx = mkFakeCtx();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => fakeCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  rafCbs = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafCbs.push(cb);
    return rafCbs.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  (globalThis as Record<string, unknown>)["__tickRAF"] = (ts: number) => {
    const pending = rafCbs.splice(0);
    for (const cb of pending) cb(ts);
  };

  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);

  // Default ResizeObserver stub (jsdom lacks it)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );

  // Default matchMedia: reduced motion OFF
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  // performance.now() for lastTs
  vi.stubGlobal("performance", { now: () => 0 });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tick = (ts = 16) => {
  const fn = (globalThis as Record<string, unknown>)["__tickRAF"];
  if (typeof fn === "function") (fn as (ts: number) => void)(ts);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FloorCanvas", () => {
  // Test 1: mounts without throwing
  it("mounts without throwing; canvas element present", () => {
    expect(() => renderCanvas({ cbPath: "/tmp/x.jsonl" })).not.toThrow();
    const canvas = document.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });

  // Test 2: opens SSE with encoded path on mount
  it("opens EventSource with encoded cbPath on mount", () => {
    renderCanvas({ cbPath: "/tmp/x.jsonl" });
    expect(FakeEventSource.instances.length).toBe(1);
    expect(FakeEventSource.instances[0].url).toBe(
      "/api/tail?path=" + encodeURIComponent("/tmp/x.jsonl"),
    );
  });

  // Test 3: closes SSE on unmount
  it("closes EventSource on unmount", () => {
    const { unmount } = renderCanvas({ cbPath: "/tmp/x.jsonl" });
    unmount();
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  // Test 4: __test constants exported correctly
  it("exports __test constants with correct cap values", () => {
    expect(__test.QUEUE_CAP).toBe(500);
    expect(__test.EFFECTS_CAP).toBe(10);
    expect(__test.MAX_LINE_BYTES).toBe(4096);
  });

  // Test 5: oversize line dropped — no effect drawn
  it("drops SSE frames exceeding MAX_LINE_BYTES", () => {
    renderCanvas({ cbPath: "/tmp/x.jsonl" });
    const es = FakeEventSource.instances[0];

    const arcBefore = (fakeCtx.arc as ReturnType<typeof vi.fn>).mock.calls.length;

    // Emit oversize data (5001 chars > 4096)
    es.emit("x".repeat(5001));
    tick(16);

    const arcAfter = (fakeCtx.arc as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(arcAfter).toBe(arcBefore);
  });

  // Test 6: invalid JSON silently dropped
  it("silently drops invalid JSON SSE frames", () => {
    renderCanvas({ cbPath: "/tmp/x.jsonl" });
    const es = FakeEventSource.instances[0];

    expect(() => {
      es.emit("not json at all {{{{");
      tick(16);
    }).not.toThrow();
  });

  // Test 7: unknown event silently dropped
  it("silently drops unknown event names", () => {
    renderCanvas({ cbPath: "/tmp/x.jsonl" });
    const es = FakeEventSource.instances[0];

    expect(() => {
      es.emit(JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "not_allowed" }));
      tick(16);
    }).not.toThrow();
  });

  // Test 8: queue cap — no crash on 600 events
  it("handles 600 events without crashing (queue cap enforced)", () => {
    renderCanvas({ cbPath: "/tmp/x.jsonl" });
    const es = FakeEventSource.instances[0];

    expect(__test.QUEUE_CAP).toBe(500);

    for (let i = 0; i < 600; i++) {
      es.emit(
        JSON.stringify({
          ts: "2026-04-23T00:00:00Z",
          event: "forge_slot_acquired",
          task_id: `t${i}`,
        }),
      );
    }

    expect(() => tick(16)).not.toThrow();
  });

  // Test 9: effects cap constant
  it("EFFECTS_CAP constant is 10", () => {
    expect(__test.EFFECTS_CAP).toBe(10);
  });

  // Test 10: paused prop — RAF loop skips render
  it("paused=true: fillRect count does not grow after initial pause", () => {
    renderCanvas({ cbPath: "/tmp/x.jsonl", paused: true });

    const countBefore = (fakeCtx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;

    FakeEventSource.instances[0].emit(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "forge_begin", task_id: "x" }),
    );
    tick(16);
    tick(32);

    const countAfter = (fakeCtx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(countAfter).toBe(countBefore);
  });

  // Test 11: un-pausing resumes — fillRect grows
  it("paused=false after paused=true: fillRect count grows after tick", () => {
    const { rerender } = render(
      <DevModeProvider>
        <FloorCanvas cbPath="/tmp/x.jsonl" paused={true} />
      </DevModeProvider>,
    );

    const countPaused = (fakeCtx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;

    rerender(
      <DevModeProvider>
        <FloorCanvas cbPath="/tmp/x.jsonl" paused={false} />
      </DevModeProvider>,
    );
    tick(16);

    const countResumed = (fakeCtx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(countResumed).toBeGreaterThanOrEqual(countPaused + 1);
  });

  // Test 12: ResizeObserver changes viewport
  it("ResizeObserver callback does not throw", () => {
    let observerCallback: ResizeObserverCallback | null = null;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: ResizeObserverCallback) {
          observerCallback = cb;
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );

    const { container } = renderCanvas({ cbPath: "/tmp/x.jsonl" });
    const canvas = container.querySelector("canvas");

    if (observerCallback && canvas) {
      const entry = {
        contentRect: { width: 1200, height: 800 },
        target: canvas,
      } as unknown as ResizeObserverEntry;
      expect(() => observerCallback!([entry], {} as ResizeObserver)).not.toThrow();
    }

    tick(16);
    expect(
      (fakeCtx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThanOrEqual(1);
  });

  // Test 13: Reduced motion — no fireworks arc calls
  it("reduced motion: no fireworks arc calls on forge_end success=true", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    renderCanvas({ cbPath: "/tmp/x.jsonl" });
    const es = FakeEventSource.instances[0];

    const arcBefore = (fakeCtx.arc as ReturnType<typeof vi.fn>).mock.calls.length;

    es.emit(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "forge_end", success: true }),
    );
    tick(16);

    const arcAfter = (fakeCtx.arc as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(arcAfter).toBe(arcBefore);
  });

  // Test 14: no $ in source file (lint guard)
  it("source file contains zero $ characters", () => {
    const srcPath = path.resolve(
      __dirname,
      "floor-canvas.tsx",
    );
    const src = fs.readFileSync(srcPath, "utf-8");
    expect(src.includes("$")).toBe(false);
  });
});
