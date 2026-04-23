/**
 * Root-level shell loader — rendered by Next 16 App Router as the global
 * Suspense fallback for the root boundary.
 *
 * Design brief (ROADMAP backlog → branded loaders):
 *   - Centered CAE brand mark (SVG pixel-art wordmark matching the voice of
 *     not-found.tsx / error.tsx — no real sprite kit exists yet, Wave 9
 *     supersedes).
 *   - A 3-dot waveform underneath that pulses in a staggered cadence
 *     (`.cae-loader-pulse-dot` in globals.css, `--i` index drives the delay).
 *   - A kind status line below the dots that rotates through ~5 voice
 *     variants on client mount (see <RotatingVoice /> — client island so
 *     the random pick doesn't fight hydration).
 *   - `prefers-reduced-motion` hands-free: globals.css already short-circuits
 *     `.cae-loader-pulse-dot` and `.cae-loader-breath` animations in that mode.
 *   - Fills the route area (min-h-[calc(100vh-40px)] matches the top-nav
 *     subtraction used by /memory, /floor, /chat) — never a lonely spinner.
 *
 * Server component. The only client-only bit is <RotatingVoice /> which has
 * its own "use client" boundary.
 */

import { RotatingVoice } from "@/components/loading/rotating-voice";
import { labelFor } from "@/lib/copy/labels";

export default function RootLoading() {
  // Server-rendered with founder copy; client-side DevMode toggle would
  // require a provider subscription, which is overkill for a transient
  // fallback. The voice variants are plain strings so dev users still
  // see reasonable copy; the DEV variant is a back-pocket refinement.
  const L = labelFor(false);

  return (
    <main
      data-testid="root-loading"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading CAE Dashboard"
      className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-xl flex-col items-center justify-center gap-6 px-6 py-12 text-center"
    >
      {/* Brand mark — pixel-art CAE wordmark. Real sprite kit ships in Wave 9. */}
      <div
        data-testid="root-loading-mark"
        className="cae-loader-breath flex items-center justify-center"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 96 32"
          className="h-10 w-auto text-[color:var(--accent)]"
        >
          <g shapeRendering="crispEdges" fill="currentColor">
            {/* C */}
            <rect x="4"  y="6"  width="12" height="2" />
            <rect x="4"  y="6"  width="2"  height="20" />
            <rect x="4"  y="24" width="12" height="2" />
            {/* A */}
            <rect x="22" y="8"  width="2"  height="18" />
            <rect x="22" y="6"  width="12" height="2" />
            <rect x="32" y="8"  width="2"  height="18" />
            <rect x="22" y="14" width="12" height="2" />
            {/* E */}
            <rect x="40" y="6"  width="2"  height="20" />
            <rect x="40" y="6"  width="12" height="2" />
            <rect x="40" y="14" width="10" height="2" />
            <rect x="40" y="24" width="12" height="2" />
            {/* subtle accent dot — matches the heartbeat dot in top-nav */}
            <rect x="60" y="14" width="4" height="4" fill="var(--accent-hover)" />
          </g>
        </svg>
      </div>

      {/* 3-dot waveform — staggered cadence via --i custom property. */}
      <div
        data-testid="root-loading-dots"
        aria-hidden="true"
        className="flex items-center gap-1.5"
      >
        <span
          className="cae-loader-pulse-dot size-2 rounded-full bg-[color:var(--accent)]"
          style={{ ["--i" as string]: 0 }}
        />
        <span
          className="cae-loader-pulse-dot size-2 rounded-full bg-[color:var(--accent)]"
          style={{ ["--i" as string]: 1 }}
        />
        <span
          className="cae-loader-pulse-dot size-2 rounded-full bg-[color:var(--accent)]"
          style={{ ["--i" as string]: 2 }}
        />
      </div>

      {/* Kind voice line — client island so the random variant doesn't fight
          hydration. Empty on first paint, swaps in post-mount. */}
      <RotatingVoice
        variants={L.loading.appBoot}
        testId="root-loading-voice"
      />
    </main>
  );
}
