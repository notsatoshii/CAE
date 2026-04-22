import type { PaletteItem } from "./types";
import type { PaletteSourceContext } from "./index-sources";

/**
 * The static "Commands" group. Items shipped in this release.
 */
export function buildStaticCommands(
  ctx: PaletteSourceContext,
  toggles: {
    toggleExplain: () => void;
    toggleDev: () => void;
    openShortcuts: () => void;
  },
): PaletteItem[] {
  // Navigation items
  const navItems: Array<{ id: string; label: string; href: string }> = [
    { id: "cmd:goto-home", label: "Go to Home", href: "/" },
    { id: "cmd:goto-build", label: "Go to Build", href: "/build" },
    { id: "cmd:goto-plan", label: "Go to Plan", href: "/plan" },
    { id: "cmd:goto-agents", label: "Go to Agents", href: "/build/agents" },
    { id: "cmd:goto-workflows", label: "Go to Workflows", href: "/build/workflows" },
    { id: "cmd:goto-queue", label: "Go to Queue", href: "/build/queue" },
    { id: "cmd:goto-changes", label: "Go to Changes", href: "/build/changes" },
    { id: "cmd:goto-metrics", label: "Go to Metrics", href: "/metrics" },
    { id: "cmd:goto-memory", label: "Go to Memory", href: "/memory" },
    { id: "cmd:goto-chat", label: "Open Chat", href: "/chat" },
  ];

  const nav: PaletteItem[] = navItems.map(({ id, label, href }) => ({
    id,
    group: "commands" as const,
    label,
    hint: href,
    run: () => {
      ctx.router.push(href);
      ctx.close();
    },
  }));

  const actions: PaletteItem[] = [
    {
      id: "cmd:toggle-explain",
      group: "commands",
      label: "Toggle Explain Mode",
      hint: "Show or hide founder explanations",
      run: () => {
        toggles.toggleExplain();
        ctx.close();
      },
    },
    {
      id: "cmd:toggle-dev",
      group: "commands",
      label: "Toggle Dev Mode",
      hint: "Switch to developer labels",
      run: () => {
        toggles.toggleDev();
        ctx.close();
      },
    },
    {
      id: "cmd:open-shortcuts",
      group: "commands",
      label: "Open Keyboard Shortcuts",
      hint: "See all keyboard shortcuts",
      run: () => {
        toggles.openShortcuts();
        ctx.close();
      },
    },
    {
      id: "cmd:regenerate-memory",
      group: "commands",
      label: "Regenerate Memory Graph",
      hint: "Rebuild the memory graph from sources",
      run: () => {
        ctx.router.push("/memory?action=regenerate");
        ctx.close();
      },
    },
  ];

  return [...nav, ...actions];
}

/**
 * Exported as staticCommandItems for use in index-sources.ts and build-index.ts.
 * Uses a no-op context — toggles are not available in static mode.
 * Callers that need real toggles should use buildStaticCommands directly.
 */
export function staticCommandItems(ctx: PaletteSourceContext): PaletteItem[] {
  return buildStaticCommands(ctx, {
    toggleExplain: ctx.close,
    toggleDev: ctx.close,
    openShortcuts: ctx.close,
  });
}
