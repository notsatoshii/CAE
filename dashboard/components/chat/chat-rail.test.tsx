/**
 * ChatRail component tests — Phase 9 Plan 05 Task 2 (CHT-01).
 *
 * These tests mock the ChatRail provider hook + useDevMode + usePathname so
 * the shell's rendering behavior can be verified in isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatRail } from "./chat-rail";

// Mock next/navigation's usePathname per-test
const mockPathname = vi.fn(() => "/build");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock the provider hook
const mockRail: Record<string, unknown> = {
  sessionAuthed: true,
  open: false,
  unread: 0,
  expand: vi.fn(),
  collapse: vi.fn(),
  toggle: vi.fn(),
  currentSessionId: null,
  streaming: false,
  lastMessagePreview: "",
  lastSeenMsgId: null,
  setCurrentSession: vi.fn(),
  setLastSeenMsgId: vi.fn(),
  setLastMessagePreview: vi.fn(),
  markAllRead: vi.fn(),
  bumpUnread: vi.fn(),
  setStreaming: vi.fn(),
};
vi.mock("@/lib/providers/chat-rail", () => ({
  useChatRail: () => mockRail,
}));

// Providers that ChatRail transitively needs
vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => ({ dev: false, toggle: vi.fn(), setDev: vi.fn() }),
}));

// ChatPanel internals mount fetch + effects; stub it out completely in rail
// tests so the collapsed/expanded shell is the only thing under test.
vi.mock("./chat-panel", () => ({
  ChatPanel: () => <div data-testid="chat-panel-stub" />,
}));

describe("ChatRail", () => {
  beforeEach(() => {
    mockRail.open = false;
    mockRail.unread = 0;
    mockRail.sessionAuthed = true;
    mockPathname.mockReturnValue("/build");
    // Reset all vi.fn() spies
    (mockRail.expand as ReturnType<typeof vi.fn>).mockClear();
    (mockRail.collapse as ReturnType<typeof vi.fn>).mockClear();
    (mockRail.toggle as ReturnType<typeof vi.fn>).mockClear();
  });

  it("renders 48px (w-12) collapsed by default", () => {
    render(<ChatRail />);
    const rail = screen.getByTestId("chat-rail");
    expect(rail.className).toMatch(/w-12/);
  });

  it("renders 300px (w-[300px]) when open", () => {
    mockRail.open = true;
    render(<ChatRail />);
    expect(screen.getByTestId("chat-rail").className).toMatch(/w-\[300px\]/);
  });

  it("returns null on /chat (D-16)", () => {
    mockPathname.mockReturnValue("/chat");
    const { container } = render(<ChatRail />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when !sessionAuthed (gotcha #10)", () => {
    mockRail.sessionAuthed = false;
    const { container } = render(<ChatRail />);
    expect(container.firstChild).toBeNull();
  });

  it("shows unread badge when unread > 0", () => {
    mockRail.unread = 3;
    render(<ChatRail />);
    expect(screen.getByTestId("chat-rail-unread").textContent).toBe("3");
  });

  it("caps unread badge display at 9+", () => {
    mockRail.unread = 27;
    render(<ChatRail />);
    expect(screen.getByTestId("chat-rail-unread").textContent).toBe("9+");
  });

  it("clicking collapsed rail calls expand()", () => {
    render(<ChatRail />);
    fireEvent.click(screen.getByTestId("chat-rail"));
    expect(mockRail.expand).toHaveBeenCalledTimes(1);
  });

  it("clicking collapse button on expanded rail calls collapse()", () => {
    mockRail.open = true;
    render(<ChatRail />);
    const collapseBtn = screen.getByLabelText(/collapse chat|collapse/i);
    fireEvent.click(collapseBtn);
    expect(mockRail.collapse).toHaveBeenCalledTimes(1);
  });

  it("expanded rail mounts ChatPanel", () => {
    mockRail.open = true;
    render(<ChatRail />);
    expect(screen.getByTestId("chat-panel-stub")).toBeInTheDocument();
  });

  it("does NOT use base-ui asChild anywhere (gotcha #5)", () => {
    // Static guard — importing the module should never blow up on asChild usage.
    // This is a smoke test; the grep in <verify> is the authoritative guard.
    mockRail.open = true;
    render(<ChatRail />);
    expect(screen.getByTestId("chat-rail")).toBeInTheDocument();
  });
});
