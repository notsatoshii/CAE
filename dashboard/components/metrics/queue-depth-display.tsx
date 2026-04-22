"use client";

/**
 * Current queue-depth big-number (Phase 7 Speed panel).
 *
 * Renders `spending.speed.queue_depth_now` as a single large number with the
 * queue-depth heading. `metricsFastQueueDepthValue` handles the zero case
 * ("nothing waiting") and the plural case ("N waiting") — UI does not branch.
 */

import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";

interface Props {
  value: number;
}

export function QueueDepthDisplay({ value }: Props) {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  return (
    <div
      data-testid="queue-depth-display"
      className="flex flex-col gap-1 rounded-md bg-[color:var(--surface-hover)] p-4"
    >
      <span className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
        {L.metricsFastQueueDepthHeading}
      </span>
      <span className="font-mono text-2xl text-[color:var(--text)]">
        {L.metricsFastQueueDepthValue(value)}
      </span>
    </div>
  );
}
