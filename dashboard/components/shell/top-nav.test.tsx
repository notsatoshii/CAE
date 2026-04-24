/**
 * top-nav.test.tsx — Tests for TopNav FloorIcon mount (Plan 11-04, Task 1)
 * + Class 5B mobile overflow regression coverage (C2 fix-wave).
 *
 * Tests:
 * 7. FloorIcon is rendered in top-nav
 * 8. FloorIcon precedes MemoryIcon in DOM order
 * (plus ShortcutHelpButton tests + Class 5B mobile overflow smoke)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import React from "react";
import type { Session } from "next-auth";

// Mock all child components that need client/server context
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/components/ui/explain-tooltip", () => ({
  ExplainTooltip: ({ text }: { text: string }) => (
    <span data-testid="explain-tooltip-text">{text}</span>
  ),
}));

vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => ({ dev: false, toggle: vi.fn(), setDev: vi.fn() }),
  DevModeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/providers/explain-mode", () => ({
  useExplainMode: () => ({ explain: false, toggle: vi.fn(), setExplain: vi.fn() }),
  ExplainModeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock all other shell components to avoid pulling in complex dependencies
vi.mock("./mode-toggle", () => ({
  ModeToggle: () => <div data-testid="mode-toggle" />,
}));

vi.mock("./user-menu", () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}));

vi.mock("./cost-ticker", () => ({
  CostTicker: () => <div data-testid="cost-ticker" />,
}));

vi.mock("./heartbeat-dot", () => ({
  HeartbeatDot: () => <div data-testid="heartbeat-dot" />,
}));

vi.mock("./ambient-clock", () => ({
  AmbientClock: () => <span data-testid="ambient-clock">10:05:30</span>,
}));

vi.mock("./liveness-chip", () => ({
  LivenessChip: () => <div data-testid="liveness-chip" />,
}));

vi.mock("./dev-badge", () => ({
  DevBadge: () => <div data-testid="dev-badge" />,
}));

vi.mock("./chat-pop-out-icon", () => ({
  ChatPopOutIcon: () => <a href="/chat" data-testid="chat-pop-out-icon" />,
}));

vi.mock("./metrics-icon", () => ({
  MetricsIcon: () => <a href="/metrics" data-testid="metrics-icon" />,
}));

// Class 5B: mobile overflow menu mocked so we can assert presence of the
// trigger without pulling in base-ui's portal + Next router.
vi.mock("./top-nav-overflow-menu", () => ({
  TopNavOverflowMenu: () => (
    <button data-testid="top-nav-overflow-trigger" aria-label="More controls" />
  ),
}));

vi.mock("@/components/ui/shortcut-overlay", () => ({
  ShortcutHelpButton: () => (
    <button data-testid="shortcut-help-button" aria-label="Open keyboard shortcuts" />
  ),
  ShortcutOverlay: () => null,
  KEYBINDINGS: [],
}));

vi.mock("@/lib/hooks/use-shortcut-overlay", () => ({
  useShortcutOverlay: () => ({ open: false, setOpen: vi.fn(), toggle: vi.fn() }),
  ShortcutOverlayProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/hooks/use-command-palette", () => ({
  useCommandPalette: () => ({ open: false, setOpen: vi.fn(), toggle: vi.fn() }),
  CommandPaletteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { TopNav } from "./top-nav";

const mockSession: Session = {
  user: { name: "Test User", email: "test@example.com", image: null, role: "viewer" },
  expires: "2099-01-01",
};

describe("TopNav — FloorIcon mount", () => {
  it("7. FloorIcon is rendered in top-nav", () => {
    render(<TopNav session={mockSession} />);
    const floorIcon = screen.getByTestId("floor-icon");
    expect(floorIcon).toBeTruthy();
  });

  it("8. FloorIcon precedes MemoryIcon in DOM order", () => {
    render(<TopNav session={mockSession} />);
    const floorIcon = screen.getByTestId("floor-icon");
    const memoryIcon = screen.getByTestId("memory-icon");
    // DOCUMENT_POSITION_FOLLOWING = 4 (memory icon comes AFTER floor icon)
    const position = floorIcon.compareDocumentPosition(memoryIcon);
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("TopNav — ShortcutHelpButton mount (Plan 12-04)", () => {
  it("9. ShortcutHelpButton renders in top-nav", () => {
    render(<TopNav session={mockSession} />);
    const btn = screen.getByTestId("shortcut-help-button");
    expect(btn).toBeTruthy();
  });

  it("10. ShortcutHelpButton appears after ChatPopOutIcon in DOM order", () => {
    render(<TopNav session={mockSession} />);
    const chatIcon = screen.getByTestId("chat-pop-out-icon");
    const helpBtn = screen.getByTestId("shortcut-help-button");
    // DOCUMENT_POSITION_FOLLOWING = 4 (helpBtn comes AFTER chatIcon)
    const position = chatIcon.compareDocumentPosition(helpBtn);
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("11. ShortcutHelpButton appears before HeartbeatDot in DOM order", () => {
    render(<TopNav session={mockSession} />);
    const helpBtn = screen.getByTestId("shortcut-help-button");
    const heartbeat = screen.getByTestId("heartbeat-dot");
    // DOCUMENT_POSITION_FOLLOWING = 4 (heartbeat comes AFTER helpBtn)
    const position = helpBtn.compareDocumentPosition(heartbeat);
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("TopNav — Class 5B mobile overflow", () => {
  it("12. renders TopNavOverflowMenu trigger", () => {
    render(<TopNav session={mockSession} />);
    const trigger = screen.getByTestId("top-nav-overflow-trigger");
    expect(trigger).toBeTruthy();
  });

  it("13. inline-chrome cluster is hidden on < sm via Tailwind `hidden sm:flex`", () => {
    render(<TopNav session={mockSession} />);
    const inlineChrome = screen.getByTestId("top-nav-inline-chrome");
    // The cluster uses Tailwind's `hidden sm:flex` — jsdom does not
    // apply the sm: media query, so `hidden` takes effect. We assert
    // the `hidden` class is present + `sm:flex` is present so it
    // becomes visible at sm+.
    expect(inlineChrome.className).toContain("hidden");
    expect(inlineChrome.className).toContain("sm:flex");
  });

  it("14. safety-critical status (HeartbeatDot + LivenessChip) stays visible on mobile", () => {
    render(<TopNav session={mockSession} />);
    const heartbeat = screen.getByTestId("heartbeat-dot");
    const liveness = screen.getByTestId("liveness-chip");
    // These live OUTSIDE the hidden sm:flex cluster — i.e. they render
    // on every viewport. Assertion: their closest ancestor with the
    // `top-nav-inline-chrome` testid does not exist (they are not
    // inside the hide-on-mobile cluster).
    expect(heartbeat.closest('[data-testid="top-nav-inline-chrome"]')).toBeNull();
    expect(liveness.closest('[data-testid="top-nav-inline-chrome"]')).toBeNull();
  });

  it("15. UserMenu is always visible (not inside inline-chrome cluster)", () => {
    render(<TopNav session={mockSession} />);
    const userMenu = screen.getByTestId("user-menu");
    expect(userMenu.closest('[data-testid="top-nav-inline-chrome"]')).toBeNull();
  });

  it("16. header uses `min-w-0` + flex so text children truncate instead of overflowing", () => {
    render(<TopNav session={mockSession} />);
    const header = screen.getByTestId("top-nav");
    // The cost-ticker middle cluster must carry min-w-0 so the center
    // column can shrink; otherwise flex default min-width:auto lets it
    // push the right cluster off-screen.
    const ticker = screen.getByTestId("cost-ticker");
    const middleCluster = ticker.parentElement!;
    expect(middleCluster.className).toContain("min-w-0");
    expect(middleCluster.className).toContain("flex-1");
    // Header itself is flex — essential for the layout invariants above.
    expect(header.className).toContain("flex");
  });

  it("17. AmbientClock + DevBadge collapse on < sm (wrapped in hidden sm:inline-flex)", () => {
    render(<TopNav session={mockSession} />);
    const ambient = screen.getByTestId("ambient-clock");
    const devBadge = screen.queryByTestId("dev-badge");
    // AmbientClock wrapper must have `hidden sm:inline-flex`
    expect(ambient.parentElement!.className).toContain("hidden");
    expect(ambient.parentElement!.className).toContain("sm:inline-flex");
    // DevBadge may render (dev mode off by default → null return) or
    // wrapper renders empty. The wrapper around the slot must still be
    // hidden-on-mobile.
    if (devBadge) {
      expect(devBadge.parentElement!.className).toContain("hidden");
    }
  });

  it("18. right cluster uses `shrink-0` so it never wraps or shrinks below content", () => {
    render(<TopNav session={mockSession} />);
    const userMenu = screen.getByTestId("user-menu");
    // Walk up to the right cluster
    let node: HTMLElement | null = userMenu;
    while (node && !node.className.includes("shrink-0")) {
      node = node.parentElement;
    }
    expect(node).not.toBeNull();
    expect(node!.className).toContain("shrink-0");
  });
});

describe("TopNav — overflow menu contains all collapsed targets", () => {
  it("19. all 5 mobile overflow targets (Floor/Memory/Metrics/Chat/Shortcuts) are reachable inline on desktop via inline-chrome cluster", () => {
    render(<TopNav session={mockSession} />);
    const inline = screen.getByTestId("top-nav-inline-chrome");
    // Every collapsed-on-mobile target must exist in the inline cluster
    // so desktop users still get direct access.
    expect(within(inline).getByTestId("floor-icon")).toBeTruthy();
    expect(within(inline).getByTestId("memory-icon")).toBeTruthy();
    expect(within(inline).getByTestId("metrics-icon")).toBeTruthy();
    expect(within(inline).getByTestId("chat-pop-out-icon")).toBeTruthy();
    expect(within(inline).getByTestId("shortcut-help-button")).toBeTruthy();
  });
});
