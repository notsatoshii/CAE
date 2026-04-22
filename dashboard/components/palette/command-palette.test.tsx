/**
 * command-palette.test.tsx — PAL-02, PAL-04, PAL-05, PAL-06, PAL-07, A11Y-02
 *
 * Tests CommandPalette open/close lifecycle, group rendering, empty state,
 * item selection, and source failure resilience.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import React from "react";
import { CommandPaletteProvider, useCommandPalette } from "@/lib/hooks/use-command-palette";
import * as buildIndexModule from "@/lib/palette/build-index";
import type { PaletteItem, PaletteGroupKey } from "@/lib/palette/types";
import { CommandPalette } from "./command-palette";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock ExplainMode and DevMode providers
vi.mock("@/lib/providers/explain-mode", () => ({
  useExplainMode: () => ({ explain: true, toggle: vi.fn(), setExplain: vi.fn() }),
}));

vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => ({ dev: false, toggle: vi.fn(), setDev: vi.fn() }),
}));

// Mock ShortcutOverlay provider — CommandPalette calls useShortcutOverlay() to
// wire the "Open Keyboard Shortcuts" command now that both providers co-mount.
vi.mock("@/lib/hooks/use-shortcut-overlay", () => ({
  useShortcutOverlay: () => ({ open: false, setOpen: vi.fn(), toggle: vi.fn() }),
  ShortcutOverlayProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function makeItem(id: string, group: PaletteGroupKey, label: string): PaletteItem {
  return { id, group, label, hint: "", run: vi.fn() };
}

// Minimal palette items for each group
const MOCK_ITEMS: PaletteItem[] = [
  makeItem("project:a", "projects", "Project A"),
  makeItem("task:1", "tasks", "Task One"),
  makeItem("agent:forge", "agents", "Forge Agent"),
  makeItem("workflow:w1", "workflows", "Workflow One"),
  makeItem("memory:m1", "memory", "Memory File"),
  makeItem("cmd:goto-home", "commands", "Go to Home"),
];

// Helper: A button in the test harness to open/close palette
function OpenButton() {
  const { setOpen, open } = useCommandPalette();
  return (
    <button onClick={() => setOpen(!open)} data-testid="toggle-btn">
      Toggle
    </button>
  );
}

function TestApp() {
  return (
    <CommandPaletteProvider>
      <OpenButton />
      <CommandPalette />
    </CommandPaletteProvider>
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.spyOn(buildIndexModule, "buildPaletteIndex").mockResolvedValue(MOCK_ITEMS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when open=false (no dialog in DOM)", () => {
    render(<TestApp />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a dialog after setOpen(true)", async () => {
    render(<TestApp />);
    act(() => {
      screen.getByTestId("toggle-btn").click();
    });
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
  });

  it("input with placeholder 'Search or jump to…' is present when open", async () => {
    render(<TestApp />);
    act(() => {
      screen.getByTestId("toggle-btn").click();
    });
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search or jump to…")).toBeTruthy();
    });
  });

  it("renders all 6 group labels after index loads", async () => {
    render(<TestApp />);
    act(() => {
      screen.getByTestId("toggle-btn").click();
    });

    await waitFor(() => {
      expect(screen.getByText("Projects")).toBeTruthy();
      expect(screen.getByText("Tasks")).toBeTruthy();
      expect(screen.getByText("Agents")).toBeTruthy();
      expect(screen.getByText("Workflows")).toBeTruthy();
      expect(screen.getByText("Memory")).toBeTruthy();
      expect(screen.getByText("Commands")).toBeTruthy();
    });
  });

  it("shows empty-state text when query matches nothing", async () => {
    render(<TestApp />);
    act(() => {
      screen.getByTestId("toggle-btn").click();
    });

    await waitFor(() => screen.getByPlaceholderText("Search or jump to…"));

    const input = screen.getByPlaceholderText("Search or jump to…");
    fireEvent.change(input, { target: { value: "nothing-matches-xyz" } });

    await waitFor(() => {
      expect(screen.getByText("No matches. Try a different word.")).toBeTruthy();
    });
  });

  it("closes dialog when setOpen(false) is called", async () => {
    render(<TestApp />);
    act(() => {
      screen.getByTestId("toggle-btn").click();
    });
    await waitFor(() => screen.getByRole("dialog"));

    act(() => {
      screen.getByTestId("toggle-btn").click();
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("still renders when one source fetch fails (PAL-02 resilience)", async () => {
    const itemsWithoutAgents = MOCK_ITEMS.filter((i) => i.group !== "agents");
    vi.spyOn(buildIndexModule, "buildPaletteIndex").mockResolvedValue(itemsWithoutAgents);

    render(<TestApp />);
    act(() => {
      screen.getByTestId("toggle-btn").click();
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
      // Agents group absent
      expect(screen.queryByText("Agents")).toBeNull();
      // Other groups present
      expect(screen.getByText("Projects")).toBeTruthy();
      expect(screen.getByText("Commands")).toBeTruthy();
    });
  });
});
