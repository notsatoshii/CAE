"use client";

/**
 * /memory route suspense fallback — Memory document list skeleton.
 * Shows a text-block skeleton while the memory page hydrates.
 */

export default function MemoryLoading() {
  return (
    <div
      data-testid="memory-loading"
      role="status"
      aria-busy="true"
      className="w-full h-full bg-[color:var(--bg)] p-6"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-[color:var(--text-dim)] opacity-20"></div>
          <div className="h-4 w-96 rounded bg-[color:var(--text-dim)] opacity-15"></div>
        </div>

        {/* Memory cards skeleton */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="p-4 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface)] space-y-3"
          >
            {/* Title */}
            <div className="h-5 w-64 rounded bg-[color:var(--text-dim)] opacity-20"></div>

            {/* Content lines */}
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-[color:var(--text-dim)] opacity-15"></div>
              <div className="h-4 w-5/6 rounded bg-[color:var(--text-dim)] opacity-15"></div>
              <div className="h-4 w-4/6 rounded bg-[color:var(--text-dim)] opacity-15"></div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 pt-2">
              <div className="h-3 w-24 rounded bg-[color:var(--text-dim)] opacity-10"></div>
              <div className="h-3 w-20 rounded bg-[color:var(--text-dim)] opacity-10"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
