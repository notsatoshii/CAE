/**
 * floor-legend.test.tsx — Explain-mode a11y legend tests.
 *
 * 5 tests covering: 10 station labels (founder copy), dev mode copy flip,
 * color swatches, semantic HTML structure, and no-$ lint guard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { FloorLegend } from "./floor-legend";
import { DevModeProvider } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import path from "node:path";
import fs from "node:fs";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // matchMedia stub (jsdom lacks it; DevModeProvider uses localStorage, not matchMedia)
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FloorLegend", () => {
  // Test 1: Renders all 10 stations with founder copy (default, dev OFF)
  it("renders all 10 station labels with founder copy", () => {
    const founderL = labelFor(false);

    render(
      <DevModeProvider>
        <FloorLegend />
      </DevModeProvider>,
    );

    expect(screen.getByText(founderL.floorStationHub)).toBeTruthy();
    expect(screen.getByText(founderL.floorStationForge)).toBeTruthy();
    expect(screen.getByText(founderL.floorStationWatchtower)).toBeTruthy();
    expect(screen.getByText(founderL.floorStationOverlook)).toBeTruthy();
    expect(screen.getByText(founderL.floorStationLibrary)).toBeTruthy();
    expect(screen.getByText(founderL.floorStationShadow)).toBeTruthy();
    expect(screen.getByText(founderL.floorStationArmory)).toBeTruthy();
    expect(screen.getByText(founderL.floorStationDrafting)).toBeTruthy();
    expect(screen.getByText(founderL.floorStationPulpit)).toBeTruthy();
    expect(screen.getByText(founderL.floorStationLoadingBay)).toBeTruthy();
  });

  // Test 2: Dev mode flips copy to dev labels
  it("dev mode flips copy to dev labels (Nexus hub vs The conductor's desk)", () => {
    const devL = labelFor(true);
    const founderL = labelFor(false);

    // Pre-set localStorage to enable dev mode
    localStorage.setItem("devMode", "true");

    render(
      <DevModeProvider>
        <FloorLegend />
      </DevModeProvider>,
    );

    expect(screen.getByText(devL.floorStationHub)).toBeTruthy();
    // Founder copy should NOT be present
    expect(screen.queryByText(founderL.floorStationHub)).toBeNull();

    localStorage.removeItem("devMode");
  });

  // Test 3: Color swatches present — 10 elements with data-testid="floor-legend-swatch"
  it("renders 10 color swatch elements", () => {
    render(
      <DevModeProvider>
        <FloorLegend />
      </DevModeProvider>,
    );

    const swatches = document.querySelectorAll('[data-testid="floor-legend-swatch"]');
    expect(swatches.length).toBe(10);
  });

  // Test 4: Semantic HTML — ul > li structure with 10 items
  it("uses semantic ul > li structure with 10 list items", () => {
    const { container } = render(
      <DevModeProvider>
        <FloorLegend />
      </DevModeProvider>,
    );

    const ul = container.querySelector("ul");
    expect(ul).not.toBeNull();

    const items = container.querySelectorAll("li");
    expect(items.length).toBe(10);
  });

  // Test 5: no $ in source file (lint guard)
  it("source file contains zero $ characters", () => {
    const srcPath = path.resolve(
      __dirname,
      "floor-legend.tsx",
    );
    const src = fs.readFileSync(srcPath, "utf-8");
    expect(src.includes("$")).toBe(false);
  });
});
