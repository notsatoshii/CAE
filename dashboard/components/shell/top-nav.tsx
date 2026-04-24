import type { Session } from "next-auth";
import { ModeToggle } from "./mode-toggle";
import { UserMenu } from "./user-menu";
import { CostTicker } from "./cost-ticker";
import { FloorIcon } from "./floor-icon";
import { MemoryIcon } from "./memory-icon";
import { MetricsIcon } from "./metrics-icon";
import { ChatPopOutIcon } from "./chat-pop-out-icon";
import { HeartbeatDot } from "./heartbeat-dot";
import { AmbientClock } from "./ambient-clock";
import { LivenessChip } from "./liveness-chip";
import { DevBadge } from "./dev-badge";
import { ShortcutHelpButton } from "@/components/ui/shortcut-overlay";
import { TopNavOverflowMenu } from "./top-nav-overflow-menu";

interface TopNavProps {
  session: Session;
}

// NOTE: StatePollProvider is mounted in app/layout.tsx (Plan 04-06) so it wraps
// BOTH the top-nav chrome AND the page children (build-home widgets require
// useStatePoll access). Previously it wrapped only this header, which broke
// any client widget under /build that called useStatePoll.
//
// Class 5B (C2 fix-wave): mobile overflow.
//   Below 640px the full icon rail + chat/memory/metrics/floor/shortcuts +
//   ambient clock + dev badge no longer fit. Vision scorer flagged "tok
//   today", "New jo", "icons clipped on right edge". We now hide the
//   non-essential chrome behind a ⋯ overflow menu (see TopNavOverflowMenu)
//   on < sm. Safety-critical indicators (HeartbeatDot, LivenessChip) stay
//   visible on all viewports. The CostTicker itself collapses its label
//   suffixes on < sm (see cost-ticker.tsx). min-w-0 on flex text children
//   prevents truncate() from being short-circuited by flex's default
//   min-width:auto behavior.
export function TopNav({ session }: TopNavProps) {
  return (
    <header
      data-testid="top-nav"
      // Class 13B — top-bar elevation-1 so the bottom edge has a visible
      // drop-shadow against page content (depth cue Eric flagged was flat).
      // Class 5H — always glass: `.glass-surface-strong` gives the top bar
      // the translucent fill + border-image gradient + backdrop-blur. The
      // utility replaces the legacy `bg-[color:var(--bg)]/95 backdrop-blur`
      // + solid `border-b` combo (alpha + blur + gradient border in one
      // token; perf guard disables blur <768px automatically).
      className="sticky top-0 z-50 flex h-10 items-center gap-2 glass-surface-strong px-3 shadow-elevation-1"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {/* Left cluster: wordmark + mode toggle. min-w-0 so the middle
          cluster can shrink without pushing the right cluster off-screen. */}
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/cae-icon-white.png" alt="CAE" className="h-5 w-auto" />
        {/* Wordmark + separator hide on < sm to give mode toggle + ticker
            more horizontal room on a 375px viewport. */}
        <span className="hidden text-sm font-semibold tracking-tight text-[color:var(--text)] sm:inline">
          CAE
        </span>
        <span
          className="hidden text-[color:var(--text-dim)] sm:inline"
          aria-hidden="true"
        >
          ·
        </span>
        <ModeToggle />
      </div>

      {/* Middle: token ticker. flex-1 + min-w-0 lets it shrink; CostTicker
          itself collapses its textual suffixes on < sm. */}
      <div className="flex min-w-0 flex-1 items-center sm:ml-4">
        <CostTicker />
      </div>

      {/* Right cluster: inline icons on sm+, overflow menu on < sm.
          Safety-critical freshness indicators (HeartbeatDot, LivenessChip)
          render on all viewports. User menu is always visible. */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Desktop/tablet inline icons. Hidden on < sm where the overflow
            menu covers the same targets. */}
        <div
          className="hidden items-center gap-2 sm:flex"
          data-testid="top-nav-inline-chrome"
        >
          <FloorIcon />
          <MemoryIcon />
          <MetricsIcon />
          <ChatPopOutIcon />
          <ShortcutHelpButton />
          <span
            className="mx-1 h-4 w-px bg-[color:var(--border-subtle)]"
            aria-hidden="true"
          />
        </div>

        {/* Mobile overflow trigger. self-renders as sm:hidden. */}
        <TopNavOverflowMenu />

        {/* Safety-critical status indicators — always visible so operators
            can spot halts / staleness on any viewport. */}
        <HeartbeatDot />
        {/* AmbientClock + DevBadge are status-only, not safety-critical;
            collapse on < sm to free horizontal space. */}
        <span className="hidden sm:inline-flex">
          <AmbientClock />
        </span>
        <LivenessChip />
        <span className="hidden sm:inline-flex">
          <DevBadge />
        </span>
        <span
          className="mx-1 hidden h-4 w-px bg-[color:var(--border-subtle)] sm:inline-block"
          aria-hidden="true"
        />
        <UserMenu session={session} />
      </div>
    </header>
  );
}
