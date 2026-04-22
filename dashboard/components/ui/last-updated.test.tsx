/**
 * Tests for components/ui/last-updated.tsx
 *
 * RED phase: tests written before the component exists.
 *
 * 6 tests covering:
 * 1. at=null renders dash "—"
 * 2. at=recent renders "just now" with green dot
 * 3. at=10s ago renders "10s ago" with amber dot (stale, delta <= 3x threshold)
 * 4. at=60s ago renders "1m ago" with red dot (dead, delta > 3x threshold)
 * 5. title attribute shows absolute date string
 * 6. className prop is forwarded to the root span
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { LastUpdated } from "./last-updated";

const THRESHOLD_MS = 6_000;

// We need stable Date.now() across renders to avoid timing flakiness.
// Fake timers + vi.setSystemTime give us control.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-23T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("LastUpdated", () => {
  it("1. at=null renders em-dash", () => {
    render(<LastUpdated at={null} threshold_ms={THRESHOLD_MS} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("2. at=recent (<5s ago) renders 'just now' with green dot", () => {
    const now = Date.now();
    render(<LastUpdated at={now - 2_000} threshold_ms={THRESHOLD_MS} />);
    expect(screen.getByText("just now")).toBeInTheDocument();
    // Green dot = fresh state (--success CSS var)
    const dot = screen.getByText("just now").parentElement!.querySelector("span[aria-hidden]");
    expect(dot).toBeTruthy();
    // backgroundColor style should reference --success
    const style = (dot as HTMLElement).getAttribute("style") ?? "";
    expect(style).toContain("var(--success)");
  });

  it("3. at=10s ago renders '10s ago' with amber dot (stale)", () => {
    const now = Date.now();
    // delta=10000ms > threshold(6000ms) but <= 3×threshold(18000ms) → stale
    render(<LastUpdated at={now - 10_000} threshold_ms={THRESHOLD_MS} />);
    expect(screen.getByText("10s ago")).toBeInTheDocument();
    const dot = screen.getByText("10s ago").parentElement!.querySelector("span[aria-hidden]");
    const style = (dot as HTMLElement).getAttribute("style") ?? "";
    expect(style).toContain("var(--warning)");
  });

  it("4. at=60s ago renders '1m ago' with red dot (dead)", () => {
    const now = Date.now();
    // delta=60000ms > 3×threshold(18000ms) → dead
    render(<LastUpdated at={now - 60_000} threshold_ms={THRESHOLD_MS} />);
    expect(screen.getByText("1m ago")).toBeInTheDocument();
    const dot = screen.getByText("1m ago").parentElement!.querySelector("span[aria-hidden]");
    const style = (dot as HTMLElement).getAttribute("style") ?? "";
    expect(style).toContain("var(--danger)");
  });

  it("5. title attribute shows absolute date string", () => {
    const at = Date.now() - 2_000;
    const { container } = render(<LastUpdated at={at} threshold_ms={THRESHOLD_MS} />);
    const root = container.querySelector("[title]");
    expect(root).toBeTruthy();
    // title should be parseable date
    const title = root!.getAttribute("title") ?? "";
    expect(title.length).toBeGreaterThan(0);
    expect(new Date(title).toString()).not.toBe("Invalid Date");
  });

  it("6. className prop is forwarded to root span", () => {
    const { container } = render(
      <LastUpdated at={null} threshold_ms={THRESHOLD_MS} className="my-custom-class" />
    );
    const root = container.querySelector(".my-custom-class");
    expect(root).toBeTruthy();
  });

  it("7. ticks every second — text updates from 'just now' to elapsed", () => {
    const at = Date.now() - 2_000; // 2 seconds ago initially
    render(<LastUpdated at={at} threshold_ms={THRESHOLD_MS} />);
    // Initially "just now"
    expect(screen.getByText("just now")).toBeInTheDocument();

    // Advance time by 4 seconds (total delta = 6000ms → still < 5000? no, 6000 > 5000)
    // After advance: delta = 6000ms → ≥5000 → shows "6s ago"
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    // Now delta = 6s → should show "6s ago"
    expect(screen.getByText("6s ago")).toBeInTheDocument();
  });
});
