"use client";

/**
 * Phase 8 Wave 4 (plan 08-06 Task 2, MEM-10, D-07): per-file Git Timeline
 * drawer with 2-commit-pick workflow.
 *
 * Contract (per D-07):
 *   - Drawer opens for ONE file at a time (props.absFilePath).
 *   - Fetches GET /api/memory/git-log/<encoded-abs-path> → { log: GitLogEntry[] }.
 *   - User picks up to TWO commits via checkboxes. Pick state = Set<string>
 *     of sha; if a third is clicked, the OLDEST pick is dropped.
 *   - "Show diff" button enables only when exactly 2 commits are picked.
 *   - Clicking Show diff mounts <DiffView shaA shaB path=absFilePath />.
 *
 * A11y:
 *   - role="dialog" + aria-modal="true" + aria-labelledby.
 *   - ESC key closes.
 *   - Backdrop click closes.
 *   - Focus moves into the drawer on open.
 *
 * Shared mount location: lives at components/memory/ root because Wave 5
 * surfaces it from BOTH Browse (on selected file) and Graph (on clicked node).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";
import type { GitLogEntry } from "@/lib/cae-memory-git";
import { DiffView } from "./diff-view";

export interface GitTimelineDrawerProps {
  open: boolean;
  onClose: () => void;
  absFilePath: string | null;
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; log: GitLogEntry[] }
  | { status: "error"; detail?: string };

function encodePath(abs: string): string {
  // Catchall route consumes segments joined by `/`. Absolute paths start
  // with a leading `/` which becomes an empty first segment; each segment
  // is individually encoded (matches markdown-view's convention).
  return abs
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

function basename(abs: string): string {
  const i = abs.lastIndexOf("/");
  return i < 0 ? abs : abs.slice(i + 1);
}

function formatDate(tsSeconds: number): string {
  try {
    const d = new Date(tsSeconds * 1000);
    if (Number.isNaN(d.getTime())) return String(tsSeconds);
    // Date-only (yyyy-mm-dd) — keeps commit rows dense.
    return d.toISOString().slice(0, 10);
  } catch {
    return String(tsSeconds);
  }
}

export function GitTimelineDrawer({
  open,
  onClose,
  absFilePath,
}: GitTimelineDrawerProps) {
  const { dev } = useDevMode();
  const L = labelFor(dev);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<LoadState>({ status: "idle" });

  // Ordered picks — insertion-order Set<string> so we can drop oldest on
  // overflow. React state is held as an array to keep referential-equality
  // simple; we rebuild on every pick.
  const [picks, setPicks] = useState<string[]>([]);
  const [showingDiff, setShowingDiff] = useState(false);

  // Reset local state when the file changes or drawer closes.
  useEffect(() => {
    setPicks([]);
    setShowingDiff(false);
  }, [absFilePath, open]);

  // Fetch git log on open + path change.
  useEffect(() => {
    if (!open || !absFilePath) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    const url = `/api/memory/git-log/${encodePath(absFilePath)}`;
    (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setState({ status: "error", detail: `HTTP ${res.status}` });
          }
          return;
        }
        const data = (await res.json()) as { log?: GitLogEntry[] };
        const log = Array.isArray(data.log) ? data.log : [];
        if (!cancelled) setState({ status: "ok", log });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            detail: err instanceof Error ? err.message : "network failure",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, absFilePath]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus into the drawer on open.
  useEffect(() => {
    if (open && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [open]);

  const pickSet = useMemo(() => new Set(picks), [picks]);
  const canShowDiff = picks.length === 2 && absFilePath !== null;

  function togglePick(sha: string) {
    setShowingDiff(false);
    setPicks((prev) => {
      if (prev.includes(sha)) {
        // Unpick.
        return prev.filter((s) => s !== sha);
      }
      if (prev.length < 2) {
        return [...prev, sha];
      }
      // Already have 2 — drop oldest (index 0), keep the newer one,
      // append the new sha. Cap stays at 2 (Set semantic via array).
      return [prev[1], sha];
    });
  }

  if (!open || !absFilePath) return null;

  const headingId = "git-timeline-heading";
  const title = `${L.memoryLabelTimeline} · ${basename(absFilePath)}`;

  // shaA is the OLDER pick, shaB the NEWER — order picks by ts descending
  // (logs come newest-first from git log), so picks[] order reflects the
  // click order. We pass picks[0] as shaA and picks[1] as shaB — the user's
  // own selection order, which matches how they'd reason about A→B.
  const [shaA, shaB] = picks;

  return (
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      data-testid="memory-git-timeline-drawer"
    >
      <button
        type="button"
        aria-label="Close drawer backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        tabIndex={-1}
        data-testid="git-timeline-backdrop"
      />

      <div
        ref={drawerRef}
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full w-full max-w-xl translate-x-0 flex-col overflow-y-auto border-l border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-xl transition-transform duration-200 focus:outline-none"
      >
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2
              id={headingId}
              className="truncate text-sm font-medium text-[color:var(--text)]"
              title={title}
            >
              {title}
            </h2>
            <span className="truncate font-mono text-[10px] text-[color:var(--text-muted)]">
              {absFilePath}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={L.sheetCloseLabel}
            className="rounded p-1 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
            data-testid="git-timeline-close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3">
          {state.status === "loading" && (
            <div
              data-testid="git-timeline-loading"
              className="animate-pulse text-xs text-[color:var(--text-muted)]"
            >
              Loading commits…
            </div>
          )}

          {state.status === "error" && (
            <div
              data-testid="git-timeline-error"
              className="rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-3 text-xs text-[color:var(--text)]"
            >
              {L.memoryLoadFailed}
              {dev && state.detail ? ` · ${state.detail}` : ""}
            </div>
          )}

          {state.status === "ok" && state.log.length === 0 && (
            <div
              data-testid="git-timeline-empty"
              className="py-8 text-center text-xs text-[color:var(--text-muted)]"
            >
              No commits for this file.
            </div>
          )}

          {state.status === "ok" && state.log.length > 0 && (
            <>
              <ul
                className="space-y-1"
                data-testid="git-timeline-log"
              >
                {state.log.map((c) => {
                  const isPicked = pickSet.has(c.sha);
                  return (
                    <li
                      key={c.sha}
                      className={
                        "flex items-start gap-2 rounded border p-2 " +
                        (isPicked
                          ? "border-[color:var(--accent)] bg-[color:var(--surface-hover)]"
                          : "border-[color:var(--border)] bg-[color:var(--bg)]")
                      }
                      data-testid={`git-timeline-row-${c.sha}`}
                    >
                      <input
                        type="checkbox"
                        checked={isPicked}
                        onChange={() => togglePick(c.sha)}
                        aria-label={`Pick commit ${c.sha.slice(0, 7)}`}
                        data-testid={`git-timeline-pick-${c.sha}`}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-mono text-[11px] text-[color:var(--text)]">
                          <span>{c.sha.slice(0, 7)}</span>
                          <span className="text-[color:var(--text-muted)]">
                            {formatDate(c.ts)}
                          </span>
                          <span className="truncate text-[color:var(--text-muted)]">
                            {c.author}
                          </span>
                        </div>
                        <div className="truncate text-[12px] text-[color:var(--text)]">
                          {c.subject}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[color:var(--text-muted)]">
                  {picks.length === 0
                    ? "Pick two commits to diff."
                    : picks.length === 1
                    ? "Pick one more commit."
                    : `Comparing ${picks[0].slice(0, 7)} → ${picks[1].slice(0, 7)}`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowingDiff(true)}
                  disabled={!canShowDiff}
                  aria-disabled={!canShowDiff}
                  data-testid="git-timeline-show-diff"
                  className={
                    "inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs font-medium transition-colors " +
                    (canShowDiff
                      ? "border-[color:var(--accent)] bg-[color:var(--surface-hover)] text-[color:var(--text)] hover:border-[color:var(--accent)]"
                      : "cursor-not-allowed border-[color:var(--border)] text-[color:var(--text-muted)] opacity-60")
                  }
                >
                  Show diff
                </button>
              </div>

              {showingDiff && canShowDiff && (
                <div data-testid="git-timeline-diff-mount">
                  <DiffView
                    path={absFilePath}
                    shaA={shaA}
                    shaB={shaB}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
