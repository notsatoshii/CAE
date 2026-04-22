"use client";

/**
 * Phase 7 — top-10 most expensive tasks list.
 *
 * Consumes `SpendingState["top_expensive"]` from `getMetricsState()`. The
 * aggregator groups by `task_id` across ALL projects, sorts by total tokens
 * desc, and caps at 10 — so this component just renders what it gets (still
 * slices to 10 defensively).
 *
 * Rendered as `<ol>` for keyboard/screen-reader ordering semantics. Per-row:
 *   - zero-padded rank (01, 02, ..., 10)
 *   - agent emoji (aria-hidden — the text after it already names the agent)
 *   - task title (truncates on overflow)
 *   - token count + agent label (founder_label in founder mode, label in dev)
 *
 * Token formatting mirrors CostTicker (< 1k → raw, < 1M → k, else → M).
 * No currency sign anywhere — tokens + `tok` suffix only (CONTEXT D-07).
 *
 * `labelFor` is imported even though none of the existing L.* templates are
 * currently interpolated here: leaving the hook in place makes it trivial to
 * swap in `L.metricsSpendingTopTaskRow` later without adding the hook back.
 */

import { agentMetaFor } from "@/lib/copy/agent-meta";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";
import type { SpendingState } from "@/lib/cae-metrics-state";

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

interface Props {
  data: SpendingState["top_expensive"];
}

export function TopExpensiveTasks({ data }: Props) {
  const { dev } = useDevMode();
  // Currently unused in the row renderer; kept resolved so future copy tweaks
  // (via L.metricsSpendingTopTaskRow etc.) don't need the hook reintroduced.
  const _L = labelFor(dev);
  void _L;

  if (data.length === 0) {
    return (
      <div
        data-testid="top-expensive-tasks-empty"
        className="rounded-md border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--text-muted)]"
      >
        No recorded jobs yet.
      </div>
    );
  }

  return (
    <div data-testid="top-expensive-tasks" className="flex flex-col gap-1">
      <ol className="space-y-1">
        {data.slice(0, 10).map((row, idx) => {
          const meta = agentMetaFor(row.agent);
          const label = dev ? meta.label : meta.founder_label;
          return (
            <li
              key={row.task_id + "-" + idx}
              className="flex items-center justify-between rounded-md bg-[color:var(--surface)] px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-5 font-mono text-[10px] text-[color:var(--text-muted)]">
                  {(idx + 1).toString().padStart(2, "0")}
                </span>
                <span aria-hidden="true">{meta.emoji}</span>
                <span className="truncate text-[color:var(--text)]">
                  {row.title}
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs text-[color:var(--text-muted)]">
                {formatTokens(row.tokens)} tok · {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
