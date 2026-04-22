"use client";

import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { LastUpdated } from "@/components/ui/last-updated";
import { cn } from "@/lib/utils";

type Status = "up" | "degraded" | "halt";

export function HeartbeatDot() {
  const { data, error, lastUpdated } = useStatePoll();

  let status: Status = "up";
  if (error) status = "degraded";
  else if (data) {
    if (data.breakers.halted) status = "halt";
    else if (data.breakers.retryCount > 0 || data.breakers.recentPhantomEscalations > 0) status = "degraded";
    else status = "up";
  } else {
    status = "up"; // pre-first-fetch
  }

  const color =
    status === "up" ? "var(--success)" : status === "degraded" ? "var(--warning)" : "var(--danger)";
  const label = status === "up" ? "Live" : status === "degraded" ? "Degraded" : "Halted";

  return (
    <span
      data-testid="heartbeat-dot"
      className="inline-flex items-center gap-1.5 text-xs text-[color:var(--text-muted)]"
      title={label}
    >
      <span
        aria-label={label}
        className={cn("inline-block size-2 rounded-full", status === "up" && "animate-pulse")}
        style={{ backgroundColor: color }}
      />
      {/* Replace hardcoded "live" text with an honest freshness timestamp */}
      <LastUpdated at={lastUpdated} threshold_ms={6000} />
    </span>
  );
}
