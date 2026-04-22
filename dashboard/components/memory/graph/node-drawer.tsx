"use client";

/**
 * Phase 8 Wave 3 (MEM-07): slide-in drawer for a clicked graph node.
 *
 * Shows label + kind pill + source file + back-links (links where
 * `target === node.id`) + forward-refs (links where `source === node.id`)
 * + an "open git timeline" stub that is wired in Wave 5.
 *
 * Behavior:
 *   - When `node === null` nothing is rendered (drawer is "closed").
 *   - ESC key closes (calls `onClose`).
 *   - Click-outside closes (overlay catches pointer).
 *   - Focus trap is light-weight: on open we move focus into the drawer;
 *     on close we do not restore (caller owns the trigger).
 *
 * Back-links list items are clickable but currently no-op (Wave 6 wires
 * tab-switch to Browse). Forward-refs render identically. Source file is
 * mono-styled and copy-on-click.
 */

import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";
import type { GraphLink, GraphNode, NodeKind } from "@/lib/cae-graph-state";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor as labelsFor } from "@/lib/copy/labels";

interface NodeDrawerProps {
  node: GraphNode | null;
  links: GraphLink[];
  onClose: () => void;
  onOpenGitTimeline?: (absPath: string) => void;
}

const KIND_BADGE_COLOR: Record<NodeKind, string> = {
  phases: "var(--accent)",
  agents: "var(--accent-muted)",
  notes: "var(--border-strong)",
  PRDs: "var(--success)",
};

function basename(abs: string): string {
  const i = abs.lastIndexOf("/");
  return i < 0 ? abs : abs.slice(i + 1);
}

export function NodeDrawer({
  node,
  links,
  onClose,
  onOpenGitTimeline,
}: NodeDrawerProps) {
  const { dev } = useDevMode();
  const L = labelsFor(dev);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // ESC to close.
  useEffect(() => {
    if (!node) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [node, onClose]);

  // Light focus move on open.
  useEffect(() => {
    if (node && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [node]);

  const { backLinks, forwardRefs } = useMemo(() => {
    if (!node) return { backLinks: [] as GraphLink[], forwardRefs: [] as GraphLink[] };
    const back: GraphLink[] = [];
    const fwd: GraphLink[] = [];
    for (const l of links) {
      if (l.target === node.id) back.push(l);
      if (l.source === node.id) fwd.push(l);
    }
    return { backLinks: back, forwardRefs: fwd };
  }, [node, links]);

  if (!node) return null;

  const title = L.memoryNodeDrawerHeading(node.label ?? basename(node.id));

  return (
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="memory-node-drawer"
    >
      {/* Backdrop — click to close. */}
      <button
        type="button"
        aria-label="Close drawer backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        tabIndex={-1}
      />

      {/* Drawer panel — slides in from right. */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full w-full max-w-md translate-x-0 flex-col overflow-y-auto border-l border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-xl transition-transform duration-200 focus:outline-none"
      >
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--text)]"
              style={{
                border: "1px solid " + KIND_BADGE_COLOR[node.kind],
              }}
              data-testid="node-drawer-kind-badge"
            >
              {node.kind}
            </span>
            <h2
              className="truncate text-sm font-medium text-[color:var(--text)]"
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
            data-testid="node-drawer-close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Source file */}
        <section className="mb-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
            Source file
          </h3>
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                void navigator.clipboard.writeText(node.source_file).catch(() => {});
              }
            }}
            className="block w-full truncate rounded border border-[color:var(--border)] bg-[color:var(--bg)] px-2 py-1.5 text-left font-mono text-[11px] text-[color:var(--text)] hover:border-[color:var(--accent)]"
            title="Click to copy path"
          >
            {node.source_file}
          </button>
        </section>

        {/* Back-links */}
        <section className="mb-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
            {L.memoryLabelBackLinks} ({backLinks.length})
          </h3>
          {backLinks.length === 0 ? (
            <p className="text-xs text-[color:var(--text-dim)]">—</p>
          ) : (
            <ul className="space-y-1" data-testid="node-drawer-backlinks">
              {backLinks.map((l, idx) => (
                <li key={l.source + "->" + l.target + "#" + idx}>
                  <button
                    type="button"
                    className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] text-[color:var(--text)] hover:bg-[color:var(--surface-hover)]"
                    title={l.source}
                  >
                    {basename(l.source)}
                    <span className="ml-2 text-[color:var(--text-dim)]">
                      {l.relation}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Forward refs */}
        <section className="mb-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
            References ({forwardRefs.length})
          </h3>
          {forwardRefs.length === 0 ? (
            <p className="text-xs text-[color:var(--text-dim)]">—</p>
          ) : (
            <ul className="space-y-1" data-testid="node-drawer-forwardrefs">
              {forwardRefs.map((l, idx) => (
                <li key={l.source + "->" + l.target + "#" + idx}>
                  <button
                    type="button"
                    className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] text-[color:var(--text)] hover:bg-[color:var(--surface-hover)]"
                    title={l.target}
                  >
                    {basename(l.target)}
                    <span className="ml-2 text-[color:var(--text-dim)]">
                      {l.relation}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Open git timeline — Wave 5 wires this. */}
        {onOpenGitTimeline ? (
          <section>
            <button
              type="button"
              onClick={() => onOpenGitTimeline(node.source_file)}
              className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] px-3 py-2 text-xs font-medium text-[color:var(--text)] hover:border-[color:var(--accent)]"
              data-testid="node-drawer-open-timeline"
            >
              {L.memoryLabelTimeline}
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
