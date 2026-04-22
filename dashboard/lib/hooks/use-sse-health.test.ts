/**
 * Tests for lib/hooks/use-sse-health.ts
 *
 * RED phase: tests written before the hook exists.
 *
 * 6 tests covering:
 * 1. Initial state is {lastMessageAt: null, status: "connecting"}
 * 2. onopen transitions status → "open"
 * 3. onmessage sets lastMessageAt to a recent timestamp
 * 4. onerror transitions status → "closed"
 * 5. Cleanup closes the EventSource on unmount
 * 6. Path change closes old EventSource and opens new one
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSseHealth } from "./use-sse-health";

// ---------------------------------------------------------------------------
// FakeEventSource
// ---------------------------------------------------------------------------

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  url: string;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  fireOpen() {
    this.onopen?.(new Event("open"));
  }

  fireMessage(data = "ping") {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  fireError() {
    this.onerror?.(new Event("error"));
  }

  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-23T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSseHealth", () => {
  it("1. initial state is {lastMessageAt: null, status: 'connecting'}", () => {
    const { result } = renderHook(() => useSseHealth("/api/tail"));
    expect(result.current.lastMessageAt).toBeNull();
    expect(result.current.status).toBe("connecting");
  });

  it("2. onopen transitions status to 'open'", () => {
    const { result } = renderHook(() => useSseHealth("/api/tail"));

    act(() => {
      FakeEventSource.instances[0].fireOpen();
    });

    expect(result.current.status).toBe("open");
    // lastMessageAt should still be null (no message received yet)
    expect(result.current.lastMessageAt).toBeNull();
  });

  it("3. onmessage sets lastMessageAt to current timestamp", () => {
    const before = Date.now();
    const { result } = renderHook(() => useSseHealth("/api/tail"));

    act(() => {
      FakeEventSource.instances[0].fireOpen();
      FakeEventSource.instances[0].fireMessage("some data");
    });

    expect(result.current.lastMessageAt).not.toBeNull();
    expect(result.current.lastMessageAt).toBeGreaterThanOrEqual(before);
    expect(result.current.lastMessageAt).toBeLessThanOrEqual(Date.now());
  });

  it("4. onerror transitions status to 'closed'", () => {
    const { result } = renderHook(() => useSseHealth("/api/tail"));

    act(() => {
      FakeEventSource.instances[0].fireOpen();
    });
    expect(result.current.status).toBe("open");

    act(() => {
      FakeEventSource.instances[0].fireError();
    });
    expect(result.current.status).toBe("closed");
  });

  it("5. unmount closes the EventSource", () => {
    const { unmount } = renderHook(() => useSseHealth("/api/tail"));
    expect(FakeEventSource.instances.length).toBe(1);
    expect(FakeEventSource.instances[0].closed).toBe(false);

    unmount();
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it("6. path change closes old EventSource and opens a new one", () => {
    const { rerender } = renderHook(
      ({ path }: { path: string }) => useSseHealth(path),
      { initialProps: { path: "/api/tail" } },
    );

    expect(FakeEventSource.instances.length).toBe(1);
    expect(FakeEventSource.instances[0].url).toBe("/api/tail");

    act(() => {
      rerender({ path: "/api/chat/send" });
    });

    expect(FakeEventSource.instances[0].closed).toBe(true);
    expect(FakeEventSource.instances.length).toBe(2);
    expect(FakeEventSource.instances[1].url).toBe("/api/chat/send");
  });
});
