"use client";

import {
  Package,
  Zap,
  AlertTriangle,
  CircleDollarSign,
  PauseCircle,
} from "lucide-react";
import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { LastUpdated } from "@/components/ui/last-updated";

function formatTok(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

interface Slot {
  key: string;
  Icon: React.ComponentType<{ className?: string; size?: number; "aria-hidden"?: boolean }>;
  value: string | number;
  label: string;
  /** amber dot iff true */
  warning: boolean;
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

  const slots: Slot[] = [
    {
      key: "shipped",
      Icon: Package,
      value: rollup.shipped_today,
      label: t.rollupShippedLabel,
      warning: false,
    },
    {
      key: "in_flight",
      Icon: Zap,
      value: rollup.in_flight,
      label: t.rollupInFlightLabel,
      warning: false,
    },
    {
      key: "warnings",
      Icon: AlertTriangle,
      value: rollup.warnings,
      label: "warnings",
      warning: rollup.warnings > 0,
    },
    {
      key: "tokens",
      Icon: CircleDollarSign,
      value: formatTok(rollup.tokens_today),
      label: t.rollupTokensLabel,
      warning: false,
    },
    {
      key: "blocked",
      Icon: PauseCircle,
      value: rollup.blocked,
      label: t.rollupBlockedLabel,
      warning: rollup.blocked > 0,
    },
  ];

  return (
    <div data-testid="rollup-strip" className="mb-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {slots.map((s) => (
          <div
            key={s.key}
            data-testid={"rollup-slot-" + s.key}
            className="card-base relative"
          >
            <s.Icon
              aria-hidden
              size={16}
              className="absolute right-3 top-3 text-[color:var(--text-muted)]"
            />
            <div className="text-[32px] font-semibold tabular-nums leading-none text-[color:var(--text)]">
              {s.value}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block size-1.5 rounded-full"
                style={{
                  backgroundColor: s.warning
                    ? "var(--warning)"
                    : "var(--text-dim)",
                }}
              />
              <span className="text-[13px] text-[color:var(--text-muted)]">
                {s.label}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-end">
        <LastUpdated at={lastUpdated} threshold_ms={6000} />
      </div>
    </div>
  );
}
