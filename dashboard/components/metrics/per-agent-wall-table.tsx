"use client";

/**
 * Per-agent P50/P95 wall-time table (Phase 7 Speed panel).
 *
 * Shows one row per agent with completed jobs in the 30d window; hides agents
 * with `n === 0` (per plan — a blank row for every silent agent would bury
 * the signal). Sorted by sample count descending so the most-used agents
 * surface at the top.
 *
 * Duration formatting is inlined (labels.ts keeps `formatDuration` private).
 * Founder-speak shows the colourful "the builder" labels; dev-mode flips to
 * the proper-noun agent names via `useDevMode()`.
 */

import { agentMetaFor } from "@/lib/copy/agent-meta";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";

interface Row {
  agent: string;
  p50_ms: number;
  p95_ms: number;
  n: number;
}

interface Props {
  rows: Row[];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return ms + "ms";
  const sec = ms / 1000;
  if (sec < 60) return sec.toFixed(1) + "s";
  const min = sec / 60;
  if (min < 60) return min.toFixed(1) + "m";
  return (min / 60).toFixed(1) + "h";
}

export function PerAgentWallTable({ rows }: Props) {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  const visible = rows.filter((r) => r.n > 0).sort((a, b) => b.n - a.n);

  if (visible.length === 0) {
    return (
      <div
        data-testid="per-agent-wall-empty"
        className="rounded-md border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--text-muted)]"
      >
        No completed jobs yet.
      </div>
    );
  }

  return (
    <div data-testid="per-agent-wall" className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
            <th className="px-3 py-2">{L.metricsFastPerAgentColAgent}</th>
            <th className="px-3 py-2 text-right">{L.metricsFastPerAgentColP50}</th>
            <th className="px-3 py-2 text-right">{L.metricsFastPerAgentColP95}</th>
            <th className="px-3 py-2 text-right">{L.metricsFastPerAgentColN}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const meta = agentMetaFor(row.agent);
            const shown = dev ? meta.label : meta.founder_label;
            return (
              <tr
                key={row.agent}
                className="border-t border-[color:var(--border)]"
              >
                <td className="px-3 py-2">
                  <span aria-hidden="true" className="mr-1">
                    {meta.emoji}
                  </span>
                  <span className="text-[color:var(--text)]">{shown}</span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {formatDuration(row.p50_ms)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {formatDuration(row.p95_ms)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-[color:var(--text-muted)]">
                  {row.n}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
