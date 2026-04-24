/**
 * top-nav-overflow-menu.test.tsx — Class 5B (C2 fix-wave) coverage.
 *
 * Smoke that the overflow menu trigger is present + labelled correctly,
 * and that opening it lists all 5 collapsed mobile targets. Full base-ui
 * popup behavior is tested upstream in the dropdown-menu primitive tests.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/hooks/use-shortcut-overlay", () => ({
  useShortcutOverlay: () => ({ open: false, setOpen: vi.fn(), toggle: vi.fn() }),
  ShortcutOverlayProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => ({ dev: false, toggle: vi.fn(), setDev: vi.fn() }),
  DevModeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { TopNavOverflowMenu } from "./top-nav-overflow-menu";

describe("TopNavOverflowMenu — Class 5B mobile overflow menu", () => {
  it("renders the ellipsis trigger with accessible label", () => {
    render(<TopNavOverflowMenu />);
    const trigger = screen.getByTestId("top-nav-overflow-trigger");
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-label")).toBe("More controls");
  });

  it("trigger is Tailwind-hidden on sm+ (visible only < 640px)", () => {
    render(<TopNavOverflowMenu />);
    const trigger = screen.getByTestId("top-nav-overflow-trigger");
    expect(trigger.className).toContain("sm:hidden");
  });

  it("opening the menu reveals all 5 collapsed targets", async () => {
    const user = userEvent.setup();
    render(<TopNavOverflowMenu />);
    const trigger = screen.getByTestId("top-nav-overflow-trigger");
    await user.click(trigger);

    // base-ui renders into a portal attached to document.body. Items
    // mount async after the open animation; use findBy* (polling +
    // built-in waitFor) rather than getBy* which throws synchronously.
    expect(await screen.findByTestId("top-nav-overflow-floor")).toBeTruthy();
    expect(await screen.findByTestId("top-nav-overflow-memory")).toBeTruthy();
    expect(await screen.findByTestId("top-nav-overflow-metrics")).toBeTruthy();
    expect(await screen.findByTestId("top-nav-overflow-chat")).toBeTruthy();
    expect(await screen.findByTestId("top-nav-overflow-shortcuts")).toBeTruthy();
  });
});
