/**
 * Pure projectPath → circuit-breakers.jsonl path resolver.
 *
 * - `projectPath` truthy + non-empty + non-whitespace-only + string →
 *   returns `<projectPath>/.cae/metrics/circuit-breakers.jsonl`
 *   (trailing slash stripped; no further normalization — /api/tail validates ALLOWED_ROOTS)
 * - null | undefined | "" | whitespace-only | non-string → null (no SSE opened by caller)
 * - Never throws.
 *
 * Isomorphic: no node: imports, safe to import in client React hooks (D-10).
 */
export function resolveCbPath(projectPath?: string | null): string | null {
  if (typeof projectPath !== "string") return null;
  const trimmed = projectPath.trim();
  if (trimmed.length === 0) return null;
  const base = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  return base + "/.cae/metrics/circuit-breakers.jsonl";
}
