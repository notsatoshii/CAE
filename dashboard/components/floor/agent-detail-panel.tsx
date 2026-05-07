/**
 * AgentDetailPanel — slide-out panel showing full task execution details.
 *
 * Displays:
 * - Task ID + status badge
 * - Summary from DONE.md frontmatter
 * - Timestamps (started_at, finished_at)
 * - Tool timeline (extracted from circuit-breaker)
 * - Links to commits
 */

"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

export interface AgentDetailPanelProps {
  taskId: string;
  open: boolean;
  onClose: () => void;
}

interface DoneMetadata {
  status: "success" | "failed" | "working";
  started_at?: string;
  finished_at?: string;
  summary?: string;
  commits?: string[];
}

/**
 * Simple YAML frontmatter parser for DONE.md.
 * Expects format:
 * ---
 * field: value
 * ---
 */
function parseDoneFrontmatter(content: string): DoneMetadata | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const fm = match[1];
  const result: DoneMetadata = { status: "working" };

  for (const line of fm.split("\n")) {
    const [key, ...valueParts] = line.split(":").map((s) => s.trim());
    const value = valueParts.join(":").trim();

    if (key === "status") {
      result.status = (value as "success" | "failed" | "working") || "working";
    } else if (key === "started_at") {
      result.started_at = value;
    } else if (key === "finished_at") {
      result.finished_at = value;
    } else if (key === "summary") {
      result.summary = value.replace(/^["']|["']$/g, "");
    } else if (key === "commits") {
      // commits might be a list or space-separated values
      result.commits = [value];
    }
  }

  return result;
}

/** Format ISO8601 timestamp to readable format. */
function formatTimestamp(isoStr: string | undefined): string {
  if (!isoStr) return "—";
  try {
    const date = new Date(isoStr);
    return date.toLocaleString();
  } catch {
    return isoStr;
  }
}

export function AgentDetailPanel({
  taskId,
  open,
  onClose,
}: AgentDetailPanelProps) {
  const [metadata, setMetadata] = useState<DoneMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !taskId) {
      setMetadata(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const resp = await fetch(`/api/outbox/${taskId}/done`);
        if (!resp.ok) {
          setError(
            resp.status === 404
              ? "Task not found"
              : "Failed to load task details"
          );
          setMetadata(null);
          return;
        }

        const content = await resp.text();
        const parsed = parseDoneFrontmatter(content);

        if (!parsed) {
          setError("Unable to parse task metadata");
          setMetadata(null);
        } else {
          setMetadata(parsed);
          setError(null);
        }
      } catch (err) {
        setError(String(err) || "Unknown error");
        setMetadata(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, taskId]);

  if (!open) return null;

  const statusColor =
    metadata?.status === "success"
      ? "text-[color:var(--success)]"
      : metadata?.status === "failed"
        ? "text-[color:var(--danger)]"
        : "text-[color:var(--accent)]";

  const statusEmoji =
    metadata?.status === "success"
      ? "✓"
      : metadata?.status === "failed"
        ? "✗"
        : "⏳";

  return (
    <div className="fixed inset-y-0 right-0 w-96 max-w-full z-50 bg-[color:var(--surface)] border-l border-[color:var(--border-subtle)] shadow-elevation-3 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[color:var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${statusColor}`}>
            {statusEmoji}
          </span>
          <h3 className="font-mono text-sm font-semibold">{taskId}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[color:var(--border-subtle)] rounded"
          aria-label="Close detail panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="text-sm text-[color:var(--text-muted)]">
            Loading task details...
          </div>
        )}

        {error && (
          <div className="text-sm text-[color:var(--danger)]">{error}</div>
        )}

        {metadata && !loading && !error && (
          <>
            {/* Summary */}
            {metadata.summary && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-[color:var(--text-muted)] mb-1">
                  Summary
                </h4>
                <p className="text-sm text-[color:var(--text)]">
                  {metadata.summary}
                </p>
              </div>
            )}

            {/* Timestamps */}
            <div>
              <h4 className="text-xs font-semibold uppercase text-[color:var(--text-muted)] mb-1">
                Execution
              </h4>
              <div className="text-xs space-y-1 text-[color:var(--text)]">
                <div>
                  <span className="text-[color:var(--text-muted)]">
                    Started:{" "}
                  </span>
                  {formatTimestamp(metadata.started_at)}
                </div>
                <div>
                  <span className="text-[color:var(--text-muted)]">
                    Finished:{" "}
                  </span>
                  {formatTimestamp(metadata.finished_at)}
                </div>
              </div>
            </div>

            {/* Commits */}
            {metadata.commits && metadata.commits.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-[color:var(--text-muted)] mb-1">
                  Commits
                </h4>
                <div className="space-y-1">
                  {metadata.commits.map((commit, idx) => (
                    <a
                      key={idx}
                      href={commit}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[color:var(--accent)] hover:underline break-all"
                    >
                      {commit}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Tool timeline (placeholder) */}
            <div>
              <h4 className="text-xs font-semibold uppercase text-[color:var(--text-muted)] mb-1">
                Tools
              </h4>
              <p className="text-xs text-[color:var(--text-muted)]">
                Tool timeline integration coming soon
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
