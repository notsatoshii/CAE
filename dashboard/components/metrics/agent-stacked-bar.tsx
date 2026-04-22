"use client";

/**
 * Phase 7 — recharts stacked BarChart of per-agent tokens over the last 30 days.
 *
 * Consumes `SpendingState["by_agent_30d"]` from `getMetricsState()` — 30
 * zero-filled UTC date rows × 9 agent columns (unknown agents folded into
 * "forge" upstream per Phase 5 pattern). One `<Bar stackId="a" />` per agent
 * in AGENT_META iteration order; legend renders each agent's human label.
 *
 * Design notes:
 * - Height fixed at h-60 (240px); width fills the container via
 *   ResponsiveContainer. UI-SPEC §8.
 * - Tooltip chromed to match the dark theme via CSS custom properties
 *   (see app/globals.css §`:root`).
 * - Explicit empty state when ALL rows are zero-token — expected on day 1 of
 *   the month, or before the Wave 0 adapter has emitted any token events.
 * - COLOR_MAP is inlined rather than lifted to agent-meta.ts; this is a v0.1
 *   one-off lookup — a future DRY pass may elevate it. Covers every color
 *   token currently present in AGENT_META (cyan, orange, yellow, purple,
 *   gray, red, blue, amber) plus the usual green/other fallbacks.
 * - No `asChild` anywhere (base-ui gotcha, AGENTS.md p2-plA-t1-e81f6c).
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AGENT_META, type AgentName } from "@/lib/copy/agent-meta";
import type { SpendingState } from "@/lib/cae-metrics-state";

// Map AGENT_META.color tokens to concrete hex values for recharts.
// Must cover every string token currently used in AGENT_META.
const COLOR_MAP: Record<string, string> = {
  cyan: "#00d4ff",
  green: "#22c55e",
  purple: "#a855f7",
  orange: "#f97316",
  yellow: "#eab308",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
  gray: "#9ca3af",
};

interface Props {
  data: SpendingState["by_agent_30d"];
}

export function AgentStackedBar({ data }: Props) {
  const agentNames = Object.keys(AGENT_META) as AgentName[];
  const isEmpty =
    data.length === 0 ||
    data.every((row) =>
      agentNames.every((a) => {
        const v = row[a];
        return v === undefined || v === 0;
      }),
    );

  if (isEmpty) {
    return (
      <div
        data-testid="agent-stacked-bar-empty"
        className="flex h-60 items-center justify-center rounded-md border border-dashed border-[color:var(--border)] text-sm text-[color:var(--text-muted)]"
      >
        No token data in the last 30 days yet.
      </div>
    );
  }

  return (
    <div data-testid="agent-stacked-bar" className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
          <XAxis
            dataKey="date"
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
          />
          <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
            }}
            cursor={{ fill: "var(--surface-hover)", opacity: 0.3 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {agentNames.map((name) => (
            <Bar
              key={name}
              dataKey={name}
              stackId="a"
              fill={COLOR_MAP[AGENT_META[name].color] ?? "#9ca3af"}
              name={AGENT_META[name].label}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
