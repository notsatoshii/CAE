/**
 * top-nav.test.tsx — Tests for TopNav FloorIcon mount (Plan 11-04, Task 1)
 *
 * Tests:
 * 7. FloorIcon is rendered in top-nav
 * 8. FloorIcon precedes MemoryIcon in DOM order
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

vi.mock("./dev-badge", () => ({
  DevBadge: () => <div data-testid="dev-badge" />,
}));

vi.mock("./chat-pop-out-icon", () => ({
  ChatPopOutIcon: () => <a href="/chat" data-testid="chat-pop-out-icon" />,
}));

vi.mock("./metrics-icon", () => ({
  MetricsIcon: () => <a href="/metrics" data-testid="metrics-icon" />,
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
  user: { name: "Test User", email: "test@example.com", image: null },
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
