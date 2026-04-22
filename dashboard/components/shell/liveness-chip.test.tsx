/**
 * Tests for components/shell/liveness-chip.tsx
 *
 * 4 tests:
 * 1. Renders "Offline" when lastUpdated=null (no state poll yet)
 * 2. Renders "Live" when lastUpdated is fresh (within threshold)
 * 3. Renders "Stale" when lastUpdated is stale (1.5x threshold)
 * 4. aria-label reflects the current state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock useStatePoll
vi.mock("@/lib/hooks/use-state-poll", () => ({
  useStatePoll: vi.fn(),
}));

// Mock useSseHealth — always return "open" with recent lastMessageAt
vi.mock("@/lib/hooks/use-sse-health", () => ({
  useSseHealth: vi.fn(),
}));

import { LivenessChip } from "./liveness-chip";
import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { useSseHealth } from "@/lib/hooks/use-sse-health";

const mockUseStatePoll = useStatePoll as ReturnType<typeof vi.fn>;
const mockUseSseHealth = useSseHealth as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-23T12:00:00.000Z"));

  // Default: healthy SSE (open, message received 1s ago)
  mockUseSseHealth.mockReturnValue({
    lastMessageAt: Date.now() - 1_000,
    status: "open",
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("LivenessChip", () => {
  it("1. renders 'Offline' when lastUpdated is null (no poll completed)", () => {
    mockUseStatePoll.mockReturnValue({ lastUpdated: null, data: null, error: null });
    // SSE also never received a message
    mockUseSseHealth.mockReturnValue({ lastMessageAt: null, status: "connecting" });

    render(<LivenessChip />);
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("2. renders 'Live' when lastUpdated is fresh (within 6s threshold)", () => {
    const now = Date.now();
    mockUseStatePoll.mockReturnValue({
      lastUpdated: now - 2_000, // 2s ago — fresh
      data: null,
      error: null,
    });
    // SSE also fresh
    mockUseSseHealth.mockReturnValue({ lastMessageAt: now - 1_000, status: "open" });

    render(<LivenessChip />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("3. renders 'Stale' when lastUpdated is between 1x and 3x threshold", () => {
    const now = Date.now();
    // 10s ago: 6000ms threshold, 10000ms > threshold but < 3x(18000ms) → stale
    mockUseStatePoll.mockReturnValue({
      lastUpdated: now - 10_000,
      data: null,
      error: null,
    });
    // SSE also fresh so the worst state comes from the poll
    mockUseSseHealth.mockReturnValue({ lastMessageAt: now - 1_000, status: "open" });

    render(<LivenessChip />);
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });

  it("4. aria-label reflects the current liveness label", () => {
    const now = Date.now();
    mockUseStatePoll.mockReturnValue({ lastUpdated: now - 1_000, data: null, error: null });
    mockUseSseHealth.mockReturnValue({ lastMessageAt: now - 1_000, status: "open" });

    render(<LivenessChip />);
    const chip = screen.getByRole("button");
    expect(chip.getAttribute("aria-label")).toContain("Live");
  });
});
