"use client";

/**
 * Phase 8 Wave 3 (plan 08-04) — MarkdownView.
 *
 * Fetches `/api/memory/file/<encoded-abs-path>` for the provided `absPath`
 * and renders the markdown body via `react-markdown` + `remark-gfm`
 * (versions locked by D-09: react-markdown@10.1.0, remark-gfm@4.0.1).
 *
 * State machine (mutually exclusive):
 *  - `idle`       — no `absPath` supplied yet; prompts the user to pick a file.
 *  - `loading`    — fetch in flight for the current `absPath`.
 *  - `loaded`     — response 200; `contents` available.
 *  - `not_found`  — response 404; renders founder/dev-aware "file gone" copy.
 *  - `forbidden`  — response 403; file sits outside the memory allowlist.
 *  - `error`      — network failure or any other non-OK status.
 *
 * Hand-rolled typography (per plan — no Tailwind typography plugin):
 *  - `prose`-style paragraph line-height via inline utility classes inside
 *    the `components` map passed to `ReactMarkdown`. Covers h1/h2/h3, p,
 *    code inline/block, ul/ol/li, blockquote, a, hr, table. All sizes use
 *    the project's dense→detail rhythm (14-16px body, 22/20/16 headings).
 *
 * Constraints honoured (plan 08-04 Task 1.E):
 *  - Starts with `"use client"`.
 *  - base-ui polymorphic render is not used (AGENTS.md p2-plA-t1-e81f6c).
 *  - Physical isolation from the sibling graph tab plan (08-05) — no
 *    cross-subdir imports in either direction.
 *  - All copy via `labels = labelFor(dev)`.
 *  - Title row exposes a Git-timeline hook (`onOpenGitTimeline`) that the
 *    page shell wires up in Wave 5; when the prop is absent the button is
 *    hidden, matching BrowsePane's default behaviour.
 */

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GitCommitVertical } from "lucide-react";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";

export interface MarkdownViewProps {
  absPath: string | null;
  onOpenGitTimeline?: (absPath: string) => void;
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; contents: string; size: number }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "error"; detail?: string };

async function fetchMemoryFile(absPath: string): Promise<LoadState> {
  const url = `/api/memory/file/${encodeMemoryPath(absPath)}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (err) {
    return {
      status: "error",
      detail: err instanceof Error ? err.message : "network failure",
    };
  }
  if (res.status === 404) return { status: "not_found" };
  if (res.status === 403) return { status: "forbidden" };
  if (!res.ok) return { status: "error", detail: `HTTP ${res.status}` };
  const data = (await res.json()) as { contents: string; size: number };
  return { status: "loaded", contents: data.contents, size: data.size };
}

// The server's catchall route consumes segments joined by `/`. Absolute
// paths start with a leading `/` which becomes an empty first segment —
// encoded as `` so the route still matches. Each path segment is
// individually `encodeURIComponent`'d so rare chars (spaces, parens) survive.
function encodeMemoryPath(abs: string): string {
  return abs
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

export function MarkdownView({ absPath, onOpenGitTimeline }: MarkdownViewProps) {
  const { dev } = useDevMode();
  const labels = labelFor(dev);
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!absPath) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    void fetchMemoryFile(absPath).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [absPath]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <MarkdownViewHeader
        absPath={absPath}
        showRaw={showRaw}
        onToggleRaw={() => setShowRaw((v) => !v)}
        onOpenGitTimeline={onOpenGitTimeline}
      />
      <div className="min-h-0 flex-1 overflow-auto px-7 py-6 text-[14px] leading-7 text-[color:var(--text)]">
        {state.status === "idle" && (
          <div
            data-testid="md-empty"
            className="text-[13px] text-[color:var(--text-muted)]"
          >
            Pick a file from the left to read it.
          </div>
        )}
        {state.status === "loading" && (
          <div
            data-testid="md-loading"
            className="animate-pulse text-[13px] text-[color:var(--text-muted)]"
          >
            Loading…
          </div>
        )}
        {state.status === "not_found" && (
          <div
            data-testid="md-not-found"
            className="text-[13px] text-[color:var(--text-muted)]"
          >
            {labels.memoryFileNotFound}
          </div>
        )}
        {state.status === "forbidden" && (
          <div
            data-testid="md-forbidden"
            className="text-[13px] text-[color:var(--text-muted)]"
          >
            {dev
              ? "Not a memory source (allowlist reject)"
              : "Not a memory source"}
          </div>
        )}
        {state.status === "error" && (
          <div
            data-testid="md-error"
            className="text-[13px] text-[color:var(--text-muted)]"
          >
            {labels.memoryLoadFailed}
            {dev && state.detail ? ` · ${state.detail}` : ""}
          </div>
        )}
        {state.status === "loaded" &&
          (showRaw ? (
            <pre className="whitespace-pre-wrap break-words font-mono text-[12px] text-[color:var(--text)]">
              {state.contents}
            </pre>
          ) : (
            <article
              data-testid="md-article"
              className="max-w-[72ch] text-[color:var(--text)]"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={MARKDOWN_COMPONENTS}
              >
                {state.contents}
              </ReactMarkdown>
            </article>
          ))}
      </div>
    </div>
  );
}

interface MarkdownViewHeaderProps {
  absPath: string | null;
  showRaw: boolean;
  onToggleRaw: () => void;
  onOpenGitTimeline?: (absPath: string) => void;
}

function MarkdownViewHeader({
  absPath,
  showRaw,
  onToggleRaw,
  onOpenGitTimeline,
}: MarkdownViewHeaderProps) {
  const { dev } = useDevMode();
  const labels = labelFor(dev);
  return (
    <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-2.5">
      <div className="truncate font-mono text-[11px] text-[color:var(--text-muted)]">
        {absPath ?? "—"}
      </div>
      <div className="flex items-center gap-1.5">
        {absPath && onOpenGitTimeline && (
          <button
            type="button"
            onClick={() => onOpenGitTimeline(absPath)}
            className="inline-flex items-center gap-1 rounded-sm border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface)] hover:text-[color:var(--text)]"
          >
            <GitCommitVertical className="size-3" aria-hidden="true" />
            <span>{labels.memoryLabelTimeline}</span>
          </button>
        )}
        {absPath && (
          <button
            type="button"
            onClick={onToggleRaw}
            className="rounded-sm border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface)] hover:text-[color:var(--text)]"
            data-testid="md-toggle-raw"
          >
            {showRaw ? "rendered" : "raw"}
          </button>
        )}
      </div>
    </div>
  );
}

// ---- hand-rolled markdown typography ---------------------------------------
// Each component keeps base-ui / prose-plugin out of the picture. All colour
// tokens come from the dashboard's CSS variables so themes flow through.

const MARKDOWN_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children, ...rest }) => (
    <h1
      className="mb-4 mt-2 text-[22px] font-semibold tracking-tight text-[color:var(--text)]"
      {...rest}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...rest }) => (
    <h2
      className="mb-3 mt-6 text-[18px] font-semibold text-[color:var(--text)]"
      {...rest}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...rest }) => (
    <h3
      className="mb-2 mt-5 text-[15px] font-semibold text-[color:var(--text)]"
      {...rest}
    >
      {children}
    </h3>
  ),
  p: ({ children, ...rest }) => (
    <p className="mb-3 text-[14px] leading-7" {...rest}>
      {children}
    </p>
  ),
  a: ({ children, href, ...rest }) => (
    <a
      href={href}
      className="text-[color:var(--accent)] underline-offset-2 hover:underline"
      {...rest}
    >
      {children}
    </a>
  ),
  ul: ({ children, ...rest }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1 text-[14px]" {...rest}>
      {children}
    </ul>
  ),
  ol: ({ children, ...rest }) => (
    <ol className="mb-3 ml-5 list-decimal space-y-1 text-[14px]" {...rest}>
      {children}
    </ol>
  ),
  li: ({ children, ...rest }) => (
    <li className="leading-6" {...rest}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...rest }) => (
    <blockquote
      className="mb-3 border-l-2 border-[color:var(--border)] pl-3 text-[13px] italic text-[color:var(--text-muted)]"
      {...rest}
    >
      {children}
    </blockquote>
  ),
  code: ({ children, className, ...rest }) => {
    const isBlock = typeof className === "string" && className.includes("language-");
    if (isBlock) {
      return (
        <code
          className="font-mono text-[12px] leading-5 text-[color:var(--text)]"
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-sm bg-[color:var(--surface)] px-1 py-0.5 font-mono text-[12px] text-[color:var(--text)]"
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...rest }) => (
    <pre
      className="mb-3 overflow-x-auto rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-3 font-mono text-[12px] leading-5"
      {...rest}
    >
      {children}
    </pre>
  ),
  hr: (props) => (
    <hr className="my-5 border-[color:var(--border)]" {...props} />
  ),
  table: ({ children, ...rest }) => (
    <div className="mb-3 overflow-x-auto">
      <table
        className="w-full border-collapse text-[12px]"
        {...rest}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...rest }) => (
    <th
      className="border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-left font-medium"
      {...rest}
    >
      {children}
    </th>
  ),
  td: ({ children, ...rest }) => (
    <td
      className="border border-[color:var(--border)] px-2 py-1 align-top"
      {...rest}
    >
      {children}
    </td>
  ),
};
