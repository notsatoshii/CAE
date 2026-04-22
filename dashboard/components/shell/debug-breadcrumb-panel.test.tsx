/**
 * components/shell/debug-breadcrumb-panel.test.tsx
 *
 * Tests for <DebugBreadcrumbPanel/> (Plan 13-08, Task 3)
 *
 * Tests:
 * 1. Returns null when dev-mode is off
 * 2. Renders toggle button when dev-mode is on
 * 3. Collapsed by default — log entries NOT visible
 * 4. Click button → expands panel and shows entries
 * 5. Entries from 'cae:log' CustomEvent appear in the panel
 * 6. Click an entry → shows JSON detail
 * 7. Shows "no events yet" in empty state when expanded
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// Mock DevModeProvider / useDevMode
let mockDevValue = false;
vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => ({ dev: mockDevValue, toggle: vi.fn(), setDev: vi.fn() }),
}));

// Mock client-log-bus getBuffer
vi.mock("@/lib/client-log-bus", () => ({
  getBuffer: vi.fn(() => []),
  clientLog: vi.fn(),
  clearBuffer: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

import { DebugBreadcrumbPanel } from "./debug-breadcrumb-panel";
import { getBuffer } from "@/lib/client-log-bus";

const mockGetBuffer = vi.mocked(getBuffer);

beforeEach(() => {
  mockDevValue = false;
  mockGetBuffer.mockReturnValue([]);
});

describe("DebugBreadcrumbPanel — dev-mode off", () => {
  it("returns null (renders nothing) when dev-mode is off", () => {
    mockDevValue = false;
    const { container } = render(<DebugBreadcrumbPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe("DebugBreadcrumbPanel — dev-mode on", () => {
  beforeEach(() => {
    mockDevValue = true;
  });

  it("renders the toggle button", () => {
    render(<DebugBreadcrumbPanel />);
    expect(screen.getByTestId("debug-breadcrumb-toggle")).toBeInTheDocument();
  });

  it("panel is collapsed by default — entries not visible", () => {
    mockGetBuffer.mockReturnValue([
      { time: Date.now(), level: "info", scope: "test", msg: "hidden-entry" },
    ]);
    render(<DebugBreadcrumbPanel />);
    expect(screen.queryByText("hidden-entry")).not.toBeInTheDocument();
  });

  it("expands panel on toggle button click — shows entries", async () => {
    mockGetBuffer.mockReturnValue([
      { time: Date.now(), level: "warn", scope: "agent", msg: "visible-entry" },
    ]);
    render(<DebugBreadcrumbPanel />);

    fireEvent.click(screen.getByTestId("debug-breadcrumb-toggle"));

    expect(screen.getByTestId("debug-breadcrumb-panel")).toBeInTheDocument();
    expect(screen.getByText(/visible-entry/)).toBeInTheDocument();
  });

  it("shows 'no events yet' when buffer is empty and panel is expanded", () => {
    mockGetBuffer.mockReturnValue([]);
    render(<DebugBreadcrumbPanel />);
    fireEvent.click(screen.getByTestId("debug-breadcrumb-toggle"));
    expect(screen.getByText(/no events yet/i)).toBeInTheDocument();
  });

  it("clicking an entry shows its JSON detail", async () => {
    mockGetBuffer.mockReturnValue([
      { time: 1700000000000, level: "error", scope: "auth", msg: "session-expired", ctx: { code: 401 } },
    ]);
    render(<DebugBreadcrumbPanel />);
    fireEvent.click(screen.getByTestId("debug-breadcrumb-toggle"));

    const entry = screen.getByTestId("breadcrumb-entry-0");
    fireEvent.click(entry);

    const detail = screen.getByTestId("breadcrumb-detail");
    expect(detail.textContent).toContain("session-expired");
    expect(detail.textContent).toContain("401");
  });

  it("adds new entries from cae:log CustomEvent", async () => {
    mockGetBuffer.mockReturnValue([]);
    render(<DebugBreadcrumbPanel />);
    fireEvent.click(screen.getByTestId("debug-breadcrumb-toggle"));

    // Simulate a cae:log event
    const entry = { time: Date.now(), level: "warn" as const, scope: "chat", msg: "sse-reconnect" };
    await act(async () => {
      window.dispatchEvent(new CustomEvent("cae:log", { detail: entry }));
    });

    expect(screen.getByText(/sse-reconnect/)).toBeInTheDocument();
  });
});
