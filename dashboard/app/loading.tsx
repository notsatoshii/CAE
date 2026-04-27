import { Skeleton, CardSkeleton, RowSkeleton } from "@/components/ui/skeleton";

/**
 * Root Suspense fallback — skeleton layout matching the dashboard home page.
 *
 * Mirrors the structure of the real page:
 *   1. Heading bar (project name)
 *   2. MissionControlHero (4 stat tiles)
 *   3. Two-column grid:
 *      - Left: LiveActivityPanel, RollupStrip, ActivePhaseCards, NeedsYouList, RecentCommits
 *      - Right: FloorPin, ActivityFeed
 */
export default function RootLoading() {
  return (
    <div
      data-testid="root-loading"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading dashboard"
      className="w-full min-h-[calc(100vh-40px)] bg-[color:var(--bg)] p-6 space-y-6"
    >
      {/* ── Heading ── */}
      <Skeleton className="h-8 w-64" label="Loading project name" />

      {/* ── MissionControlHero — 4 stat tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton
            key={i}
            testId={`stat-tile-skeleton-${i}`}
            className="border border-[color:var(--border)] bg-[color:var(--surface)]"
          />
        ))}
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Left column */}
        <div className="flex flex-col gap-5">
          {/* LiveActivityPanel */}
          <div className="card-base border border-[color:var(--border)] bg-[color:var(--surface)] p-4 space-y-3">
            <Skeleton className="h-5 w-40" label="Loading live activity" />
            <RowSkeleton rows={3} />
          </div>

          {/* RollupStrip */}
          <div className="flex gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 flex-1 rounded-full" label="Loading rollup" />
            ))}
          </div>

          {/* ActivePhaseCards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CardSkeleton className="border border-[color:var(--border)] bg-[color:var(--surface)]" />
            <CardSkeleton className="border border-[color:var(--border)] bg-[color:var(--surface)]" />
          </div>

          {/* NeedsYouList */}
          <div className="card-base border border-[color:var(--border)] bg-[color:var(--surface)] p-4 space-y-3">
            <Skeleton className="h-5 w-36" label="Loading needs-you list" />
            <RowSkeleton rows={3} />
          </div>

          {/* RecentCommits */}
          <div className="card-base border border-[color:var(--border)] bg-[color:var(--surface)] p-4 space-y-3">
            <Skeleton className="h-5 w-36" label="Loading recent commits" />
            <RowSkeleton rows={4} />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {/* FloorPin */}
          <div className="card-base border border-[color:var(--border)] bg-[color:var(--surface)] p-4 space-y-3">
            <Skeleton className="h-5 w-28" label="Loading floor pin" />
            <Skeleton className="h-32 w-full" label="Loading floor pin content" />
          </div>

          {/* ActivityFeed */}
          <div className="card-base border border-[color:var(--border)] bg-[color:var(--surface)] p-4 space-y-3">
            <Skeleton className="h-5 w-32" label="Loading activity feed" />
            <RowSkeleton rows={6} />
          </div>
        </div>
      </div>

      <span className="sr-only">Loading dashboard</span>
    </div>
  );
}
