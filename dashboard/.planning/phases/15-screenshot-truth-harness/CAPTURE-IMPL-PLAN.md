# Cycle 20 — Capture + Scoring Implementation Bridge

OVERHAUL-PLAN + TEST-PLAN spec the methodology. This document bridges spec → actual code.

## Goal

Reproducible capture+score harness that produces, per route × viewport × auth × fixture cell:
- Full-page PNG
- Console log (errors + warnings + page errors)
- DOM snapshot (data-truth annotations extracted)
- Clickwalk JSON (interactive elements visited + state changes)
- Per-cell SCORES.md row across 7 pillars × 6 personas

## Code structure

```
dashboard/audit/
├── README.md                       — what this is, how to run
├── runner.ts                       — orchestrator
├── playwright.config.ts            — projects/fixtures/baseURL
├── auth/
│   ├── mint-session.ts             — sign JWT for headless capture
│   └── storage-state.json          — generated session cookie state (gitignored)
├── fixtures/
│   ├── empty.ts                    — seed .cae/* with empty state
│   ├── healthy.ts                  — 30 events / 5 phases / 3 agents working
│   ├── degraded.ts                 — slow/erroring scenarios
│   └── broken.ts                   — corrupted JSONL / missing files
├── routes.ts                       — central list of routes to capture
├── personas.ts                     — 6 persona configs (cookie/role/explainMode)
├── viewports.ts                    — laptop/wide/mobile dims
├── score/
│   ├── pillars.ts                  — 7 pillar checkers
│   ├── rubric.ts                   — score 1-5 anchors
│   └── llm-vision.ts               — opus-4-7 vision call per PNG
├── scrape/
│   ├── data-truth.ts               — extract data-truth attributes
│   └── clickwalk.ts                — drive every interactive element
├── reports/
│   └── (auto-generated per cycle)
└── shots/                          — gitignored
```

## Implementation waves

### Cap.1 — Auth harness (mint-session)

**File:** `audit/auth/mint-session.ts`

```ts
import { sign } from "jsonwebtoken";
import { writeFileSync } from "fs";

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
if (!NEXTAUTH_SECRET) throw new Error("NEXTAUTH_SECRET required");

const claims = {
  email: "harness@cae.local",
  role: "admin",
  sub: "harness",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};
const token = sign(claims, NEXTAUTH_SECRET);

writeFileSync("audit/auth/storage-state.json", JSON.stringify({
  cookies: [{
    name: "next-auth.session-token",
    value: token,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }],
  origins: [],
}, null, 2));
console.log("storage-state.json written");
```

**Tests:** validate cookie shape, verify NextAuth accepts the token by hitting /api/auth/session.

### Cap.2 — Fixture seeders

For each of 4 fixture states, write a script `audit/fixtures/<name>.ts` that writes deterministic JSONL into a tmp `.cae/metrics/`:
- empty: 0 lines per file
- healthy: 30 forge_begin/end pairs, 3 distinct agents, last 5 minutes of activity
- degraded: 30 events, 5 with errors, slow latencies, 1 agent missing tokens
- broken: malformed JSONL lines, missing files, invalid JSON

**Tests:** seed → read state aggregator → verify expected counts.

### Cap.3 — Playwright runner

**File:** `audit/runner.ts`

```ts
import { test } from "@playwright/test";
import { ROUTES } from "./routes";
import { VIEWPORTS } from "./viewports";
import { PERSONAS } from "./personas";

const FIXTURE = process.env.FIXTURE ?? "healthy";

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    for (const persona of PERSONAS) {
      test(`${FIXTURE} × ${route.path} × ${viewport.name} × ${persona.name}`, async ({ page, context }) => {
        await context.addCookies(persona.cookies);
        await page.setViewportSize(viewport.size);
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");
        // Capture
        await page.screenshot({ path: `audit/shots/${FIXTURE}/${route.slug}--${viewport.name}--${persona.name}.png`, fullPage: true });
        // DOM snapshot
        const truthAttrs = await page.locator("[data-truth]").evaluateAll(els => els.map(e => ({key: e.getAttribute("data-truth"), value: e.textContent})));
        await fs.writeFile(`audit/shots/${FIXTURE}/${route.slug}--${viewport.name}--${persona.name}.truth.json`, JSON.stringify(truthAttrs, null, 2));
        // Console
        // (collected via beforeEach pageError listener)
      });
    }
  }
}
```

**Tests:** runner produces expected file count; resilient to navigation errors (404s captured not fatal).

### Cap.4 — Pillar scoring

**File:** `audit/score/pillars.ts`

For each pillar (truth/depth/liveness/voice/craft/reliability/IA):
- Function `(captureCell) => 1 | 2 | 3 | 4 | 5`
- Truth: compare data-truth.json to fixture's expected — exact match = 5, drift > 5% = lower
- Depth: count rendered field count vs source field count; ≥80% = 5
- Liveness: count fixture states present (loading/empty/healthy/stale/error) — 5/5 = 5
- Voice: regex check empty/error copy strings against banned patterns
- Craft: defer to LLM-vision per pillar rubric
- Reliability: 0 console errors = 5
- IA: navigation reachability via clickwalk

### Cap.5 — LLM-vision pillar audit

**File:** `audit/score/llm-vision.ts`

For each captured PNG, call opus-4-7 with prompt:
```
You are scoring a dashboard route screenshot against the [PILLAR] rubric.
Score 1-5. Return JSON: {score, evidence, recommendations}.
Anchors: 5 = indistinguishable from Linear, 1 = 1995 admin panel.
```

Cache by image hash to avoid re-scoring identical captures.

### Cap.6 — Clickwalk

**File:** `audit/scrape/clickwalk.ts`

Drive every interactive element from each route's landing state. For each:
- Capture pre-click DOM
- Click
- Wait for stable
- Capture post-click DOM
- Diff DOM, log state change

Output: `audit/shots/<fixture>/<route>--clickwalk.json` with array of {element_selector, action, before_state, after_state, error_if_any}.

### Cap.7 — Cycle orchestrator

**File:** `audit/runner.ts` extended

```bash
audit/run-cycle.sh C1 healthy laptop founder
```

Runs full matrix, generates `audit/reports/C1-SCORES.md` + `C1-FINDINGS.md`. After each cycle: cumulative `audit/reports/CYCLE-DELTA.md` showing improvement vs prior cycle.

### Cap.8 — Fix gate

Before any wave is "done":
- Re-run capture for affected routes
- Score must improve from prior cycle (no regressions)
- LLM-vision findings count must decrease

## Privacy + cost

- Auth harness only mints session for localhost — no production access
- LLM-vision: opus-4-7 calls, ~50 PNGs per cycle × $X/img → budget $20-50/cycle
- All artifacts gitignored except SCORES.md + FINDINGS.md

## Owner

Single agent for Cap.1-Cap.4 first (foundation). Cap.5 separately (LLM-vision). Cap.6-Cap.7 once foundation works. Cap.8 is a CI gate added later.

## When to ship

After Wave 2 lands so the harness scores against improved-aesthetic baseline, not the legacy ugly version.
