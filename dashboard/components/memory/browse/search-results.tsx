"use client";

/**
 * Phase 8 Wave 3 (plan 08-04 Task 2) — SearchResults.
 *
 * Grouped ripgrep hit display for the Browse tab's search panel.
 *
 * Behaviour:
 *   - `q === ""` → renders null. The search panel is hidden until the user
 *     types something.
 *   - `q.length > 0` + `hits.length === 0` → shows `"No matches for \"<q>\""`
 *     in muted text.
 *   - Otherwise groups hits by `file`, rendering a clickable file header
 *     followed by the first 3 matching lines (4+ → "+N more" text).
 *   - Matches inside each preview are highlighted in the accent colour.
 *   - Clicking a file header fires `onSelectFile(absPath)` — BrowsePane
 *     pipes that through its local state so the FileTree reflects the
 *     same path via `selectedPath`.
 *
 * Dense typography: 12px mono, 8-10px row padding, consistent with the
 * left-column rhythm the FileTree uses.
 */

import type { SearchHit } from "@/lib/cae-memory-search";

export interface SearchResultsProps {
  hits: SearchHit[];
  q: string;
  onSelectFile: (absPath: string) => void;
}

const MAX_HITS_PER_FILE = 3;

function groupByFile(hits: SearchHit[]): Map<string, SearchHit[]> {
  const out = new Map<string, SearchHit[]>();
  for (const h of hits) {
    const bucket = out.get(h.file) ?? [];
    bucket.push(h);
    out.set(h.file, bucket);
  }
  return out;
}

function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i < 0 ? p : p.slice(i + 1);
}

// Case-insensitive highlighter — splits the preview around the query
// substring and wraps matches in a cyan <mark>. Safe for arbitrary user
// input because we never interpret `q` as a regex.
function renderPreview(preview: string, q: string): React.ReactNode {
  if (q.length === 0) return preview;
  const lower = preview.toLowerCase();
  const needle = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let idx = lower.indexOf(needle, cursor);
  let key = 0;
  while (idx !== -1) {
    if (idx > cursor) parts.push(preview.slice(cursor, idx));
    parts.push(
      <mark
        key={key++}
        className="bg-transparent text-[color:var(--accent)]"
      >
        {preview.slice(idx, idx + needle.length)}
      </mark>,
    );
    cursor = idx + needle.length;
    idx = lower.indexOf(needle, cursor);
  }
  if (cursor < preview.length) parts.push(preview.slice(cursor));
  return parts;
}

export function SearchResults({ hits, q, onSelectFile }: SearchResultsProps) {
  if (q.length === 0) return null;

  if (hits.length === 0) {
    return (
      <div
        className="border-b border-[color:var(--border)] px-3 py-3 text-[12px] text-[color:var(--text-muted)]"
        data-testid="search-no-matches"
      >
        No matches for &quot;{q}&quot;
      </div>
    );
  }

  const grouped = groupByFile(hits);
  return (
    <div
      className="border-b border-[color:var(--border)] bg-[color:var(--bg)]"
      data-testid="search-results"
    >
      {Array.from(grouped.entries()).map(([file, fileHits]) => {
        const visible = fileHits.slice(0, MAX_HITS_PER_FILE);
        const extra = fileHits.length - visible.length;
        return (
          <div
            key={file}
            data-testid={`search-file-${file}`}
            className="border-b border-[color:var(--border)] last:border-b-0"
          >
            <button
              type="button"
              onClick={() => onSelectFile(file)}
              className="w-full truncate px-3 py-1.5 text-left font-mono text-[12px] text-[color:var(--text)] transition-colors hover:bg-[color:var(--surface)]"
              title={file}
              data-testid={`search-file-header-${file}`}
            >
              {basename(file)}
            </button>
            <ul className="pb-1.5">
              {visible.map((hit, i) => (
                <li
                  key={`${file}:${hit.line}:${i}`}
                  className="px-3 py-[3px] font-mono text-[11px] leading-snug text-[color:var(--text-muted)]"
                >
                  <span className="mr-1.5 text-[color:var(--text-muted)] opacity-60">
                    {hit.line}
                  </span>
                  <span className="text-[color:var(--text)]">
                    {renderPreview(hit.preview, q)}
                  </span>
                </li>
              ))}
              {extra > 0 && (
                <li
                  className="px-3 py-[3px] font-mono text-[10px] text-[color:var(--text-muted)]"
                  data-testid={`search-more-${file}`}
                >
                  +{extra} more
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
