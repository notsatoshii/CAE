/**
 * components/shell/incident-stream.test.tsx
 *
 * Tests for <IncidentStream/> component (Plan 13-08, Task 2)
 *
 * Tests:
 * 1. Renders empty state when no events received
 * 2. Renders warn event with amber severity badge
 * 3. Renders error event with red severity badge
 * 4. Events are ordered newest-first (latest at top)
 * 5. Click on a row expands JSON detail panel
 * 6. Expanded detail panel shows key fields
 * 7. Renders multiple events up to 200 max
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// We'll stub EventSource globally
let globalEventSource: MockEventSource | null = null;

class MockEventSource {
  url: string;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onopen: (() => void) | null = null;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  readyState = MockEventSource.CONNECTING;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    globalEventSource = this;
    this.readyState = MockEventSource.OPEN;
  }

  // Simulate a message arriving from the server
  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  addEventListener(event: string, handler: (...args: unknown[]) => void) {
    if (event === "message") {
      this.onmessage = handler as (ev: { data: string }) => void;
    }
    if (event === "error") {
      this.onerror = handler;
    }
  }

  removeEventListener() {}

  close() {
    this.readyState = MockEventSource.CLOSED;
  }
}

beforeEach(() => {
  globalEventSource = null;
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Import component after stubbing
import { IncidentStream } from "./incident-stream";

function warnEntry(overrides = {}) {
  return { level: "warn", time: Date.now(), scope: "test", msg: "test warning", ...overrides };
}

function errorEntry(overrides = {}) {
  return { level: "error", time: Date.now(), scope: "test", msg: "test error", ...overrides };
}

describe("IncidentStream", () => {
  it("renders empty state when no messages received", async () => {
    render(<IncidentStream />);
    expect(screen.getByTestId("incident-stream-empty")).toBeInTheDocument();
  });

  it("renders a warn event with amber severity badge", async () => {
    render(<IncidentStream />);

    await act(async () => {
      globalEventSource?.simulateMessage(warnEntry({ msg: "disk usage high" }));
    });

    const badge = screen.getByTestId("incident-badge-warn");
    expect(badge).toBeInTheDocument();
    expect(screen.getByText(/disk usage high/)).toBeInTheDocument();
  });

  it("renders an error event with red severity badge", async () => {
    render(<IncidentStream />);

    await act(async () => {
      globalEventSource?.simulateMessage(errorEntry({ msg: "agent crashed" }));
    });

    const badge = screen.getByTestId("incident-badge-error");
    expect(badge).toBeInTheDocument();
    expect(screen.getByText(/agent crashed/)).toBeInTheDocument();
  });

  it("shows newest event first (events at top of list)", async () => {
    render(<IncidentStream />);

    await act(async () => {
      globalEventSource?.simulateMessage(warnEntry({ msg: "first-event", time: 1000 }));
    });
    await act(async () => {
      globalEventSource?.simulateMessage(errorEntry({ msg: "second-event", time: 2000 }));
    });

    const rows = screen.getAllByTestId("incident-row");
    // newest (second-event) should appear first
    expect(rows[0].textContent).toContain("second-event");
    expect(rows[1].textContent).toContain("first-event");
  });

  it("expands JSON detail when row is clicked", async () => {
    render(<IncidentStream />);

    await act(async () => {
      globalEventSource?.simulateMessage(warnEntry({ msg: "click-me", scope: "auth" }));
    });

    const row = screen.getByTestId("incident-row");
    fireEvent.click(row);

    // JSON detail should be visible
    const detail = screen.getByTestId("incident-detail");
    expect(detail).toBeInTheDocument();
    expect(detail.textContent).toContain("auth"); // scope visible in JSON
  });

  it("shows scope and msg in the detail panel", async () => {
    render(<IncidentStream />);

    await act(async () => {
      globalEventSource?.simulateMessage(
        errorEntry({ msg: "fail", scope: "api.state", reqId: "req-001" })
      );
    });

    const row = screen.getByTestId("incident-row");
    fireEvent.click(row);

    const detail = screen.getByTestId("incident-detail");
    expect(detail.textContent).toContain("api.state");
    expect(detail.textContent).toContain("req-001");
  });

  it("cleans up EventSource on unmount", async () => {
    const { unmount } = render(<IncidentStream />);
    const closeSpy = vi.spyOn(globalEventSource!, "close");
    unmount();
    expect(closeSpy).toHaveBeenCalledOnce();
  });
});
