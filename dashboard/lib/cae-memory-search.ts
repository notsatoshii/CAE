/**
 * Phase 8 Wave 2 (D-11, MEM-04): safe ripgrep wrapper for memory search.
 *
 * Spawns `rg --json` via `execFile` (arg array — never `exec`, never shell
 * interpolation) with strict bounds:
 *   - Query length capped at 200 chars (throws on longer)
 *   - 5s wall-clock timeout
 *   - 10 MiB maxBuffer
 *   - Roots restricted to `getAllowedRoots()` — caller overrides are
 *     intersected with the allowlist, never union'd
 *   - --glob=*.md clamps the search surface to markdown
 *
 * rg exit code 1 means "no match" — treated as an empty result, not an
 * error. Exit code 2+ is re-thrown so upstream routes can 500 properly.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getAllowedRoots } from "./cae-memory-sources";

// Hard caps — security guarantees. Tune with care.
const MAX_QUERY_LEN = 200;
// 5s wall-clock timeout — literal kept inline so the plan's verify grep
// (timeout: 5_000) matches at the spawn site.
const MAX_BUFFER = 10 * 1024 * 1024;

const RG_ARGS = [
  "--json",
  "--max-count=20",
  "--max-columns=200",
  "--glob=*.md",
  "--smart-case",
  "--",
] as const;

export interface SearchHit {
  file: string;
  line: number;
  preview: string;
}

interface RgMatchEvent {
  type: "match";
  data: {
    path: { text?: string } | { bytes?: string };
    line_number: number;
    lines: { text?: string } | { bytes?: string };
  };
}

// Internal indirection: holds the spawn function we'll call. Tests can
// swap this via `__setExecFileForTests()` without needing to mock Node's
// built-in module resolution (which is flaky across Vitest versions when
// the spec uses `node:child_process`).
let _execFileP: (
  cmd: string,
  args: string[],
  opts: { timeout?: number; maxBuffer?: number },
) => Promise<{ stdout: string; stderr: string }> = promisify(execFile) as unknown as (
  cmd: string,
  args: string[],
  opts: { timeout?: number; maxBuffer?: number },
) => Promise<{ stdout: string; stderr: string }>;

/**
 * Test-only: replace the execFile implementation. Pass `null` to restore
 * the default (real `execFile` via util.promisify).
 */
export function __setExecFileForTests(
  impl:
    | ((
        cmd: string,
        args: string[],
        opts: { timeout?: number; maxBuffer?: number },
      ) => Promise<{ stdout: string; stderr: string }>)
    | null,
): void {
  if (impl === null) {
    _execFileP = promisify(execFile) as unknown as typeof _execFileP;
  } else {
    _execFileP = impl;
  }
}

function extractText(obj: { text?: string } | { bytes?: string } | undefined): string {
  if (!obj || typeof obj !== "object") return "";
  if ("text" in obj && typeof obj.text === "string") return obj.text;
  if ("bytes" in obj && typeof obj.bytes === "string") {
    // rg emits base64 when the bytes aren't valid UTF-8 — fall back to
    // best-effort decode.
    try {
      return Buffer.from(obj.bytes, "base64").toString("utf8");
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * Parse rg's JSONL output. Each line is one event; we keep only
 * `type === "match"` lines and coerce into the `SearchHit` shape.
 * Malformed lines are silently dropped.
 */
function parseRgJsonl(stdout: string): SearchHit[] {
  const lines = stdout.split("\n");
  const hits: SearchHit[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (typeof parsed !== "object" || parsed === null) continue;
    const evt = parsed as { type?: unknown };
    if (evt.type !== "match") continue;
    const m = parsed as RgMatchEvent;
    const file = extractText(m.data?.path);
    if (!file) continue;
    const lineNo = typeof m.data?.line_number === "number" ? m.data.line_number : 0;
    const preview = extractText(m.data?.lines).replace(/\r?\n$/, "");
    hits.push({ file, line: lineNo, preview });
  }
  return hits;
}

/**
 * Run a ripgrep-backed search over the memory-source allowlist. Returns an
 * empty array on empty query or rg exit 1 (no match). Throws on genuine rg
 * errors (exit 2+, timeout, binary missing).
 */
export async function searchMemory(
  q: string,
  rootsOverride?: string[],
): Promise<SearchHit[]> {
  if (typeof q !== "string" || q.length === 0) return [];
  if (q.length > MAX_QUERY_LEN) throw new Error("query too long");

  const allowed = await getAllowedRoots();
  const candidates = Array.isArray(rootsOverride) ? rootsOverride : allowed;
  // Intersect the caller's roots with the allowlist — never union.
  const roots = candidates.filter((r) => allowed.includes(r));
  if (roots.length === 0) return [];

  try {
    const { stdout } = await _execFileP("rg", [...RG_ARGS, q, ...roots], {
      timeout: 5_000,
      maxBuffer: MAX_BUFFER,
    });
    return parseRgJsonl(stdout);
  } catch (err) {
    const code = (err as { code?: number } | null)?.code;
    if (code === 1) return []; // rg exit 1 = no match; NOT an error
    throw err;
  }
}
