"use client";

import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { Card, CardContent } from "@/components/ui/card";
import { LastUpdated } from "@/components/ui/last-updated";

function formatTok(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

export function RollupStrip() {
  const { data, lastUpdated } = useStatePoll();
  const { dev } = useDevMode();
  const t = labelFor(dev);

  const rollup = data?.rollup ?? {
    shipped_today: 0,
    tokens_today: 0,
    in_flight: 0,
    blocked: 0,
    warnings: 0,
  };
  const allZero =
    rollup.shipped_today === 0 &&
    rollup.tokens_today === 0 &&
    rollup.in_flight === 0 &&
    rollup.blocked === 0 &&
    rollup.warnings === 0;

  if (allZero) {
    return (
      <Card data-testid="rollup-strip" className="mb-6">
        <CardContent className="py-4 text-sm text-[color:var(--text-muted)]">
          {t.rollupEmptyState}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="rollup-strip" className="mb-6">
      <CardContent className="py-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Slot value={rollup.shipped_today} label={t.rollupShippedLabel} />
        <Divider />
        <Slot value={formatTok(rollup.tokens_today)} label={t.rollupTokensLabel} />
        <Divider />
        <Slot value={rollup.in_flight} label={t.rollupInFlightLabel} />
        <Divider />
        <Slot value={rollup.blocked} label={t.rollupBlockedLabel} danger={rollup.blocked > 0} />
        <Divider />
        <Slot
          value={t.rollupWarningsLabel + rollup.warnings}
          label=""
          warning={rollup.warnings > 0}
        />
        <span className="ml-auto">
          <LastUpdated at={lastUpdated} threshold_ms={6000} />
        </span>
      </CardContent>
    </Card>
  );
}

function Slot({
  value,
  label,
  danger,
  warning,
}: {
  value: string | number;
  label: string;
  danger?: boolean;
  warning?: boolean;
}) {
  const color = danger ? "var(--danger)" : warning ? "var(--warning)" : "var(--text)";
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-mono text-sm tabular-nums" style={{ color }}>
        {value}
      </span>
      {label && <span className="text-[color:var(--text-muted)]">{label}</span>}
    </span>
  );
}

function Divider() {
  return (
    <span className="text-[color:var(--text-dim)]" aria-hidden="true">
      ·
    </span>
  );
}
