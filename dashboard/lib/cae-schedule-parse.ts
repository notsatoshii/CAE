import { CronExpressionParser } from "cron-parser"
import { defaultLlm } from "./cae-schedule-parse-llm"

export type ParseResult = {
  cron: string
  source: "rule" | "llm"
  confidence: "high" | "medium"
}

type LlmImpl = (nl: string) => Promise<{ cron: string }>
type RuleHandler = (m: RegExpMatchArray) => string

/**
 * Convert 12h hour string + optional meridiem to 24h integer.
 * Handles: "9" + "am" → 9, "9" + "pm" → 21, "12" + "am" → 0, "12" + "pm" → 12.
 */
function to24h(h: string, meridiem?: string): number {
  let n = parseInt(h, 10)
  const m = (meridiem ?? "am").toLowerCase()
  if (m === "pm" && n < 12) n += 12
  if (m === "am" && n === 12) n = 0
  return n
}

const DOW = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]

/**
 * Deterministic rule table. Each entry is [regex, handler|string].
 * Rules are tried in order; first match wins.
 *
 * Covers ~21 common patterns without needing LLM:
 *   - every (morning|day) at H(:MM)? (am|pm)?
 *   - every weekday at H(:MM)? (am|pm)?
 *   - every WEEKDAY_NAME at H(:MM)? (am|pm)?
 *   - every N minutes?
 *   - every minute
 *   - every hour
 *   - every N hours?
 *   - at midnight
 *   - at noon
 *   - every weekend at H(:MM)? (am|pm)?
 */
const RULES: Array<[RegExp, RuleHandler | string]> = [
  // "every morning at 9am" / "every day at 8:30am"
  [
    /^every (?:morning|day) at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i,
    (m) => {
      const min = m[2] ?? "0"
      const h = to24h(m[1], m[3] ?? "am")
      return `${min} ${h} * * *`
    },
  ],

  // "every weekday at 7pm"
  [
    /^every weekday at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i,
    (m) => {
      const min = m[2] ?? "0"
      const h = to24h(m[1], m[3] ?? "am")
      return `${min} ${h} * * 1-5`
    },
  ],

  // "every weekend at 10am"
  [
    /^every weekend at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i,
    (m) => {
      const min = m[2] ?? "0"
      const h = to24h(m[1], m[3] ?? "am")
      return `${min} ${h} * * 0,6`
    },
  ],

  // "every monday at 10am", "every tuesday at 3pm", etc.
  [
    /^every (sunday|monday|tuesday|wednesday|thursday|friday|saturday) at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i,
    (m) => {
      const dow = DOW.indexOf(m[1].toLowerCase())
      const min = m[3] ?? "0"
      const h = to24h(m[2], m[4] ?? "am")
      return `${min} ${h} * * ${dow}`
    },
  ],

  // "every minute"
  [/^every minute$/i, "* * * * *"],

  // "every 15 minutes"
  [/^every (\d+) minutes?$/i, (m) => `*/${m[1]} * * * *`],

  // "every hour"
  [/^every hour$/i, "0 * * * *"],

  // "every 2 hours"
  [/^every (\d+) hours?$/i, (m) => `0 */${m[1]} * * *`],

  // "at midnight"
  [/^at midnight$/i, "0 0 * * *"],

  // "at noon"
  [/^at noon$/i, "0 12 * * *"],
]

/**
 * WR-03: Minimum interval floor for LLM-returned cron expressions.
 *
 * Rule-matched crons (e.g. "every minute") are trusted — the rules table is
 * deterministic and the user explicitly asked for that cadence. LLM-returned
 * crons are not trusted: a prompt-injected response could force `* * * * *`
 * (every minute), burning Anthropic quota and wedging the watcher's subshells.
 *
 * Floor: 5 minutes (300 seconds). If two consecutive next-run times computed
 * from the LLM cron are less than 300s apart, the cron is rejected.
 */
const LLM_MIN_INTERVAL_SECONDS = 300

/**
 * Compute the interval in seconds between the first two firings of a cron
 * expression, starting from the current time.
 *
 * Returns Infinity if computation fails (safe default — won't reject).
 */
function cronMinInterval(cron: string): number {
  try {
    const iter = CronExpressionParser.parse(cron, {
      currentDate: new Date(),
    })
    const t1 = iter.next().getTime()
    const t2 = iter.next().getTime()
    return (t2 - t1) / 1000
  } catch {
    return Infinity
  }
}

/**
 * Parse a natural-language schedule string into a cron expression.
 *
 * Strategy (§Pattern 2 from research):
 * 1. Try each rule in RULES table (deterministic, zero cost).
 * 2. If no rule matches, call llmImpl (defaults to claude shell-out).
 * 3. Validate LLM output via CronExpressionParser.parse(); throw if invalid.
 * 4. WR-03: Validate LLM output cadence — reject if interval < 5 minutes.
 *
 * @param nl    Natural-language schedule, e.g. "every morning at 9am"
 * @param llmImpl  Injectable LLM implementation (mock in tests)
 */
export async function parseSchedule(
  nl: string,
  llmImpl: LlmImpl = defaultLlm
): Promise<ParseResult> {
  const trimmed = nl.trim()

  for (const [re, gen] of RULES) {
    const m = trimmed.match(re)
    if (m) {
      const cron = typeof gen === "function" ? gen(m) : gen
      return { cron, source: "rule", confidence: "high" }
    }
  }

  // Rule failed — use LLM fallback
  const llmResult = await llmImpl(trimmed)

  // Validate the LLM-returned cron expression before trusting it
  try {
    CronExpressionParser.parse(llmResult.cron)
  } catch {
    throw new Error(`Could not parse: "${nl}"`)
  }

  // WR-03: reject LLM-returned cron if interval is below the minimum floor.
  // This prevents prompt-injection forcing `* * * * *` (every-minute DoS).
  // Rule-matched crons bypass this check — they are deterministic, not LLM output.
  const interval = cronMinInterval(llmResult.cron)
  if (interval < LLM_MIN_INTERVAL_SECONDS) {
    throw new Error(
      `Schedule is too frequent (minimum interval is ${LLM_MIN_INTERVAL_SECONDS / 60} minutes for LLM-parsed schedules)`
    )
  }

  return { cron: llmResult.cron, source: "llm", confidence: "medium" }
}
