/**
 * floor-icon.test.tsx — TDD RED for FloorIcon (Plan 11-04, Task 1)
 *
 * Tests:
 * 1. Renders a Link with href=/floor
 * 2. data-testid="floor-icon"
 * 3. Lucide Gamepad2 icon present
 * 4. aria-label + title use labelFor (founder vs dev)
 * 5. Wrapped in ExplainTooltip with floorExplainHub text
 * 6. No $ in source
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock next/link to render a plain <a>
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock ExplainTooltip to render its text so we can assert on it
vi.mock("@/components/ui/explain-tooltip", () => ({
  ExplainTooltip: ({ text }: { text: string }) => (
    <span data-testid="explain-tooltip-text">{text}</span>
  ),
}));

// Mock useDevMode — default dev=false
const mockUseDevMode = vi.fn(() => ({ dev: false, toggle: vi.fn(), setDev: vi.fn() }));
vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => mockUseDevMode(),
}));

// Import labelFor for expected values
import { labelFor } from "@/lib/copy/labels";

// Import the component AFTER mocks
import { FloorIcon } from "./floor-icon";

describe("FloorIcon", () => {
  beforeEach(() => {
    mockUseDevMode.mockReturnValue({ dev: false, toggle: vi.fn(), setDev: vi.fn() });
  });

  it("1. renders a link with href=/floor", () => {
    render(<FloorIcon />);
    const link = screen.getByRole("link");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/floor");
  });

  it("2. has data-testid=floor-icon", () => {
    render(<FloorIcon />);
    const el = screen.getByTestId("floor-icon");
    expect(el).toBeTruthy();
  });

  it("3. renders a lucide Gamepad2 svg icon", () => {
    render(<FloorIcon />);
    // lucide icons render as <svg> with a class containing 'lucide'
    const svgs = document.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    const hasGamepad = Array.from(svgs).some((svg) => {
      const cls = svg.getAttribute("class") ?? "";
      return cls.includes("lucide-gamepad");
    });
    expect(hasGamepad).toBe(true);
  });

  it("4a. aria-label uses founder string when dev=false", () => {
    mockUseDevMode.mockReturnValue({ dev: false, toggle: vi.fn(), setDev: vi.fn() });
    render(<FloorIcon />);
    const link = screen.getByTestId("floor-icon");
    expect(link.getAttribute("aria-label")).toBe(labelFor(false).floorPageTitle);
  });

  it("4b. aria-label uses dev string when dev=true", () => {
    mockUseDevMode.mockReturnValue({ dev: true, toggle: vi.fn(), setDev: vi.fn() });
    render(<FloorIcon />);
    const link = screen.getByTestId("floor-icon");
    expect(link.getAttribute("aria-label")).toBe(labelFor(true).floorPageTitle);
  });

  it("5. wraps in ExplainTooltip with floorExplainHub text", () => {
    mockUseDevMode.mockReturnValue({ dev: false, toggle: vi.fn(), setDev: vi.fn() });
    render(<FloorIcon />);
    const tooltip = screen.getByTestId("explain-tooltip-text");
    expect(tooltip.textContent).toBe(labelFor(false).floorExplainHub);
  });

  it("6. no dollar signs in source file", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(
      resolve("/home/cae/ctrl-alt-elite/dashboard/components/shell/floor-icon.tsx"),
      "utf8"
    );
    expect(src).not.toContain("$");
  });
});
