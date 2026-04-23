/**
 * audit/score/rubric.ts — Phase 15 Cap.4.
 *
 * 1-5 anchor text for every pillar, copied verbatim from
 * OVERHAUL-PLAN.md § "Pillar scoring rubric (anchored)". The LLM-vision
 * scorer (Cap.5) inlines these anchors into the model prompt; the
 * heuristic scorer (pillars.ts) uses them for `evidence` lines. Keep
 * this file the single source of truth — do NOT re-word inline.
 *
 * RUBRIC_VERSION: bump when wording changes so Cap.5's cache hash
 * invalidates cleanly. Cached LLM calls keyed on (png, pillar,
 * RUBRIC_VERSION).
 */

export type PillarId =
  | "truth"
  | "depth"
  | "liveness"
  | "voice"
  | "craft"
  | "reliability"
  | "ia"

export const PILLARS: PillarId[] = [
  "truth",
  "depth",
  "liveness",
  "voice",
  "craft",
  "reliability",
  "ia",
]

export const RUBRIC_VERSION = "1"

// caveman: score keys are literal 1|2|3|4|5 so typing stays tight
export const RUBRIC: Record<PillarId, Record<1 | 2 | 3 | 4 | 5, string>> = {
  truth: {
    5: "Every value matches state",
    4: "Minor drift on edge cases",
    3: "Some staleness",
    2: "Lies in places",
    1: "Lies pervasively",
  },
  depth: {
    5: "Detail = 3× summary, clickthrough deep",
    4: "Detail = 2× summary",
    3: "Detail ≈ summary",
    2: "Detail < summary",
    1: "No detail",
  },
  liveness: {
    5: "All 5 states (loading/fresh/stale/dead/error) explicit",
    4: "4/5 states",
    3: "3/5 states",
    2: "2/5 states",
    1: "1/5 states",
  },
  voice: {
    5: "Reads like Resend/Stripe",
    4: "Mostly human, some boilerplate",
    3: "Mixed boilerplate",
    2: "Generic",
    1: "Lorem-ipsum tier",
  },
  craft: {
    5: "Indistinguishable from Linear",
    4: "Minor inconsistencies",
    3: "Visibly amateur in places",
    2: "Tacky",
    1: "'1995 admin panel'",
  },
  reliability: {
    5: "0 errors, 0 warnings",
    4: "<3 warnings, 0 errors",
    3: "<5 warnings, no breaks",
    2: "Errors present",
    1: "Broken",
  },
  ia: {
    5: "Indistinguishable from Linear sidebar",
    4: "Discoverable, minor friction",
    3: "Workable but unclear",
    2: "Confusing",
    1: "Hidden / orphan",
  },
}

// Voice principles (WAVE-6-VOICE-PLAN.md §5) — banned stock phrasing.
// Regex so the pillars.ts voice check stays declarative.
// Keep exact-match anchors: whole-string hits only, don't false-positive
// on "No data was loaded because ..." — substring matches are too noisy.
export const VOICE_BANNED: RegExp[] = [
  /^no data$/i,
  /^empty$/i,
  /^loading\.{3}$/i,
  /^loading$/i,
  /^error$/i,
  /^please try again\.?$/i,
  /^failed to load$/i,
  /^failed$/i,
  /^no items$/i,
  /^unavailable$/i,
  /^data unavailable$/i,
]
