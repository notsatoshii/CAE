import type { Session } from "next-auth";
import { ModeToggle } from "./mode-toggle";
import { UserMenu } from "./user-menu";
import { CostTicker } from "./cost-ticker";
import { MemoryIcon } from "./memory-icon";
import { MetricsIcon } from "./metrics-icon";
import { HeartbeatDot } from "./heartbeat-dot";
import { DevBadge } from "./dev-badge";

interface TopNavProps {
  session: Session;
}

// NOTE: StatePollProvider is mounted in app/layout.tsx (Plan 04-06) so it wraps
// BOTH the top-nav chrome AND the page children (build-home widgets require
// useStatePoll access). Previously it wrapped only this header, which broke
// any client widget under /build that called useStatePoll.
export function TopNav({ session }: TopNavProps) {
  return (
    <header
      data-testid="top-nav"
      className="sticky top-0 z-50 flex h-10 items-center border-b border-[color:var(--border-subtle)] bg-[color:var(--bg)]/95 px-3 backdrop-blur"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {/* Left cluster: wordmark + mode toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-tight text-[color:var(--text)]">CAE</span>
        <span className="text-[color:var(--text-dim)]">·</span>
        <ModeToggle />
      </div>

      {/* Middle: token ticker (flex-1 pushes right cluster to the end) */}
      <div className="ml-6 flex flex-1 items-center">
        <CostTicker />
      </div>

      {/* Right cluster: memory, metrics, heartbeat, dev badge, user menu */}
      <div className="flex items-center gap-2">
        <MemoryIcon />
        <MetricsIcon />
        <span className="mx-1 h-4 w-px bg-[color:var(--border-subtle)]" aria-hidden="true" />
        <HeartbeatDot />
        <DevBadge />
        <span className="mx-1 h-4 w-px bg-[color:var(--border-subtle)]" aria-hidden="true" />
        <UserMenu session={session} />
      </div>
    </header>
  );
}
