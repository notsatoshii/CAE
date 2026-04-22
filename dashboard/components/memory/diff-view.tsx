"use client";

/**
 * Phase 8 Wave 4 (plan 08-06 Task 2, MEM-10): colored diff viewer.
 *
 * Contract:
 *   - Props: { path: string, shaA: string, shaB: string }.
 *   - On mount: POST /api/memory/diff with body { path, sha_a: shaA, sha_b: shaB }
 *     → expects `{ diff: string }` in the response body.
 *   - Line coloring (mono/pre):
 *       +prefix  → green  (text-[color:var(--success)])
 *       -prefix  → red    (text-[color:var(--danger)])
 *       @@       → muted italic (hunk header)
 *       other    → text-muted (context)
 *   - 2000-line render cap; if truncated, renders a `+ N more lines` footer.
 *   - Copy-to-clipboard button emits the FULL untruncated diff (not the
 *     visible subset).
 *
 * Security:
 *   - Every line goes through React as a plain string (server-side diff is
 *     treated as untrusted text). No raw-HTML sinks anywhere in this file.
 *   - No HTML parsing; only prefix-based line coloring.
 *
 * Shared mount location — lives at `components/memory/` root because
 * GitTimelineDrawer (also at `components/memory/`) composes it.
 */

import { useEffect, useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";

export interface DiffViewProps {
  path: string;
  shaA: string;
  shaB: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "ok"; diff: string }
  | { status: "error"; detail?: string };

const LINE_CAP = 2000;

export function DiffView({ path, shaA, shaB }: DiffViewProps) {
  const { dev } = useDevMode();
  const L = labelFor(dev);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        const res = await fetch("/api/memory/diff", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path, sha_a: shaA, sha_b: shaB }),
        });
        if (!res.ok) {
          if (!cancelled) {
            setState({ status: "error", detail: `HTTP ${res.status}` });
          }
          return;
        }
        const data = (await res.json()) as { diff?: string };
        const diff = typeof data.diff === "string" ? data.diff : "";
        if (!cancelled) setState({ status: "ok", diff });
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
  }, [path, shaA, shaB]);

  const { visibleLines, hiddenCount, totalLines } = useMemo(() => {
    if (state.status !== "ok") {
      return { visibleLines: [] as string[], hiddenCount: 0, totalLines: 0 };
    }
    const all = state.diff.split("\n");
    // Drop a trailing empty line introduced by trailing newline in git output.
    const trimmed =
      all.length > 0 && all[all.length - 1] === ""
        ? all.slice(0, -1)
        : all;
    const visible = trimmed.slice(0, LINE_CAP);
    const hidden = Math.max(0, trimmed.length - visible.length);
    return {
      visibleLines: visible,
      hiddenCount: hidden,
      totalLines: trimmed.length,
    };
  }, [state]);

  async function handleCopy() {
    if (state.status !== "ok") return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(state.diff);
        setCopied(true);
        setTimeout(() => setCopied(false), 1_500);
      }
    } catch {
      /* swallow — clipboard rejections aren't actionable in the UI */
    }
  }

  if (state.status === "loading") {
    return (
      <div
        data-testid="diff-loading"
        className="animate-pulse rounded border border-[color:var(--border)] bg-[color:var(--bg)] p-3 text-xs text-[color:var(--text-muted)]"
      >
        Loading diff…
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div
        data-testid="diff-error"
        className="rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] p-3 text-xs text-[color:var(--text)]"
      >
        {L.memoryLoadFailed}
        {dev && state.detail ? ` · ${state.detail}` : ""}
      </div>
    );
  }

  if (visibleLines.length === 0) {
    return (
      <div
        data-testid="diff-empty"
        className="rounded border border-[color:var(--border)] bg-[color:var(--bg)] p-3 text-xs text-[color:var(--text-muted)]"
      >
        No changes between these commits.
      </div>
    );
  }

  return (
    <div
      className="relative rounded border border-[color:var(--border)] bg-[color:var(--bg)]"
      data-testid="diff-view"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-3 py-2">
        <span className="font-mono text-[10px] text-[color:var(--text-muted)]">
          {shaA.slice(0, 7)} → {shaB.slice(0, 7)} · {totalLines} line
          {totalLines === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          data-testid="diff-copy"
          aria-label="Copy diff to clipboard"
          className="inline-flex items-center gap-1 rounded border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="overflow-x-auto p-3 font-mono text-[11px] leading-5"
        data-testid="diff-body"
      >
        {visibleLines.map((line, idx) => (
          <DiffLine key={idx} line={line} />
        ))}
      </pre>
      {hiddenCount > 0 && (
        <div
          data-testid="diff-truncated"
          className="border-t border-[color:var(--border)] px-3 py-1.5 text-[11px] italic text-[color:var(--text-muted)]"
        >
          + {hiddenCount} more line{hiddenCount === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

interface DiffLineProps {
  line: string;
}

function DiffLine({ line }: DiffLineProps) {
  let cls =
    "block whitespace-pre text-[color:var(--text-muted)]";
  if (line.startsWith("+++") || line.startsWith("---")) {
    cls = "block whitespace-pre italic text-[color:var(--text-muted)]";
  } else if (line.startsWith("@@")) {
    cls = "block whitespace-pre italic text-[color:var(--text-muted)]";
  } else if (line.startsWith("+")) {
    cls =
      "block whitespace-pre text-[color:var(--success,#059669)]";
  } else if (line.startsWith("-")) {
    cls =
      "block whitespace-pre text-[color:var(--danger,#dc2626)]";
  }
  return <span className={cls}>{line === "" ? " " : line}</span>;
}
