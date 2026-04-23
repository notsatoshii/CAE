/**
 * /floor route loader — "booting isometric engine" with a lightweight
 * CSS-gradient tile grid shimmering underneath.
 *
 * No PixiJS, no canvas — just a 6×4 grid of `.cae-shimmer` tiles arranged in
 * an isometric-feeling offset so it reads as "the floor is coming online".
 *
 * Fills the full floor viewport (h-[calc(100vh-40px)]) so the transition to
 * the real FloorClient canvas is a tile-for-tile swap rather than a curtain.
 */

import { Shimmer } from "@/components/ui/shimmer";
import { labelFor } from "@/lib/copy/labels";

export default function FloorLoading() {
  const L = labelFor(false);

  // 6 columns × 4 rows = 24 tiles. Odd rows are offset by 1 cell-width
  // (transform: translateX(...)) so the grid reads isometric.
  const cols = 6;
  const rows = 4;
  const cells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({ r, c })),
  );

  return (
    <main
      data-testid="floor-loading"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Booting the live floor"
      className="relative flex h-[calc(100vh-40px)] w-full flex-col items-center justify-center gap-6 overflow-hidden px-6 py-12"
    >
      {/* Tile grid — absolutely-positioned behind the voice line so it reads
          as ambient background, not a foreground spinner. */}
      <div
        data-testid="floor-loading-grid"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-60"
      >
        {cells.map((row, ri) => (
          <div
            key={ri}
            className="flex gap-2"
            style={{
              transform: `translateX(${ri % 2 === 0 ? 0 : 32}px)`,
            }}
          >
            {row.map(({ c }) => (
              <Shimmer
                key={c}
                variant="box"
                width={56}
                height={32}
                className="rounded-[4px]"
                testId={`floor-loading-tile-${ri}-${c}`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Kind voice line — sits above the tile grid. */}
      <div
        data-testid="floor-loading-voice"
        className="relative z-10 flex flex-col items-center gap-2 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)]/90 px-4 py-3 backdrop-blur"
      >
        <p className="text-sm font-medium text-[color:var(--text)]">
          {L.loading.floor}
        </p>
        <div aria-hidden="true" className="flex items-center gap-1.5">
          <span
            className="cae-loader-pulse-dot size-1.5 rounded-full bg-[color:var(--accent)]"
            style={{ ["--i" as string]: 0 }}
          />
          <span
            className="cae-loader-pulse-dot size-1.5 rounded-full bg-[color:var(--accent)]"
            style={{ ["--i" as string]: 1 }}
          />
          <span
            className="cae-loader-pulse-dot size-1.5 rounded-full bg-[color:var(--accent)]"
            style={{ ["--i" as string]: 2 }}
          />
        </div>
      </div>
    </main>
  );
}
