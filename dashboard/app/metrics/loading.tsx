/**
 * /metrics route loader — 4 card-tile skeletons (Spending / Well / Fast /
 * Agents summary) + a fake sparkline shimmer underneath.
 *
 * Mirrors the real /metrics page layout (app/metrics/page.tsx renders a
 * MetricsClient with 3-4 panels) so the transition to loaded feels like a
 * paint-swap, not a curtain rise.
 */

import { Shimmer } from "@/components/ui/shimmer";
import { labelFor } from "@/lib/copy/labels";

export default function MetricsLoading() {
  const L = labelFor(false);
  const cards = ["today", "mtd", "p50", "queue"] as const;

  return (
    <main
      data-testid="metrics-loading"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading metrics"
      className="mx-auto flex max-w-6xl flex-col gap-6 p-6"
    >
      {/* Page heading placeholder — roughly matches the real h1 height */}
      <Shimmer
        variant="text"
        width="18%"
        height={28}
        testId="metrics-loading-heading"
      />

      {/* 4 card-tile skeletons in a responsive grid. */}
      <div
        data-testid="metrics-loading-cards"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {cards.map((key) => (
          <div
            key={key}
            data-testid={`metrics-loading-card-${key}`}
            className="flex flex-col gap-3 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4"
          >
            <Shimmer variant="text" width="45%" height={12} />
            <Shimmer variant="box" width="70%" height={24} />
            <Shimmer variant="text" width="32%" height={10} />
          </div>
        ))}
      </div>

      {/* Sparkline shimmer — a full-width bar with a subtle wave silhouette.
          For simplicity this is a single Shimmer bar — the real sparkline
          has peaks/valleys but the skeleton is meant to feel "line-shaped",
          not "graph-shaped". */}
      <div
        data-testid="metrics-loading-sparkline"
        className="flex flex-col gap-3 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4"
      >
        <Shimmer variant="text" width="22%" height={14} />
        <Shimmer variant="bar" height={64} />
        {/* Axis ticks — three small bars */}
        <div className="flex items-center justify-between gap-2">
          <Shimmer variant="text" width={32} height={8} />
          <Shimmer variant="text" width={32} height={8} />
          <Shimmer variant="text" width={32} height={8} />
        </div>
      </div>

      {/* Kind voice line */}
      <p
        data-testid="metrics-loading-voice"
        className="mt-2 text-center text-sm text-[color:var(--text-muted)]"
      >
        {L.loading.metrics}
      </p>
    </main>
  );
}
