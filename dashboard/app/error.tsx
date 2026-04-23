"use client";

/**
 * 500 — Phase 15 Wave 2.8.
 *
 * Replaces Next's default error boundary with one that has CAE character:
 *   - SVG pixel-art "broken-circuit" placeholder (Wave 9 sprite kit
 *     supersedes per WAVE-2-PLAN §2.8).
 *   - Friendly explanation copy + breadcrumb to the offending route.
 *   - Collapsed error stack (the digest line + <details> wrapper for the
 *     full stack so it doesn't dominate the page).
 *   - "Try again" CTA wired to Next's `reset()` callback.
 *   - "Report this" mailto link to eric@diiant.com pre-filled with
 *     digest + path + browser UA so triage doesn't need a back-and-forth.
 *
 * Per Next.js docs, app/error.tsx MUST be a client component because it
 * receives the live `reset()` function and must render after a runtime
 * error has been caught. We also re-log via console.error in a useEffect
 * so the error surfaces in the dev console even when the boundary swallows
 * the original throw.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, RotateCcw, Mail } from "lucide-react";

export interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    // Surface the original error to dev consoles + remote logs.
    // Sentry / pino transport (Phase 13) picks this up automatically.
    console.error("[error-boundary]", { pathname, digest: error.digest, error });
  }, [error, pathname]);

  // mailto body is URI-encoded so newlines + the digest survive intact.
  const reportBody = encodeURIComponent(
    [
      "Bug report from CAE Dashboard",
      "",
      `Path: ${pathname}`,
      `Digest: ${error.digest ?? "(none)"}`,
      `Message: ${error.message ?? "(none)"}`,
      "",
      "What I was doing:",
      "  (please describe)",
      "",
      `User-agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "(server-render)"}`,
    ].join("\n"),
  );
  const mailtoHref = `mailto:eric@diiant.com?subject=${encodeURIComponent(
    "[CAE] error on " + pathname,
  )}&body=${reportBody}`;

  return (
    <main
      data-testid="error-page"
      className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center gap-6 px-6 py-12 text-center"
    >
      {/* Pixel-art broken-circuit placeholder (Wave 9 sprite kit supersedes). */}
      <svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        className="size-24 text-[color:var(--danger)]"
      >
        <g shapeRendering="crispEdges">
          {/* Circuit board base */}
          <rect x="8" y="20" width="48" height="24" fill="currentColor" opacity="0.4" />
          {/* Broken trace: top half lit, bottom half dim, gap between */}
          <rect x="12" y="24" width="16" height="2" fill="currentColor" />
          <rect x="36" y="24" width="16" height="2" fill="currentColor" />
          <rect x="12" y="38" width="20" height="2" fill="var(--text-dim)" />
          <rect x="36" y="38" width="16" height="2" fill="var(--text-dim)" />
          {/* Spark burst at the gap */}
          <rect x="30" y="22" width="2" height="2" fill="var(--warning)" />
          <rect x="32" y="20" width="2" height="2" fill="var(--warning)" />
          <rect x="30" y="26" width="2" height="2" fill="var(--warning)" />
          <rect x="34" y="24" width="2" height="2" fill="var(--warning)" />
          {/* Pin headers — top + bottom */}
          <rect x="14" y="16" width="2" height="4" fill="var(--text)" />
          <rect x="22" y="16" width="2" height="4" fill="var(--text)" />
          <rect x="40" y="16" width="2" height="4" fill="var(--text)" />
          <rect x="48" y="16" width="2" height="4" fill="var(--text)" />
          <rect x="14" y="44" width="2" height="4" fill="var(--text)" />
          <rect x="48" y="44" width="2" height="4" fill="var(--text)" />
        </g>
      </svg>

      <div className="flex flex-col gap-2">
        <h1
          data-testid="error-title"
          className="text-2xl font-semibold text-[color:var(--text)]"
        >
          Something tipped over.
        </h1>
        <p className="text-sm text-[color:var(--text-muted)]">
          We caught an error rendering{" "}
          <code
            data-testid="error-breadcrumb"
            className="rounded bg-[color:var(--surface-hover)] px-1.5 py-0.5 font-mono text-xs text-[color:var(--text)]"
          >
            {pathname}
          </code>
          . Here&apos;s the breadcrumb so you can pick up where you left off.
        </p>
      </div>

      {/* Collapsed error stack — digest is always visible, full stack tucked
          into <details> so it doesn't dominate the page. */}
      <details
        data-testid="error-details"
        className="w-full max-w-md rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3 text-left"
      >
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-[color:var(--text-muted)]">
          Error details
        </summary>
        <div className="mt-2 flex flex-col gap-1 text-xs">
          {error.digest ? (
            <p data-testid="error-digest">
              <span className="text-[color:var(--text-muted)]">Digest:</span>{" "}
              <code className="font-mono text-[color:var(--text)]">
                {error.digest}
              </code>
            </p>
          ) : null}
          <p>
            <span className="text-[color:var(--text-muted)]">Message:</span>{" "}
            <code className="font-mono text-[color:var(--text)]">
              {error.message || "(no message)"}
            </code>
          </p>
          {error.stack ? (
            <pre className="mt-1 max-h-48 overflow-auto rounded bg-[color:var(--bg)] p-2 font-mono text-[10px] text-[color:var(--text-muted)]">
              {error.stack}
            </pre>
          ) : null}
        </div>
      </details>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          data-testid="error-reset-button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-3 py-1.5 text-sm font-medium text-[color:var(--accent-foreground)] transition-colors hover:bg-[color:var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Try again
        </button>
        <Link
          href="/build"
          data-testid="error-link-home"
          className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-1.5 text-sm text-[color:var(--text)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
        >
          <Home aria-hidden="true" className="size-4" />
          Build home
        </Link>
        <a
          href={mailtoHref}
          data-testid="error-report-link"
          className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-1.5 text-sm text-[color:var(--text-muted)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
        >
          <Mail aria-hidden="true" className="size-4" />
          Report this
        </a>
      </div>
    </main>
  );
}
