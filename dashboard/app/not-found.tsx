/**
 * 404 — Phase 15 Wave 2.8.
 *
 * Replaces Next's default not-found page with one that has CAE character:
 *   - SVG pixel-art "lost agent" placeholder (real sprite kit ships in
 *     Wave 9; this is the contractually-shaped stand-in per WAVE-2-PLAN
 *     §2.8 note "Pixel-art placeholders are SVG circles in pixel-art
 *     style until real sprite kit lands").
 *   - Friendly explanation copy in CAE's voice.
 *   - Breadcrumb showing the path the user expected.
 *   - 3 quick links: Build home, Agents, Command palette.
 *
 * Server component — no `"use client"` needed since this is purely static
 * markup. Next mounts it automatically when `notFound()` is called or a
 * route resolves to nothing.
 */

import Link from "next/link";
import { headers } from "next/headers";
import { Home, Bot, Search } from "lucide-react";

export default async function NotFound() {
  // Best-effort breadcrumb. `next/headers` exposes the requested path via
  // the `x-invoke-path` header on the not-found render path. Falls back
  // to a friendly placeholder when unavailable (older Next runtimes).
  const h = await headers();
  const requestedPath =
    h.get("x-invoke-path") ?? h.get("x-matched-path") ?? "/";

  return (
    <main
      data-testid="not-found-page"
      className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center gap-6 px-6 py-12 text-center"
    >
      {/* Pixel-art lost-agent placeholder. Real sprite kit ships in Wave 9. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        className="size-24 text-[color:var(--accent)]"
      >
        <g shapeRendering="crispEdges">
          {/* Body */}
          <rect x="20" y="16" width="24" height="24" fill="currentColor" />
          {/* Eyes (lost — `?` look) */}
          <rect x="26" y="24" width="4" height="4" fill="var(--bg)" />
          <rect x="34" y="24" width="4" height="4" fill="var(--bg)" />
          {/* Mouth (frown) */}
          <rect x="26" y="34" width="12" height="2" fill="var(--bg)" />
          <rect x="24" y="32" width="2" height="2" fill="var(--bg)" />
          <rect x="38" y="32" width="2" height="2" fill="var(--bg)" />
          {/* Antenna */}
          <rect x="30" y="8" width="4" height="8" fill="currentColor" />
          <rect x="28" y="6" width="8" height="2" fill="currentColor" />
          {/* Legs */}
          <rect x="22" y="40" width="6" height="8" fill="currentColor" />
          <rect x="36" y="40" width="6" height="8" fill="currentColor" />
        </g>
      </svg>

      <div className="flex flex-col gap-2">
        <h1
          data-testid="not-found-title"
          className="text-2xl font-semibold text-[color:var(--text)]"
        >
          Looks like that page wandered off.
        </h1>
        <p className="text-sm text-[color:var(--text-muted)]">
          We couldn&apos;t find{" "}
          <code
            data-testid="not-found-breadcrumb"
            className="rounded bg-[color:var(--surface-hover)] px-1.5 py-0.5 font-mono text-xs text-[color:var(--text)]"
          >
            {requestedPath}
          </code>{" "}
          — here&apos;s what&apos;s nearby:
        </p>
      </div>

      <nav
        data-testid="not-found-quicklinks"
        aria-label="Suggested destinations"
        className="flex flex-wrap items-center justify-center gap-2"
      >
        <Link
          href="/build"
          data-testid="not-found-link-home"
          className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-1.5 text-sm text-[color:var(--text)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
        >
          <Home aria-hidden="true" className="size-4" />
          Build home
        </Link>
        <Link
          href="/build/agents"
          data-testid="not-found-link-agents"
          className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-1.5 text-sm text-[color:var(--text)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
        >
          <Bot aria-hidden="true" className="size-4" />
          Agents
        </Link>
        <Link
          href="/build?palette=open"
          data-testid="not-found-link-palette"
          className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-1.5 text-sm text-[color:var(--text)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
        >
          <Search aria-hidden="true" className="size-4" />
          Search
          <kbd className="ml-1 rounded border border-[color:var(--border-subtle)] bg-[color:var(--bg)] px-1 py-0.5 font-mono text-[10px] text-[color:var(--text-muted)]">
            ⌘K
          </kbd>
        </Link>
      </nav>
    </main>
  );
}
