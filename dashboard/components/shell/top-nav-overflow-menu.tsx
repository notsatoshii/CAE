"use client";

/**
 * TopNavOverflowMenu — mobile-only ellipsis dropdown for non-essential chrome.
 *
 * C2 fix-wave Class 5B: top bar overflowed on viewports < 640px, clipping
 * labels like "tok today" and "New jo" (scraped by vision scorer as awkward
 * truncation). Solution: below the sm breakpoint we hide Floor/Memory/
 * Metrics/Chat/Shortcuts behind a single "⋯" trigger that opens a
 * dropdown list. Liveness chip + heartbeat dot stay visible on mobile as
 * safety-critical status indicators.
 *
 * This component renders the ellipsis trigger only on < sm viewports
 * (sm:hidden). On sm+ the inline icons in top-nav.tsx handle navigation
 * — this wrapper does NOT replace them, it only adds a mobile escape
 * hatch.
 */

import { useRouter } from "next/navigation";
import {
  Brain,
  BarChart3,
  Gamepad2,
  HelpCircle,
  MessageSquare,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShortcutOverlay } from "@/lib/hooks/use-shortcut-overlay";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

export function TopNavOverflowMenu() {
  const router = useRouter();
  const { toggle: toggleShortcuts } = useShortcutOverlay();
  const { dev } = useDevMode();
  const t = labelFor(dev);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More controls"
        data-testid="top-nav-overflow-trigger"
        className="inline-flex size-7 items-center justify-center rounded-md text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] sm:hidden"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        data-testid="top-nav-overflow-menu"
        className="min-w-[12rem]"
      >
        <DropdownMenuItem
          data-testid="top-nav-overflow-floor"
          onClick={() => router.push("/floor")}
        >
          <Gamepad2 className="size-4" aria-hidden="true" />
          <span>{t.floorPageTitle}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="top-nav-overflow-memory"
          onClick={() => router.push("/memory")}
        >
          <Brain className="size-4" aria-hidden="true" />
          <span>Memory</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="top-nav-overflow-metrics"
          onClick={() => router.push("/metrics")}
        >
          <BarChart3 className="size-4" aria-hidden="true" />
          <span>Metrics</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="top-nav-overflow-chat"
          onClick={() => router.push("/chat")}
        >
          <MessageSquare className="size-4" aria-hidden="true" />
          <span>Chat</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="top-nav-overflow-shortcuts"
          onClick={() => toggleShortcuts()}
        >
          <HelpCircle className="size-4" aria-hidden="true" />
          <span>Keyboard shortcuts</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
