/**
 * alert-banner.test.tsx — Tests for AlertBanner component (Plan 13-07, Task 2)
 *
 * Tests:
 * 1. Renders nothing when breakers are all-quiet
 * 2. Renders banner with "paused" copy when breakers.halted is true
 * 3. Renders banner with "retried" copy when breakers.retryCount > 0
 * 4. Hides banner when localStorage fingerprint matches current trigger
 * 5. Re-shows banner when fingerprint changes (new trigger)
 * 6. Clicking Dismiss writes fingerprint to localStorage and hides banner
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { StateResponse } from "@/lib/hooks/use-state-poll";

// Mock useStatePoll
const mockStatePoll = vi.fn();
vi.mock("@/lib/hooks/use-state-poll", () => ({
  useStatePoll: () => mockStatePoll(),
}));

// Build a minimal StateResponse with just the breakers we need
function makeState(overrides: Partial<StateResponse["breakers"]> = {}): { data: Partial<StateResponse>; error: null; lastUpdated: number } {
  return {
    data: {
      breakers: {
        activeForgeCount: 0,
        inputTokensToday: 0,
        outputTokensToday: 0,
        retryCount: 0,
        recentPhantomEscalations: 0,
        halted: false,
        ...overrides,
      },
    } as StateResponse,
    error: null,
    lastUpdated: Date.now(),
  };
}

// Storage mock
let localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => localStorageStore[k] ?? null,
  setItem: (k: string, v: string) => { localStorageStore[k] = v; },
  removeItem: (k: string) => { delete localStorageStore[k]; },
  clear: () => { localStorageStore = {}; },
};

beforeEach(() => {
  localStorageStore = {};
  Object.defineProperty(window, "localStorage", { value: localStorageMock, writable: true });
  vi.clearAllMocks();
});

// Import after mocks
let AlertBanner: React.ComponentType;

describe("AlertBanner — quiet state", () => {
  it("1. Renders nothing when all breakers are quiet", async () => {
    mockStatePoll.mockReturnValue(makeState());
    const { AlertBanner } = await import("./alert-banner");
    const { container } = render(<AlertBanner />);
    expect(container.firstChild).toBeNull();
  });
});

describe("AlertBanner — triggered states", () => {
  it("2. Renders amber banner when breakers.halted = true", async () => {
    mockStatePoll.mockReturnValue(makeState({ halted: true }));
    const { AlertBanner } = await import("./alert-banner");
    render(<AlertBanner />);
    // Should show "paused" copy somewhere
    const banner = screen.getByTestId("alert-banner");
    expect(banner).toBeTruthy();
    expect(banner.textContent).toMatch(/paused/i);
  });

  it("3. Renders banner with retry copy when retryCount > 0", async () => {
    mockStatePoll.mockReturnValue(makeState({ retryCount: 2 }));
    const { AlertBanner } = await import("./alert-banner");
    render(<AlertBanner />);
    const banner = screen.getByTestId("alert-banner");
    expect(banner.textContent).toMatch(/retried|retry/i);
    // Should contain the count
    expect(banner.textContent).toMatch(/2/);
  });

  it("4. Hides banner when localStorage fingerprint matches current trigger", async () => {
    // Pre-set localStorage fingerprint for halted=true
    // Format: `${halted ? 'h' : ''}|${retryCount}|${phantomEscalations}` → "h|0|0"
    const fp = "h|0|0";
    localStorageStore["p13-alert-dismissed"] = JSON.stringify({ fingerprint: fp });

    mockStatePoll.mockReturnValue(makeState({ halted: true }));
    const { AlertBanner } = await import("./alert-banner");
    const { container } = render(<AlertBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("5. Re-shows banner when fingerprint changes (new trigger)", async () => {
    // localStorage has fingerprint for old trigger
    localStorageStore["p13-alert-dismissed"] = JSON.stringify({ fingerprint: "old|fingerprint" });

    // Current trigger is different (retryCount=3)
    mockStatePoll.mockReturnValue(makeState({ retryCount: 3 }));
    const { AlertBanner } = await import("./alert-banner");
    render(<AlertBanner />);
    // New trigger fingerprint differs → banner should render
    const banner = screen.getByTestId("alert-banner");
    expect(banner).toBeTruthy();
  });

  it("6. Clicking Dismiss writes fingerprint and hides banner", async () => {
    mockStatePoll.mockReturnValue(makeState({ halted: true }));
    const { AlertBanner } = await import("./alert-banner");
    render(<AlertBanner />);

    const dismissBtn = screen.getByRole("button", { name: /dismiss/i });
    fireEvent.click(dismissBtn);

    // localStorage should now have the fingerprint
    const stored = JSON.parse(localStorageStore["p13-alert-dismissed"] ?? "{}");
    expect(stored.fingerprint).toBeTruthy();

    // Banner should be gone from DOM
    expect(screen.queryByTestId("alert-banner")).toBeNull();
  });
});
