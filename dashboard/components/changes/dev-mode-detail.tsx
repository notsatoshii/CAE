"use client";

/**
 * Phase 9 Wave 2 (plan 09-04) — DevModeDetail.
 *
 * Expanded technical detail for a single ChangeEvent. Rendered inside
 * ChangeRow when the user flips the "technical" toggle (or when
 * Dev-mode/useDevMode is true — ChangeRow owns the open/close state).
 *
 * Shows:
 *   - branch (if non-null)
 *   - sha (short)
 *   - agent + model (if agent non-null)
 *   - tokens (if tokens non-null — never 0-as-null per 09-02 contract)
 *   - per-commit list (shaShort · subject) with full sha in `title`
 *   - GitHub URL (if non-null; never `#` fallback — gotcha #14)
 *
 * Pure presentational. No fetch, no state beyond useDevMode for label
 * branching (changesDev* keys branch founder↔dev phrasing per D-14).
 */

import Link from "next/link";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import type { ChangeEvent } from "@/lib/cae-changes-state";

export function DevModeDetail({ event }: { event: ChangeEvent }) {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  return (
    <div
      data-testid="dev-mode-detail"
      className="mt-2 space-y-1 rounded-md border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)] p-3 font-mono text-xs text-[color:var(--text-muted,#8a8a8c)]"
    >
      {event.branch ? <div>{L.changesDevBranchLabel(event.branch)}</div> : null}
      <div>{L.changesDevShaLabel(event.shaShort)}</div>
      {event.agent ? (
        <div>{L.changesDevAgentLabel(event.agent, event.model ?? null)}</div>
      ) : null}
      {event.tokens != null ? (
        <div>{L.changesDevTokensLabel(event.tokens)}</div>
      ) : null}
      {event.commits.length > 0 ? (
        <div className="pt-1">
          <div className="text-[color:var(--text-muted,#8a8a8c)]">
            {L.changesDevCommitsHeading(event.commits.length)}
          </div>
          <ul className="list-inside list-disc space-y-0.5">
            {event.commits.map((c) => (
              <li key={c.sha} title={c.sha}>
                {c.shaShort} · {c.subject}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {event.githubUrl ? (
        <div className="pt-1">
          <Link
            href={event.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[color:var(--accent,#00d4ff)] underline underline-offset-2"
          >
            {L.changesDevGithubLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
