"use client";

/**
 * Phase 8 Wave 4 (MEM-09, D-03): "Why?" drawer — traces which memory
 * entries CAE actually read during a given task.
 *
 * Decision ladder (D-03):
 *   Path A — REAL trace:    GET /api/memory/consult/[task_id] → found:true →
 *                           live-trace list with `memoryWhyLiveTracePill`.
 *   Path B — HEURISTIC:     found:false AND caller supplied non-empty
 *                           `filesModified` → `getHeuristicWhyTrace` intersect
 *                           with the D-10 memory source allowlist → heuristic
 *                           list with `memoryWhyHeuristicPill`.
 *   Path C — EMPTY:         found:false AND (no filesModified OR heuristic
 *                           returned zero entries) → `memoryWhyEmpty` copy.
 *
 * Error path: any non-200 response (network / 500 / bad JSON) renders the
 * `memoryLoadFailed` banner below the list region.
 *
 * Shared mount point (D-16): this drawer lives at `components/memory/` root
 * (NOT in browse/ or graph/ subdirs) because Wave 5's MemoryClient will
 * mount it ONCE and surface it from either tab.
 *
 * A11y:
 *   - role="dialog" + aria-modal="true" on the overlay.
 *   - Focus moves into the drawer on open.
 *   - ESC key closes (window-level keydown listener, only while open).
 *   - Backdrop click closes (button overlay absorbs the pointer).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";
import type { MemoryConsultResult } from "@/lib/cae-memory-consult";
// 08-07 Wave 5 fix (Rule 3 — blocking build): `cae-memory-whytrace` imports
// `cae-memory-sources` which pulls `node:fs/promises`, breaking the client
// bundle when MemoryClient (Wave 5) mounts this drawer in a live route.
// The pattern-match check is pure, so we use the client-safe extract that
// lives alongside it (same D-10 regex set, no server-only imports).
import {
  getHeuristicWhyTraceClient as getHeuristicWhyTrace,
  type HeuristicWhyEntry,
} from "@/lib/cae-memory-path-match";

export interface WhyDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Null while no task is selected — drawer renders nothing. */
  taskId: string | null;
  /** Optional; when provided AND the real-trace API returns found:false, powers the heuristic fallback. */
  filesModified?: string[];
  /** Optional callback used by Wave-5 MemoryClient to switch to Browse tab on row click. */
  onSelectFile?: (absPath: string) => void;
}

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; result: MemoryConsultResult }
  | { status: "error"; detail?: string };

function basename(abs: string): string {
  const i = abs.lastIndexOf("/");
  return i < 0 ? abs : abs.slice(i + 1);
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export function WhyDrawer({
  open,
  onClose,
  taskId,
  filesModified,
  onSelectFile,
}: WhyDrawerProps) {
  const { dev } = useDevMode();
  const L = labelFor(dev);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<FetchState>({ status: "idle" });

  // Fetch real-trace on open + taskId change. Cancel on cleanup.
  useEffect(() => {
    if (!open || !taskId) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    const url = `/api/memory/consult/${encodeURIComponent(taskId)}`;
    (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setState({ status: "error", detail: `HTTP ${res.status}` });
          }
          return;
        }
        const data = (await res.json()) as MemoryConsultResult;
        if (!cancelled) setState({ status: "ok", result: data });
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
  }, [open, taskId]);

  // ESC to close while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Move focus into the drawer when it opens.
  useEffect(() => {
    if (open && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [open]);

  // Compute heuristic fallback (pure, synchronous). Only consumed when the
  // real-trace API says `found:false`.
  const heuristic: HeuristicWhyEntry[] = useMemo(
    () => getHeuristicWhyTrace(filesModified),
    [filesModified],
  );

  if (!open || !taskId) return null;

  const headingId = "why-drawer-heading";
  const title = `Why? · task ${taskId}`;

  // Determine which render path applies (Path A / B / C / error).
  let renderPath: "loading" | "live" | "heuristic" | "empty" | "error" = "loading";
  if (state.status === "error") renderPath = "error";
  else if (state.status === "ok") {
    if (state.result.found && state.result.entries.length > 0) {
      renderPath = "live";
    } else if (heuristic.length > 0) {
      renderPath = "heuristic";
    } else {
      renderPath = "empty";
    }
  }

  return (
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      data-testid="memory-why-drawer"
    >
      {/* Backdrop — click to close. */}
      <button
        type="button"
        aria-label="Close drawer backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        tabIndex={-1}
        data-testid="why-drawer-backdrop"
      />

      {/* Drawer panel — slides in from right (matches NodeDrawer visual). */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full w-full max-w-md translate-x-0 flex-col overflow-y-auto border-l border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-xl transition-transform duration-200 focus:outline-none"
      >
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2
              id={headingId}
              className="truncate text-[15px] font-semibold text-[color:var(--text)]"
              title={title}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={L.sheetCloseLabel}
            className="rounded p-1 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
            data-testid="why-drawer-close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Explain copy */}
        <p className="mb-3 text-[11px] text-[color:var(--text-muted)]">
          {L.memoryExplainWhy}
        </p>

        {/* Body — decision ladder. */}
        <div className="min-h-0 flex-1">
          {renderPath === "loading" && (
            <div
              data-testid="why-drawer-loading"
              className="animate-pulse text-xs text-[color:var(--text-muted)]"
            >
              Loading…
            </div>
          )}

          {renderPath === "live" && state.status === "ok" && (
            <LiveTraceList
              entries={state.result.entries}
              pillLabel={L.memoryWhyLiveTracePill}
              onSelectFile={onSelectFile}
            />
          )}

          {renderPath === "heuristic" && (
            <HeuristicList
              entries={heuristic}
              pillLabel={L.memoryWhyHeuristicPill}
              onSelectFile={onSelectFile}
              dev={dev}
            />
          )}

          {renderPath === "empty" && (
            <div
              data-testid="why-drawer-empty"
              className="py-8 text-center text-xs text-[color:var(--text-muted)]"
            >
              {L.memoryWhyEmpty}
            </div>
          )}

          {renderPath === "error" && (
            <div
              data-testid="why-drawer-error"
              className="rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-3 text-xs text-[color:var(--text)]"
            >
              {L.memoryLoadFailed}
              {dev && state.status === "error" && state.detail ? ` · ${state.detail}` : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface LiveTraceListProps {
  entries: MemoryConsultResult["entries"];
  pillLabel: string;
  onSelectFile?: (absPath: string) => void;
}

function LiveTraceList({
  entries,
  pillLabel,
  onSelectFile,
}: LiveTraceListProps) {
  // Sort ascending by ts (the aggregator already does this, but we defend).
  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) =>
        a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0,
      ),
    [entries],
  );

  return (
    <div data-testid="why-drawer-live">
      <Pill
        label={pillLabel}
        tone="live"
        testid="why-drawer-pill-live"
      />
      <ul className="mt-3 space-y-2" data-testid="why-drawer-entries-live">
        {sorted.map((e, idx) => (
          <li
            key={`${e.source_path}#${e.ts}#${idx}`}
            className="rounded border border-[color:var(--border)] bg-[color:var(--bg)] p-2"
          >
            <button
              type="button"
              onClick={() => onSelectFile?.(e.source_path)}
              className="block w-full text-left"
              title={e.source_path}
            >
              <div className="truncate text-[12px] font-medium text-[color:var(--text)]">
                {basename(e.source_path)}
              </div>
              <div className="truncate font-mono text-[10px] text-[color:var(--text-muted)]">
                {e.source_path}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-[color:var(--text-muted)]">
                {formatTs(e.ts)}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface HeuristicListProps {
  entries: HeuristicWhyEntry[];
  pillLabel: string;
  onSelectFile?: (absPath: string) => void;
  dev: boolean;
}

function HeuristicList({
  entries,
  pillLabel,
  onSelectFile,
  dev,
}: HeuristicListProps) {
  return (
    <div data-testid="why-drawer-heuristic">
      <Pill
        label={pillLabel}
        tone="heuristic"
        testid="why-drawer-pill-heuristic"
      />
      <ul className="mt-3 space-y-2" data-testid="why-drawer-entries-heuristic">
        {entries.map((e, idx) => (
          <li
            key={`${e.source_path}#${idx}`}
            className="rounded border border-[color:var(--border)] bg-[color:var(--bg)] p-2"
          >
            <button
              type="button"
              onClick={() => onSelectFile?.(e.source_path)}
              className="block w-full text-left"
              title={e.source_path}
            >
              <div className="truncate text-[12px] font-medium text-[color:var(--text)]">
                {basename(e.source_path)}
              </div>
              <div className="truncate font-mono text-[10px] text-[color:var(--text-muted)]">
                {e.source_path}
              </div>
              {dev && (
                <div className="mt-0.5 font-mono text-[10px] text-[color:var(--text-muted)]">
                  basis: {e.basis}
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>
      {dev && (
        <p className="mt-3 text-[10px] italic text-[color:var(--text-muted)]">
          Install the PostToolUse hook to capture real traces (docs/memory-hook.md).
        </p>
      )}
    </div>
  );
}

interface PillProps {
  label: string;
  tone: "live" | "heuristic";
  testid: string;
}

function Pill({ label, tone, testid }: PillProps) {
  const color =
    tone === "live"
      ? "border-[color:var(--accent)] text-[color:var(--accent)]"
      : "border-[color:var(--warning,#d97706)] text-[color:var(--warning,#d97706)]";
  return (
    <span
      data-testid={testid}
      className={
        "inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider " +
        color
      }
    >
      {label}
    </span>
  );
}
