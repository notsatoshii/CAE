import cronstrue from "cronstrue"
import { CronExpressionParser } from "cron-parser"

/**
 * Describe a cron expression in human-readable English and compute the next run time.
 *
 * @param cron  5-field cron expression, e.g. "0 9 * * *"
 * @param tz    IANA timezone, e.g. "America/New_York"
 * @returns     { english: string, nextRun: Date | null }
 *              english = cronstrue description, or raw cron if cronstrue fails
 *              nextRun = next trigger time as Date, or null if cron is invalid
 */
export function describeCron(
  cron: string,
  tz: string
): { english: string; nextRun: Date | null } {
  let english: string
  try {
    english = cronstrue.toString(cron)
  } catch {
    // Fallback: show the raw cron string when cronstrue cannot parse
    english = cron
  }

  let nextRun: Date | null = null
  try {
    const iter = CronExpressionParser.parse(cron, { tz })
    nextRun = iter.next().toDate()
  } catch {
    // Swallow — invalid cron expression returns null nextRun
  }

  return { english, nextRun }
}
