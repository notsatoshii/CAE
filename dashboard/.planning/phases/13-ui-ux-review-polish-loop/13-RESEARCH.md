# Phase 13: UI/UX review + polish loop — Research

**Researched:** 2026-04-22
**Domain:** Retroactive UX audit of Next.js 16 / React 19 / Tailwind v4 / shadcn (`base-nova`) dashboard. Screenshot harness → multi-pass Opus vision review → fix planning → Sonnet execution → delta re-audit.
**Confidence:** MEDIUM-HIGH. GSD infrastructure is ~60% reusable; auth against the live app is the main unknown but has 4 workable paths.

## Summary

Phase 13 ships **no new features**. The deliverable is a measurably better-looking app, validated by before/after screenshots an Opus 4.7 judge scores higher than baseline.

Key decisions:

1. **Reuse `gsd-ui-auditor`, don't replace it.** It already does 6-pillar scoring, gitignore safety, CLI Playwright screenshot capture, and UI-REVIEW.md output. Its gaps for P13 are *scale* (1 → 200 images), *multi-pass* (audit → audit + critique + delta), *auth* (fatal — existing path can't get past `middleware.ts`), and *vision model* (existing path is string-grep only).
2. **Auth: Playwright `storageState.json` from one-time manual sign-in.** Zero prod-code contamination, 5-min setup, 30-day validity.
3. **Opus 4.7 vision: batch size 8 images/call, serial execution.** ~25 calls total per audit pass. Budget: **~$12 total** across all 3 vision passes.
4. **Scope: ~195 screenshots** = 13 `page.tsx` + ~20 drawer/deep-link states × 3 viewports × pruned mode matrix. Matches session-5 estimate.
5. **Self-critique (new, Wave 3):** second Opus reads UI-REVIEW.md + 15 sampled images, looks for bias/gaps/priority inversions. Highest-leverage addition to the existing infra.

**Primary recommendation:** 6 waves (0 harness → 1 screenshot + 1.5 axe → 2 Opus audit → 3 Opus critique → 4 Opus plan → 5 Sonnet fix → 6 Opus delta). Add `gsd-ui-critic` agent. Add `model_overrides` entries routing vision/critic waves to Opus 4.7 explicitly.

---

<user_constraints>
## User Constraints (from Phase 13 directive — no CONTEXT.md yet)

### Locked Decisions
- **Opus 4.7 for ALL judgment steps** (Waves 2/3/4/6). Sonnet banned from judgment.
- **Sonnet is acceptable for Wave 5 execution only** (implementing locked fix plan).
- **"Be critical"** (Eric's persistent feedback) — no surface-level "LGTM" passes.
- **No new features during Phase 13.** Cosmetic + a11y + copy polish only.
- **Coverage: every shipped surface** × 2 modes (founder/dev) × 3 viewports (375/1280/1920) × Explain-on/off. ~200 images.

### Claude's Discretion
- Screenshot format (PNG vs WebP) → recommend PNG for vision fidelity
- Auth strategy (4 candidates evaluated §2)
- Batch size for Opus vision calls → recommend 8
- Sample count for self-critique pass → recommend 15-20 images
- Axe-core as separate Wave 1.5 vs inline → recommend separate

### Deferred Ideas (OUT OF SCOPE)
- Visual regression CI (Chromatic, Percy, Playwright snapshot mode)
- Storybook + component-level visual testing
- Lighthouse runtime perf
- Cross-browser (Firefox/WebKit) — Chromium only
- Mobile native (iOS Safari, Android Chrome) — 375w Chromium is enough
- Any new feature the audit surfaces → deferred-ideas.md
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 13 is not in ROADMAP.md. User directive defines scope.

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-P13-01 | Screenshot harness captures every shipped route × viewport × mode (~200 images) | §2, §3 |
| REQ-P13-02 | Opus 4.7 audits against 6-pillar rubric + WCAG 2.2 AA, writes UI-REVIEW.md | §4, §5, §6 |
| REQ-P13-03 | Second Opus pass critiques REQ-P13-02 for bias/gaps/priority errors → UI-REVIEW-CRITIQUE.md | §5, §9#16 |
| REQ-P13-04 | Opus planner writes fix plan from both audit outputs | §6 Wave 4 |
| REQ-P13-05 | Sonnet executes fixes against plan | §6 Wave 5 |
| REQ-P13-06 | After fixes, re-screenshot, Opus before/after delta → UI-DELTA.md per finding | §5, §6 Wave 6 |
| REQ-P13-07 | No new features — cosmetic/a11y/copy only | Constraint |
| REQ-P13-08 | All judgment steps use Opus 4.7; Sonnet banned from judgment | §6 model_overrides |
</phase_requirements>

---

## 1. GSD infrastructure gap analysis

Verified paths:

| Artifact | Path | Status |
|----------|------|--------|
| `gsd-ui-auditor` agent | `/root/.claude/agents/gsd-ui-auditor.md` | [VERIFIED: 480 lines, exists] |
| `gsd-ui-checker` agent | `/root/.claude/agents/gsd-ui-checker.md` | [VERIFIED: exists] |
| `gsd-ui-researcher` agent | `/root/.claude/agents/gsd-ui-researcher.md` | [VERIFIED: exists] |
| `/gsd-ui-review` workflow | `/root/.claude/get-shit-done/workflows/ui-review.md` | [VERIFIED: 188 lines, exists] |
| `/gsd-ui-review` **slash command** | `/root/.claude/commands/*.md` | [VERIFIED: **DOES NOT EXIST**] |
| `gsd-ui-review` **skill** | `/root/.claude/get-shit-done/skills/gsd-ui-review/SKILL.md` | [VERIFIED: **DOES NOT EXIST**] |

The workflow doc and auditor agent exist; the slash-command wrapper does not. Phase 13 either registers a `/gsd-ui-review` command OR orchestrates directly from its phase waves. Recommend the latter — one-off phase, don't pollute the command namespace.

### What `gsd-ui-auditor` does (reusable)

- `.gitignore` safety gate for screenshot dirs
- Dev-server detection (:3000/:5173/:8080)
- CLI screenshot capture via `npx playwright screenshot` — 3 fixed viewports
- 6-pillar scoring 1-4 (Copywriting / Visuals / Color / Typography / Spacing / Experience Design)
- Registry safety audit for third-party shadcn blocks (not applicable — `components.json` has `"registries": {}`)
- Code-only fallback (grep for hardcoded colors, generic CTAs) if no dev server
- Writes `$PHASE_DIR/$PADDED_PHASE-UI-REVIEW.md`

### What it does NOT do (P13 must add)

| Gap | Severity | P13 Fix |
|-----|----------|---------|
| **No auth** — screenshots of protected `/build/*`, `/plan`, `/memory`, `/metrics` capture `/signin` redirect only | BLOCKING | Wave 0: `storageState.json` (§2) |
| Single screenshot per viewport (3 total) vs required ~200 | BLOCKING | Wave 1: replace CLI loop with Playwright test script |
| No drawer/sheet state awareness — app uses URL query params for drawer state | BLOCKING | Wave 1: enumerate URL patterns per route (§3) |
| No Explain-mode / Dev-mode toggling (both are localStorage) | BLOCKING | Wave 1: set localStorage before each shot |
| **No vision-model pass** — existing audit is string-grep only | BLOCKING for REQ-P13-02 | Wave 2: new Opus vision flow (§5) |
| No self-critique pass | REQ-P13-03 | New `gsd-ui-critic` agent |
| No delta / before-after audit | REQ-P13-06 | Wave 6 orchestration + prompt (§5) |
| No explicit Opus 4.7 routing | REQ-P13-08 | `model_overrides` config entries |
| Viewports hardcoded (1440×900/375×812/768×1024); P13 wants 375/1280/1920 | Non-blocking | P13 script owns its viewport list |
| No axe-core / WCAG 2.2 automated check | Gap | Wave 1.5: `@axe-core/playwright` |

**Net: ~60% reusable (rubric, gitignore gate, scoring discipline, output format), ~40% new (auth, multi-state enumeration, vision integration, critic agent, delta pass, a11y).**

---

## 2. Playwright harness recipe

### Dep versions (npm-verified 2026-04-22)

| Package | Version | Verification |
|---------|---------|--------------|
| `@playwright/test` | 1.59.1 | [VERIFIED: `npm view @playwright/test version`, latest tag, published 2026-04-22] |
| `playwright` | 1.59.1 | [VERIFIED] |
| `@axe-core/playwright` | 4.11.2 | [VERIFIED] |
| `axe-core` | 4.11.3 | [VERIFIED] |
| `sharp` (optional) | 0.34.5 | [VERIFIED: only needed if >3.75MP images] |
| `pixelmatch` (optional) | 7.1.0 | [VERIFIED: optional CI diff] |

Install (Wave 0): `pnpm add -D @playwright/test@1.59.1 @axe-core/playwright@4.11.2 && pnpm exec playwright install chromium`

### Auth strategy tradeoff

| # | Strategy | Effort | Prod-code risk | Maintenance | Verdict |
|---|----------|--------|----------------|-------------|---------|
| **A** | **`storageState.json` from one-time manual sign-in** — open browser via Playwright, sign in with GitHub once, save cookies, reuse | LOW (5 min one-off) | **ZERO** | Re-capture every 30d (NextAuth cookie TTL) | ✅ **RECOMMENDED** |
| B | `NEXTAUTH_TEST_BYPASS=1` env flag in auth.ts | MEDIUM | **HIGH** — bypass code in prod bundle | Low | ❌ contamination risk |
| C | Full GitHub OAuth in headless (username/password/MFA) | HIGH | NONE | HIGH — MFA rotation, rate limits | ❌ fragile |
| D | Middleware patch for test requests | MEDIUM | HIGH | Medium | ❌ contamination risk |

**NextAuth v5 cookie name = `authjs.session-token`** (not the v4 `next-auth.session-token`). [CITED: authjs migration docs; confirmed via playwright issue #21207]

**Fallback if GitHub MFA blocks manual sign-in:** construct a signed JWT via NextAuth's signing key, inject via `context.addCookies()`. Pattern shown in playwright/playwright #21207.

### Playwright config

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/visual',
  timeout: 60_000,
  fullyParallel: false,  // screenshots need deterministic localStorage; parallel = races
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    storageState: 'tests/visual/.auth/user.json',
    screenshot: 'off',  // we call page.screenshot() manually
  },
  projects: [
    { name: 'mobile', use: { viewport: { width: 375,  height: 812  } } },
    { name: 'laptop', use: { viewport: { width: 1280, height: 800  } } },
    { name: 'wide',   use: { viewport: { width: 1920, height: 1080 } } },
  ],
});
```

**deviceScaleFactor: 1x.** Retina doubles file size without helping Opus — cap at 3.75MP per image. [CITED: Anthropic Opus 4.7 vision docs] 1920×1080 @ 1x = 2.07MP, safely under.

### Turbopack `networkidle` trap — real

`page.waitForLoadState('networkidle')` hangs indefinitely under `next dev --turbopack` (continuous HMR pings). [CITED: microsoft/playwright #19835; vercel/next.js #66326]

**Fix:** run audit against `pnpm build && pnpm start` (production build), not `pnpm dev`. No HMR, deterministic ~200ms settle. Inside tests: `domcontentloaded` + short timeout, never `networkidle`.

### Explain-mode / Dev-mode toggling (localStorage)

```typescript
await page.goto('/');
await page.evaluate(() => {
  localStorage.setItem('explainMode', 'true');   // or 'false'
  localStorage.setItem('devMode', 'false');       // or 'true'
});
// Then navigate to target route
```

**Matrix pruning (avoid combinatorial explosion):**
- Every route × 3 viewports × founder-default (`explainMode=true, devMode=false`) → ~102 shots
- Every route × 1 viewport (laptop) × dev-mode (`explainMode=false, devMode=true`) → ~34 shots
- Drawer/sheet states × 1 viewport (laptop) × founder-default → ~60 shots

**Total: ~196 screenshots.** Matches session-5 memory ("150-250").

### Drawer state — URL-param driven (verified)

grep confirmed:
- `?sheet=open&phase=N&project=…&plan=…&task=…` → TaskDetailSheet
- `?agent=forge` → AgentDetailDrawer
- `?task=<id>` → WhyDrawer on /memory
- `?timeline=<path>` → GitTimelineDrawer on /memory
- `?tab=graph` / `?tab=browse` → /memory tab
- `?tail=<path>` → TailSheet on /build/phase/[num]

**No click simulation needed** for drawers — each state is just a URL. Script is 95% "navigate, wait, snapshot."

---

## 3. Route × state enumeration

13 `page.tsx` files + expanded states:

### Public (2 routes, auth-free)
| URL | State | Viewports |
|-----|-------|-----------|
| `/` | redirect/landing | 3 |
| `/signin` | sign-in page | 3 |
| `/signin?from=/build` | with redirect param | 1 |

### Protected top-level (8 routes)
| URL | Source | Viewports |
|-----|--------|-----------|
| `/plan` | `app/plan/page.tsx` | 3 |
| `/build` | `app/build/page.tsx` | 3 |
| `/build/agents` | `app/build/agents/page.tsx` | 3 |
| `/build/changes` | `app/build/changes/page.tsx` | 3 |
| `/build/queue` | `app/build/queue/page.tsx` | 3 |
| `/build/workflows` | `app/build/workflows/page.tsx` | 3 |
| `/memory` | `app/memory/page.tsx` | 3 |
| `/metrics` | `app/metrics/page.tsx` | 3 |

### Deep-link drawer/sheet states (~15)
| URL | Notes |
|-----|-------|
| `/build/phase/1`, `/build/phase/8` | shipped phases, vary data density |
| `/build/phase/8?tail=/abs/log.log` | TailSheet open |
| `/build/phase/99` | 404 state |
| `/build?sheet=open&phase=1&project=cae-dashboard&plan=01&task=t1` | TaskDetailSheet |
| `/build?sheet=open&…&task=nonexistent` | sheet with error |
| `/build/agents?agent=forge` | agent drawer (active) |
| `/build/agents?agent=scribe` | agent drawer (dormant variant) |
| `/build/workflows/new` | create form |
| `/build/workflows/[slug]` | edit form (Monaco loads async — wait for `.monaco-editor`) |
| `/memory?tab=browse` | default |
| `/memory?tab=graph` | react-flow canvas (wait for `<g>` child in SVG) |
| `/memory?task=<id>` | WhyDrawer |
| `/memory?timeline=/abs/path.md` | GitTimelineDrawer |

### Empty/error-state variants (~40)
Stub `/api/**` to return `{ status: 500 }` or empty arrays via `page.route()`. Capture each route in empty + error state.

### **Total: ~145 core + ~50 variants = ~195 screenshots** ✓

### Skip
- Phase 10 Plan-mode sub-routes (Projects/PRDs/Roadmaps/UAT) — **unshipped as of 2026-04-22** (ROADMAP shows Phase 9 still in flight)
- Phase 11 Live Floor — **unshipped**

Revisit route list at Wave 0 if Phase 10/11 ship before P13 runs.

---

## 4. 6-pillar rubric with citations

**Source hierarchy:** `docs/UI-SPEC.md` (project law) > WCAG 2.2 AA (regulatory floor) > Refactoring UI (Wathan/Schoger) > Apple HIG + Material 3 (platform conventions) > Laws of UX (Yablonski).

### P1 — Visual hierarchy
- Focal point exists; one element dominant via size/weight/color [CITED: Refactoring UI ch.1]
- Size contrast: primary heading ≥1.5× secondary ≥1.2× body
- Weight contrast: ≤2 weights in view; UI-SPEC §13 locked at 400/500/600, no bolder than 700
- Anti-pattern: size alone for hierarchy — use weight/color instead [CITED: Wathan/Schoger]

### P2 — Typography
- Fonts: Geist Sans + Geist Mono only [CITED: UI-SPEC §13]
- Scale: {13, 14, 15, 16, 20, 24, 32}px — UI-SPEC declares 13px base; >4 sizes in one view = BLOCK [CITED: `gsd-ui-checker` D4]
- Weights: 400/500/600 only
- Line-height: body 1.5, heading 1.2 [ASSUMED — not locked in UI-SPEC]
- Measure: 45-75ch [CITED: Butterick, *Practical Typography*]
- **Times New Roman check** — Phase 3 DoD locked "no Times New Roman anywhere"

### P3 — Spacing / rhythm
- 8pt grid: values ∈ {4, 8, 12, 16, 24, 32, 48, 64} — arbitrary `p-[23px]` = BLOCK [CITED: `gsd-ui-checker` D5]
- Density: lists 12-14px padding / 32-40px rows; detail 24-32px padding [CITED: UI-SPEC §13]
- Grep `\[.*px\]|\[.*rem\]` on `components/**/*.tsx` — each match = flag

### P4 — Color / contrast
- **WCAG 2.2 AA:** body ≥4.5:1, UI/large text ≥3:1 [CITED: SC 1.4.3, 1.4.11]
  - `text-muted` (#8a8a8c) / bg (#0a0a0a) = **5.1:1** ✓
  - **`text-dim` (#5a5a5c) / bg (#0a0a0a) = 2.7:1 ✗ FAILS AA**. Expect high-leverage token fix.
  - `accent` (#00d4ff) / bg = **10.1:1** ✓
- Accent restraint: `#00d4ff` reserved for primary CTA / active nav / focus ring / live indicator [CITED: UI-SPEC §13]. >10 unique accent elements per screen = flag.
- Grep hardcoded hex `#[0-9a-fA-F]{3,8}` in `components/**/*.tsx` — each outside token set = flag.

### P5 — Affordance / click targets
- **WCAG 2.2 SC 2.5.8 AA:** targets ≥ 24×24 CSS px OR 24px circle of spacing [CITED: w3.org/WAI/WCAG22/Understanding/target-size-minimum.html]
- AAA aspiration: 44×44 (Apple HIG) / 48×48 (Material)
- Every interactive has hover state + focus ring; `outline-none` without `focus:ring-*` = flag
- Destructive actions have disabled + confirmation

### P6 — Consistency
- Same action = same visual (icon, size, position)
- Icon library: Lucide only per `components.json`; react-icons / heroicons / emoji = flag
- CTA verbs: route text through `lib/copy/labels.ts` (Phase 3 pl 03-05); bare strings = flag
- **Founder-speak enforcement** (UI-SPEC §Audience reframe): no "phase/wave/task" in default mode — grep components
- Empty-state pattern consistent (icon + headline + CTA)

### Composite — Experience Design
- Loading / error / empty states present
- **`prefers-reduced-motion` respected** [CITED: UI-SPEC §S4.6] — grep shake/pulse for the media query
- Destructive actions use ConfirmActionDialog [CITED: Phase 9 pl 09-06]

---

## 5. Prompt designs

### Wave 2 — batch audit prompt (8 images/call)

Session-5 memory: 5-10/call for judgment sharpness. 8 = balance.

```
You are auditing screenshots of the CAE Dashboard, a Next.js app with this locked design contract:
{inline abbreviated UI-SPEC: colors, typography, density, accent reservations}

For EACH image attached (labeled image-1, image-2, ...), score 1-4 on 6 pillars:
1. Visual hierarchy  2. Typography  3. Spacing/rhythm  4. Color/contrast  5. Affordance  6. Consistency

Output JSON only:
{
  "batch_id": "<uuid>",
  "findings": [{
    "image": "image-1", "route": "<url>", "viewport": "...", "mode": "founder|dev",
    "pillar_scores": { ... 1-4 each ... },
    "issues": [{ "pillar": "...", "severity": "high|medium|low",
                 "description": "<specific element cited>",
                 "suggested_fix": "<actionable>", "location_hint": "..." }],
    "strengths": ["..."],
    "wcag_violations": [{ "sc": "1.4.3", "description": "..." }]
  }]
}

Be critical. Eric has said repeatedly: no surface-level passes. Look HARD at:
spacing rhythm, accent overuse, text-dim contrast failures, touch target sizes.
Do not inflate scores to be nice.

Critical: cite specific elements. "Spacing is inconsistent" is useless. "Gap between
rollup strip and Active Phases (~12px) is tighter than between cards within Active
Phases (~24px), breaking vertical rhythm" is useful.
```

### Wave 3 — self-critique prompt (one call)

Input: full UI-REVIEW.md + 15-20 sampled images (3 highest-scored + 3 lowest-scored + 10-14 random).

```
You are reviewing another Opus 4.7 agent's UI audit of the CAE Dashboard.

The audit is attached as UI-REVIEW.md. A subset of screenshots is also attached.

Find: BIAS, GAPS, and PRIORITY INVERSIONS.

1. BIAS — does the auditor over-index on one pillar? (e.g., 80% of findings are
   spacing — is that truth about the app, or the auditor's fixation?)
2. PRIORITY INVERSION — are HIGH severity findings actually high-impact for a
   non-dev founder user? Are LOW severity findings buried that would bite a real user?
3. OBVIOUS MISSES — issues the auditor did NOT call out. Focus on: motion cues
   absent from static shots; WCAG the auditor missed; copy-voice inconsistency
   (founder-speak rules per UI-SPEC §Audience reframe).
4. OVERCALLED — findings that are actually fine. Nitpicks, or rubric applied too literally.

Output JSON with: bias_analysis, priority_rerank, missed_issues, overcalled_issues,
top_3_highest_leverage_fixes.

Be willing to disagree with the first auditor. Your value is dissent.
Eric's pattern: agents that agree miss things.
```

### Wave 6 — delta re-audit prompt (per finding)

Paired before/after screenshots + original finding + suggested fix.

```
ATTACHED: two screenshots of the same route at the same viewport.
- image-1 = BEFORE (pre-fix)
- image-2 = AFTER (post-fix)

ORIGINAL FINDING: {verbatim}
SUGGESTED FIX: {verbatim}

Output: { "finding_id": "...",
          "verdict": "resolved|partial|still_broken|regressed",
          "evidence": "<what you see that supports verdict>",
          "new_issues_introduced": ["..."] }

Be honest. A Sonnet executor implemented these — it may have misunderstood intent.
```

### Prompt discipline
- JSON outputs throughout (planner consumes programmatically)
- "Be critical" in every prompt (mitigates sycophancy — Eric's #1 feedback [CITED: MEMORY feedback_be_critical.md])
- Separate agent files per role so personas don't anchor on each other (§9 #16)

---

## 6. Wave structure proposal

| Wave | Goal | Agents | Model | Plans | Tokens |
|------|------|--------|-------|-------|--------|
| **0** | Harness infra — Playwright install, config, one-time auth capture, gitignore | `gsd-executor` + human | Sonnet | 1 | ~10k |
| **1** | Screenshot run → `screenshots-before/` (~200 PNGs) | `gsd-executor` | Sonnet | 1 | ~5k |
| **1.5** | `@axe-core/playwright` scan → `AXE-RESULTS.json` | `gsd-executor` | Sonnet | 1 | ~5k |
| **2** | Vision audit — Opus batches images, writes UI-REVIEW.md | new `gsd-ui-vision-auditor` (or expanded `gsd-ui-auditor`) | **Opus 4.7** | 1 | ~475k in + 75k out |
| **3** | Self-critique → UI-REVIEW-CRITIQUE.md | new `gsd-ui-critic` | **Opus 4.7** | 1 | ~50k in + 10k out |
| **4** | Fix plan from both audits | `gsd-planner` + `gsd-plan-checker` | **Opus 4.7** | 2-4 | ~20k each |
| **5** | Execute fixes | `gsd-executor` | Sonnet 4.6 | N waves inside | varies |
| **6** | Delta re-audit: re-screenshot → `screenshots-after/`, per-finding paired judgment | reuse Wave 2 agent | **Opus 4.7** | 1 | similar to Wave 2 |
| **7** | VERIFICATION.md + human UAT | `gsd-verifier` | Opus | 1 | ~10k |

**Total: 8-10 plans.** Within normal GSD phase size.

### Parallelism
- Waves 1 + 1.5 parallel (same server, different scripts) — ✓
- Wave 2 batches: **serial**, not parallel. Session-5 memory: parallel batches lose cross-reference context and degrade judgment. Cost savings not worth it.

### `.planning/config.json` additions

```json
"model_overrides": {
  "gsd-ui-vision-auditor": "claude-opus-4-7",
  "gsd-ui-critic": "claude-opus-4-7",
  ...existing...
}
```

`gsd-planner` + `gsd-plan-checker` already route to Opus (4.6 today — upgrade to 4.7 for this phase).

---

## 7. Token budget

Opus 4.7 input: $5/M, output: $25/M. **New tokenizer emits ~35% more tokens per input** [CITED: tokencost.app Opus 4.7 pricing analysis] — apply 1.35× multiplier to prior 4.6 estimates.

Image tokens post-bump:

| Size | Tokens/image | $/image |
|------|--------------|---------|
| 375×812  | ~700  | $0.0035 |
| 1280×800 | ~1800 | $0.009  |
| 1920×1080| ~2200 | $0.011  |

| Wave | Calls | Input | Output | $ |
|------|-------|-------|--------|---|
| 2 audit | 25 | 475k | 75k | **$4.25** |
| 3 critique | 1 | 50k | 10k | **$0.50** |
| 6 delta | ~40 | 240k | 40k | **$2.20** |
| Vision subtotal | | | | **~$7** |
| Planning (Opus): 3-4 plans × 20k | | 80k | | **~$2** |
| Executor (Sonnet): ~40 fix tasks | | 300k in | 150k out | **~$3-5** |
| **Total Phase 13 est.** | | | | **$12-15** |

Cheap relative to value. Worst-case 2× overrun still under $30.

---

## 8. Tradeoff tables

### Screenshot format

| Dim | PNG | WebP | Winner |
|-----|-----|------|--------|
| Vision-model fidelity | Lossless | Lossy | **PNG** |
| 1280×800 filesize | ~400KB | ~80KB | WebP (but gitignored — irrelevant) |
| Pixelmatch diff accuracy | High | Lower | **PNG** |

**Recommend PNG.** Files are gitignored; fidelity matters.

### Vision batch size

| Batch | Pros | Cons | Verdict |
|-------|------|------|---------|
| 1 | Max sharpness | 200 calls, expensive | Too granular |
| 5 | Sharp, cross-ref within batch | 40 calls | Viable |
| **8** | Balanced | 25 calls | **✅ Recommended** |
| 10 | Session-5 upper bound | Attention diffuses on shot 10 | Viable if cost-bound |
| 20+ | Cheapest | Judgment degrades, malformed JSON | Avoid |

### a11y timing

| Option | Pros | Cons |
|--------|------|------|
| Inline (Wave 2 vision) | One pass | Opus doesn't run axe; pass JSON as text context, lossy |
| **Separate Wave 1.5** | Deterministic, JSON feeds planner directly | +1 wave |

**Recommend separate.** Automation catches 30-40% of WCAG; vision catches the rest (brand feel, tone). Complementary [CITED: davidmello.com axe+Playwright limitations].

---

## 9. GOTCHAS for the planner

1. **`/gsd-ui-review` slash command NOT registered.** Don't assume it exists; orchestrate from phase plans directly.
2. **NextAuth v5 cookie is `authjs.session-token`** (not v4 `next-auth.session-token`). Every stale tutorial lists the wrong name.
3. **Turbopack `networkidle` never settles.** Run audit against `pnpm build && pnpm start`, not dev server.
4. **`text-dim` (#5a5a5c) on #0a0a0a = 2.7:1 FAILS WCAG AA.** Expect this as a high-leverage single-fix finding (token change, not per-component).
5. **Gitignore screenshot dirs at root `.gitignore`** before Wave 1, or binary blobs enter git history. Add: `.planning/phases/*/screenshots-*/` and `tests/visual/.auth/`.
6. **Playwright install**: use `pnpm exec playwright install chromium` (specific browser), not `install` (pulls all three).
7. **Non-deterministic screenshots** (cursor blink, animations, live data). Mitigations: inject CSS `* { animation: none !important; transition: none !important; caret-color: transparent !important; }`; mock `/api/state` to fixture; `waitForTimeout(500)` post-navigate.
8. **Opus 4.7 vision 3.75MP cap per image.** 1920×1080 @ 1x = 2.07MP ✓. 2x retina = 8.3MP ✗. Keep 1x.
9. **Tokenizer bump (~35%)** — apply 1.35× multiplier on training-data token estimates.
10. **Registry Safety audit skip.** `components.json` has `"registries": {}`. `gsd-ui-auditor` knows to skip, verify anyway.
11. **Phases 10/11 unshipped (2026-04-22).** Don't enumerate /plan/* sub-routes or /live-floor. Revisit at Wave 0.
12. **Screen shake is REVIVED** (UI-SPEC §S4.6) but only on Sentinel merge events — static screenshots won't capture it. If P13 wants to verify `prefers-reduced-motion`: `page.emulateMedia({ reducedMotion: 'reduce' })` + fake merge event via fixture. Or manual UAT in Wave 7.
13. **localStorage keys: `explainMode`, `devMode`** (camelCase boolean strings). Double-check before Wave 1 — wrong key = whole dev-mode matrix captures founder-mode silently.
14. **`pnpm build` might break.** Wave 0 gates on clean build; if broken, fix before continuing.
15. **Anthropic brand (Poppins/Lora/#d97757) does NOT apply** [CITED: github.com/anthropics/skills]. Dashboard has its own locked brand (Geist + cyan). Don't borrow.
16. **Critic agent isolation.** Don't share the auditor's persona file with the critic; pass UI-REVIEW.md + images raw. Shared context = anchoring, kills dissent value.
17. **Before/after URL parity.** Wave 1 and Wave 6 must use identical deterministic URL list. Version-control it.
18. **`@xyflow/react` + dagre async layout** — `/memory?tab=graph` needs 2-3s settle. Wait for `<g>` child in graph SVG.
19. **Monaco editor async load** — `/build/workflows/[slug]` blank for 1-2s. Wait for `.monaco-editor` selector.
20. **SSE tails** (`/build/phase/[num]?tail=...`) stream indefinitely. Mock `/api/tail` or accept stale tail content in screenshot.

---

## 10. Validation Architecture

Phase 13 is polish. Traditional unit tests don't apply. **Wave 6 delta audit IS the validation.** Supplementary gates:

- `@axe-core/playwright` — deterministic a11y (Wave 1.5 + Wave 6 regression check)
- `pnpm test` (existing Vitest) — fixes don't break component tests
- `pnpm build` — fixes don't break production build
- `pnpm lint` — no new lint errors

### Phase Requirements → Verification Map

| Req | Check | Automated? |
|-----|-------|-----------|
| REQ-P13-01 | `screenshots-before/` has 195±10 PNGs | Yes — count |
| REQ-P13-02 | UI-REVIEW.md exists, findings > 0, valid JSON | Yes |
| REQ-P13-03 | UI-REVIEW-CRITIQUE.md exists with rerankings | Yes |
| REQ-P13-04 | 2-4 plan files in phase dir | Yes |
| REQ-P13-05 | SUMMARY.md per plan; build+test green | Yes |
| REQ-P13-06 | UI-DELTA.md has verdict per original finding | Yes — JSON schema |
| REQ-P13-07 | Wave 5 diff touches only `components/`, `app/globals.css`, `lib/copy/labels.ts`, `tailwind.config.*` — no new routes/APIs | Yes — diff check |
| REQ-P13-08 | Log grep confirms Opus for waves 2/3/4/6; Sonnet for wave 5 only | Yes |

### Phase gate
Wave 6 delta verdict ≥ 80% `resolved` or `partial`; **zero `regressed`**.

### Wave 0 gaps
- [ ] `playwright.config.ts`
- [ ] `tests/visual/audit.spec.ts`
- [ ] `storageState.json` (one-time manual)
- [ ] `@axe-core/playwright` install
- [ ] `.gitignore` additions (screenshot dirs + `.auth/`)
- [ ] Fixture for `/api/tail` + `/api/state` (deterministic screenshots)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Opus 4.7 image tokens ≈ 2000 for 1280×800 | §7 | Budget overrun ≤30-50%; still <$30 worst case |
| A2 | 1x deviceScaleFactor visually sufficient for vision | §2 | If wrong, retina needed, but under 3.75MP cap |
| A3 | `explainMode`/`devMode` localStorage keys are camelCase strings | §2, §9#13 | Wrong key = dev-mode matrix silently captures founder-mode |
| A4 | Line-height 1.5 body / 1.2 heading are reasonable defaults | §4 P2 | Not UI-SPEC-locked; user may disagree with rubric |
| A5 | 15-20 sampled images is right for Wave 3 critique input | §5 | Too few = critic lacks grounding; too many = diffuses |
| A6 | `pnpm build && pnpm start` on port 3000 works cleanly | §2 | If build fails, Wave 1 blocks |
| A7 | NextAuth v5 cookie is `authjs.session-token` | §9#2 | Verified in docs but v5 is beta — test early in Wave 0 |
| A8 | Batch size 8 is sweet spot | §5, §8 | Session-5 said 5-10; drop to 5 if output quality suffers |
| A9 | ~200 screenshot count | §3 | Depends on drawer-state coverage; may swing 150-250 |
| A10 | Phase 13 runs *after* Phases 9/11/12 ship | — | Route list shifts if in flight; re-enumerate at Wave 0 |

---

## Open Questions

1. **Register `/gsd-ui-review` slash command or orchestrate in-phase?**
   - Known: workflow exists, agent exists, command wrapper missing
   - Recommend: in-phase for this one-off; register later if recurring

2. **New `gsd-ui-critic.md` agent file or prompt variation of auditor?**
   - Auditor has string-grep logic baked in; critic has markdown+image input + bias-analysis output
   - Recommend: **new file.** Shared = prompt bloat + role confusion

3. **Are Phases 10/11/12 shipping before Phase 13?**
   - If yes: add Plan-mode routes + Live Floor overlay to enumeration
   - If no: skip
   - Recommend: Phase 13 gated on "everything shippable is shipped." Confirm at Wave 0.

4. **Stub vs live `/api/state` during screenshots?**
   - Live: real but non-deterministic
   - Stubbed: deterministic but synthetic
   - Recommend: **stubbed for main audit; one live pass at end for "real-life check"**

5. **Per-route scoring vs holistic?**
   - Recommend: **both.** Per-route heatmap + 1-paragraph holistic verdict.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 20+ | Next.js, Playwright | ✓ | ^20 | — |
| pnpm | package manager | ✓ | — | npm works too |
| Chromium (Playwright) | screenshots | ✗ pre-install | — | `pnpm exec playwright install chromium` |
| GitHub OAuth account | storageState capture | assumed ✓ | Eric's | JWT injection fallback (§2) |
| `pnpm build` clean | audit run | ✓ expected | — | Fix build before Wave 1 |
| Disk (~200 × 500KB ≈ 100MB) | screenshots | ✓ | — | Gitignored anyway |

No blocking gaps.

---

## Sources

### Primary (HIGH)
- `docs/UI-SPEC.md` — project design law
- `/root/.claude/agents/gsd-ui-auditor.md` (480 lines, verified)
- `/root/.claude/agents/gsd-ui-checker.md` (verified)
- `/root/.claude/get-shit-done/workflows/ui-review.md` (188 lines, verified)
- [WCAG 2.2 SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [Playwright Authentication docs](https://playwright.dev/docs/auth)
- [Anthropic Opus 4.7 pricing](https://platform.claude.com/docs/en/about-claude/pricing) / [launch post](https://www.anthropic.com/news/claude-opus-4-7)

### Secondary (MEDIUM)
- [Playwright + NextAuth (testdouble)](https://testdouble.com/insights/how-to-test-auth-flows-with-playwright-and-next-js)
- [axe + Playwright limitations (David Mello)](https://www.davidmello.com/software-testing/test-automation/playwright-accessibility-testing-axe-lighthouse-limitations)
- [playwright #19835 — networkidle hang](https://github.com/microsoft/playwright/issues/19835)
- [Turbopack memory #66326](https://github.com/vercel/next.js/issues/66326)
- [next-auth v5 Playwright #12179](https://github.com/nextauthjs/next-auth/issues/12179) / [playwright #21207](https://github.com/microsoft/playwright/issues/21207)
- [Refactoring UI key points (Medium)](https://medium.com/design-bootcamp/top-20-key-points-from-refactoring-ui-by-adam-wathan-steve-schoger-d81042ac9802)
- [Anthropic brand (not applicable)](https://github.com/anthropics/skills/blob/main/skills/brand-guidelines/SKILL.md)
- [Opus 4.7 tokenizer cost analysis](https://tokencost.app/blog/claude-opus-4-7-pricing)

### Tertiary (LOW — assumptions, see Assumptions Log)
- Opus vision token estimates per image
- Wave 3 sample count
- Batch size 8 specifically

---

## Metadata

**Confidence breakdown:**
- GSD infra audit: HIGH — files verified directly
- Playwright harness: HIGH — standard recipes
- Route enumeration: HIGH — `find` + grep verified
- 6-pillar rubric: HIGH — UI-SPEC + WCAG locked
- Opus prompt designs: MEDIUM — reasonable but untested on this codebase
- Token budget: MEDIUM-LOW — tokenizer bump makes priors unreliable
- Self-critique value: MEDIUM — principle sound, specific impl unproven

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (Playwright cadence ~weekly; UI-SPEC + WCAG stable for years)
