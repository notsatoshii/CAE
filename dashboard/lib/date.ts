import { formatRelative } from "@/components/ui/timestamp"

function toMs(ts: number | string | null | undefined): number | null {
  if (ts == null) return null
  if (typeof ts === "string") {
    const ms = new Date(ts).getTime()
    return Number.isFinite(ms) && ms > 0 ? ms : null
  }
  if (!Number.isFinite(ts) || ts <= 0) return null
  return ts > 1e12 ? ts : ts * 1000
}

/**
 * Format any timestamp as a compact relative string ("3h ago", "7d ago").
 *
 * Accepts epoch ms, epoch seconds, ISO strings, null, or undefined.
 * Returns "—" for missing, zero, or unparseable values so the UI never
 * shows "20,567 days ago" when a placeholder 0 slips through.
 */
export function formatRelativeTime(ts: number | string | null | undefined): string {
  const ms = toMs(ts)
  if (ms === null) return "—"
  return formatRelative(ms, Date.now())
}
