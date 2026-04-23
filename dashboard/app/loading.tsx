"use client";

/**
 * Suspense fallback — Pikachu walking GIF + cursor-trail effect per
 * Eric session-10 pick (codepen.io/raudaschl/pen/JzRKqN).
 *
 * Scoped to the content area (NOT full viewport) — preserves the top-nav
 * and sidebar chrome, only the route content pane swaps to the loader.
 * Background matches the dashboard dark theme (`--bg`).
 *
 * jQuery-source effects ported to React:
 *   - Centered pikachu gif
 *   - Hidden real cursor replaced by a yellow dot that follows mousemove
 *     and pulses (CSS keyframes)
 *   - Click spawns a static clone dot at click position (trail effect)
 *
 * Re-exported by per-layout loading.tsx files (build, plan, etc.) so
 * Next App Router picks it up for any subtab transition.
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function RootLoading() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number; visible: boolean }>({
    x: -100,
    y: -100,
    visible: false,
  });
  const [trail, setTrail] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const toLocal = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e: MouseEvent) => {
      const p = toLocal(e);
      setCursor({ x: p.x, y: p.y, visible: true });
    };
    const onLeave = () => setCursor((c) => ({ ...c, visible: false }));
    const onClick = (e: MouseEvent) => {
      const p = toLocal(e);
      nextId.current += 1;
      setTrail((t) => [...t, { id: nextId.current, x: p.x, y: p.y }]);
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="root-loading"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading"
      className="cae-pikachu-loader relative w-full min-h-[calc(100vh-40px)] flex flex-col items-center justify-center gap-4 bg-[color:var(--bg)]"
    >
      <Image
        src="/pikachu-loading.gif"
        alt="Loading"
        width={200}
        height={209}
        priority
        unoptimized
        className="block"
      />
      <span id="loadingText" className="text-[color:var(--text)] text-base font-medium">
        Loading...
      </span>

      {/* Cursor-follower yellow dot (replaces hidden real cursor).
          Only rendered while pointer is inside the loader. */}
      {cursor.visible && (
        <span
          aria-hidden="true"
          className="cae-pikachu-mouse"
          style={{ left: cursor.x - 16, top: cursor.y - 16 }}
        />
      )}

      {/* Click-spawned trail clones */}
      {trail.map((dot) => (
        <span
          key={dot.id}
          aria-hidden="true"
          className="cae-pikachu-mouse cae-pikachu-mouse-trail"
          style={{ left: dot.x - 16, top: dot.y - 16 }}
        />
      ))}
    </div>
  );
}
