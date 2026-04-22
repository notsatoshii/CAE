/**
 * layout.test.tsx — TDD for app/floor/layout.tsx (Plan 11-05, Task 1)
 *
 * Tests 1-2: FloorLayout is a minimal pass-through. No TopNav injection.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import FloorLayout from "./layout";

describe("FloorLayout", () => {
  it("1. Pass-through renders children", () => {
    render(
      <FloorLayout>
        <div data-testid="child" />
      </FloorLayout>
    );
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("2. Does not inject TopNav chrome (top-nav is in root app/layout.tsx, not floor layout)", () => {
    const { container } = render(
      <FloorLayout>
        <div data-testid="child" />
      </FloorLayout>
    );
    // FloorLayout must NOT add a top-nav element — that comes from root layout
    const topNav = container.querySelector('[data-testid="top-nav"]');
    expect(topNav).toBeNull();
  });
});
