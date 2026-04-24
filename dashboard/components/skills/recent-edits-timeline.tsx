import React from "react";
import type { SkillsCommit } from "@/lib/skills/last-updated";
import { groupCommitsByDay } from "@/lib/skills/last-updated";
import { Timestamp } from "@/components/ui/timestamp";

type Props = {
  commits: SkillsCommit[];
  /** Optional GitHub repo slug e.g. "owner/repo" — if set, SHAs link to GitHub. */
  githubSlug?: string;
};

/**
 * RecentEditsTimeline — last 20 commits touching any skill dir, grouped by day.
 *
 * Server component (no "use client"): consumes already-fetched commits passed
 * as props so git-log work stays on the server side.
 *
 * Rendering:
 *   - Day heading = ISO date (YYYY-MM-DD) — precise, not fuzzy.
 *   - Each row: short SHA (link if githubSlug), subject, author, Timestamp.
 *   - When commits is empty, shows a quiet placeholder line.
 */
export function RecentEditsTimeline({ commits, githubSlug }: Props) {
  const groups = groupCommitsByDay(commits);

  return (
    <section
      aria-label="Recent edits"
      data-testid="recent-edits-timeline"
      className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Recent edits</h2>
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          last {commits.length} commits
        </span>
      </header>

      {groups.length === 0 ? (
        <p className="text-xs text-zinc-500" data-testid="recent-edits-empty">
          No recent skill edits found in git history.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {groups.map(({ day, commits: dayCommits }) => (
            <li key={day} data-testid="recent-edits-day" data-day={day}>
              <div className="mb-1 text-[11px] font-mono text-zinc-500">
                {day}
              </div>
              <ul className="flex flex-col gap-1 border-l border-zinc-800 pl-3">
                {dayCommits.map((c) => (
                  <li
                    key={c.fullSha}
                    data-testid="recent-edits-commit"
                    data-sha={c.sha}
                    className="flex items-baseline gap-2"
                  >
                    {githubSlug ? (
                      <a
                        href={`https://github.com/${githubSlug}/commit/${c.fullSha}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-mono text-[11px] text-cyan-400 hover:underline"
                      >
                        {c.sha}
                      </a>
                    ) : (
                      <span className="font-mono text-[11px] text-zinc-500">
                        {c.sha}
                      </span>
                    )}
                    <span className="truncate text-xs text-zinc-200" title={c.subject}>
                      {c.subject}
                    </span>
                    {c.author && (
                      <span className="text-[10px] text-zinc-500">
                        {c.author}
                      </span>
                    )}
                    <Timestamp iso={c.iso} className="ml-auto shrink-0" />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
