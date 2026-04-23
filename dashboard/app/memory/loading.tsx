/**
 * /memory route loader — ~8 graph-node circles arranged in a circle, each
 * pulsing with the shared `.cae-shimmer` surface treatment.
 *
 * Mimics the react-flow graph canvas in the real page so the transition
 * reads as "the nodes are resolving, edges next" rather than a curtain.
 */

import { Shimmer } from "@/components/ui/shimmer";
import { labelFor } from "@/lib/copy/labels";

// 8 nodes spaced around a circle, radius ~90px from center.
const NODE_COUNT = 8;
const RADIUS = 90;

function nodePositions() {
  return Array.from({ length: NODE_COUNT }, (_, i) => {
    const angle = (i / NODE_COUNT) * 2 * Math.PI - Math.PI / 2;
    return {
      i,
      x: Math.cos(angle) * RADIUS,
      y: Math.sin(angle) * RADIUS,
    };
  });
}

export default function MemoryLoading() {
  const L = labelFor(false);
  const nodes = nodePositions();

  return (
    <main
      data-testid="memory-loading"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading memory graph"
      className="mx-auto flex h-[calc(100vh-40px)] w-full max-w-7xl flex-col items-center justify-center gap-8 px-6 py-12"
    >
      {/* Graph preview — 8 nodes in a circle around a centered larger node. */}
      <div
        data-testid="memory-loading-graph"
        aria-hidden="true"
        className="relative h-[240px] w-[240px]"
      >
        {/* Center node */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Shimmer
            variant="circle"
            size={40}
            testId="memory-loading-node-center"
          />
        </div>
        {nodes.map(({ i, x, y }) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
            }}
          >
            <Shimmer
              variant="circle"
              size={24}
              testId={`memory-loading-node-${i}`}
            />
          </div>
        ))}
      </div>

      {/* Kind voice line */}
      <div
        data-testid="memory-loading-voice"
        className="flex flex-col items-center gap-2"
      >
        <p className="text-sm text-[color:var(--text-muted)]">
          {L.loading.memory}
        </p>
      </div>
    </main>
  );
}
