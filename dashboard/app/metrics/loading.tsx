"use client";

/**
 * /metrics route suspense fallback — Metrics dashboard skeleton.
 * Shows stat cards and chart skeletons while the metrics page hydrates.
 */

export default function MetricsLoading() {
  return (
    <div
      data-testid="metrics-loading"
      role="status"
      aria-busy="true"
      className="w-full h-full bg-[color:var(--bg)] p-6"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-40 rounded bg-[color:var(--text-dim)] opacity-20"></div>
          <div className="h-4 w-80 rounded bg-[color:var(--text-dim)] opacity-15"></div>
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface)] space-y-3"
            >
              <div className="h-4 w-24 rounded bg-[color:var(--text-dim)] opacity-15"></div>
              <div className="h-8 w-32 rounded bg-[color:var(--text-dim)] opacity-20"></div>
              <div className="h-3 w-20 rounded bg-[color:var(--text-dim)] opacity-10"></div>
            </div>
          ))}
        </div>

        {/* Chart skeleton */}
        <div className="p-6 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface)] space-y-4">
          <div className="h-5 w-32 rounded bg-[color:var(--text-dim)] opacity-20"></div>
          <div className="h-64 w-full rounded bg-[color:var(--text-dim)] opacity-10"></div>
        </div>

        {/* Table skeleton */}
        <div className="p-6 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface)] space-y-3">
          <div className="h-5 w-40 rounded bg-[color:var(--text-dim)] opacity-20"></div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 w-1/4 rounded bg-[color:var(--text-dim)] opacity-15"></div>
              <div className="h-4 w-1/4 rounded bg-[color:var(--text-dim)] opacity-15"></div>
              <div className="h-4 w-1/4 rounded bg-[color:var(--text-dim)] opacity-15"></div>
              <div className="h-4 w-1/6 rounded bg-[color:var(--text-dim)] opacity-15"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
