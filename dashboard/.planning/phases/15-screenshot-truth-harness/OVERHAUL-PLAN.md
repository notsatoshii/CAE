# Phase 15 — FE Overhaul + Truth Harness

**Mandate (Eric, 2026-04-23 session 9):** the dashboard "looks like garbage", "0 depth", "no character", logs/liveness lie, sidebar/sliders/fonts/colors all amateur. Original P15 scope (screenshot-truth-harness) preserved as one wave; phase scope expanded to total FE craft pass + structural overhaul.

This document is the **methodology** — what we review, how we review it, how we prove fixes landed. The 6 cycles below show the methodology being refined; each cycle is a real edit, not theater.

---

## Eric's complaint matrix (verbatim source signals)

| # | Complaint | Pillar | Verifiable how |
|---|-----------|--------|----------------|
| 1 | "0 depth", "shipped tasks show 0 info" on detail expand | Information density | Open every detail-expand, count rendered fields vs available data |
| 2 | "no loading screen" | Missing states | Throttle network, capture each route's pre-data render |
| 3 | "no character" | Brand voice | Heuristic — does anything feel made by humans for humans? |
| 4 | "sidebar no expandable button for labels" | Navigation IA | Check sidebar collapse/expand behavior on every viewport |
| 5 | "fonts trash" | Type system | Audit font stack, weights, sizes, line-heights against modern system (Inter / Geist / IBM Plex / etc.) |
| 6 | "things break" | Reliability | Console errors per route; broken interactions |
| 7 | "pixel agents can't be seen anywhere" | Live Floor visibility | Find the Live Floor entry point; verify scene actually renders |
| 8 | "logs show 0 real info" | Telemetry surface | Open every log/tail panel; count meaningful lines vs noise/empty |
| 9 | "shit ton of errors" | Console health | grep DevTools per route, classify (own / dep / SSR-mismatch / network) |
| 10 | "dashboard shows nothing active when actively running" | Liveness/truthfulness | Cross-check rendered "active" state vs actual `.cae/breakers/*.jsonl` event stream |
| 11 | "recent builds show crap for history logs", "no clickthrough" | Detail-expand depth | Click every "recent build" row; verify expanded view contains meaningful log slice |
| 12 | "agent screens look like garbage" | Card composition | Visual diff every agent card vs SOTA references (Linear, Vercel, Railway, Resend, Supabase) |
| 13 | "color coding looks retarded not sleek/futuristic" | Visual language | Audit palette tokens, gradients, depth, accent usage |
| 14 | "tacky" | Polish | Border-radii consistency, spacing rhythm, shadow language, micro-interactions |
| 15 | "sliding bars in wrong places + look like trash" | Scrollbar treatment | Find every overflow container; check if scroll is intended; restyle scrollbars |

---

# Cycle 1 — initial review framework (draft)

## Six pillars of review

1. **Truth** — does displayed data match underlying state? (original P15 mandate)
2. **Depth** — do detail-expand/secondary views show meaningfully more than the summary?
3. **Liveness** — does the UI reflect real-time state? Loading, in-flight, fresh, stale.
4. **Voice** — does copy/empty-state/error messaging have a character?
5. **Craft** — typography, color, spacing, motion, scrollbars, focus rings, micro-interactions.
6. **Reliability** — console clean, no React errors, no broken interactions, no SSR mismatch.

## Method

For each route × viewport × auth-state:
1. Screenshot full page
2. Snapshot DOM (for `data-truth` annotations)
3. Capture console (errors + warnings + page errors)
4. Click-walk every interactive element, capture state change
5. For each pillar, score 1-5 and write a note

## Deliverables per route
- `audit/overhaul/<route>/full.png`
- `audit/overhaul/<route>/console.txt`
- `audit/overhaul/<route>/clickwalk.json`
- `audit/overhaul/<route>/SCORES.md`

## Aggregate
- `audit/overhaul/INDEX.md` — scores by pillar across all routes
- `audit/overhaul/FINDINGS.md` — every finding ranked P0/P1/P2

---

# Cycle 2 — self-critique of Cycle 1

**What's missing:**

1. **No reference baseline.** Scoring 1-5 against what? Need explicit comparison set: Linear, Vercel dashboard, Railway, Resend, Supabase, Render. Each pillar gets a "best-in-class" example.
2. **No information-architecture audit.** Eric's sidebar complaint isn't just visual — it's an IA gap (no labels, no expand). Pillar set missing **IA**.
3. **No detail-expand inventory.** Eric explicitly called out "shipped tasks show 0 info" — need exhaustive list of every clickable row × what it should expand into.
4. **No data-vs-presented gap.** What data EXISTS in the underlying state files but isn't shown in the UI? That's the "0 depth" root cause — we're rendering 5% of available data.
5. **No comparison to spec.** UI-SPEC.md / ARCHITECTURE.md describe features. What's spec'd but not visible?
6. **No empty/loading/error fixture pass.** Need to seed 4 fixture states: empty, loading (in-flight), healthy, broken. Capture each.
7. **Click-walk of "interactive elements" is too vague.** Need typed inventory: button | link | accordion | dialog | command | shortcut | drawer | tab.
8. **Cycle 1 has no fix-plan structure.** Findings → fixes mapping is missing.

---

# Cycle 3 — refined framework (incorporates Cycle 2)

## Seven pillars (was six)

1. **Truth** — data shown matches `.cae/` + `.planning/` state files
2. **Depth** — detail-expand contains ≥3× the information of the summary; clickthrough leads somewhere meaningful
3. **Liveness** — loading / fresh / stale / dead / errored states exist and visibly differ
4. **Voice** — copy reads like a human wrote it; empty/error states have personality not generic boilerplate
5. **Craft** — type, color, space, motion, scrollbar, focus, micro-interaction language consistent and SOTA
6. **Reliability** — 0 console errors, 0 React warnings, 0 SSR mismatches, 0 dead links, 0 broken handlers
7. **IA** — sidebar/topnav/breadcrumb/route hierarchy is discoverable; labels visible; no orphan pages

## Reference baseline (per pillar)

| Pillar | Best-in-class reference |
|--------|-------------------------|
| Depth | Linear issue detail, Vercel deployment detail |
| Liveness | Railway service status, GitHub Actions run progress |
| Voice | Resend dashboard empty states, Stripe error messages |
| Craft | Linear, Vercel, Resend (typography); Figma (color depth); Notion (motion) |
| IA | Linear sidebar (collapse + tooltip on hover); Vercel project sidebar |
| Truth | (no SOTA — own invariant) |
| Reliability | (no SOTA — 0 is 0) |

## Discovery passes (run in this order)

### Pass A — Inventory (no opinion)
- Route map: every URL the FE serves
- Component map: every named component + where it mounts
- Data-source map: every `.cae/` / `.planning/` file the FE reads
- Interactive-element map: every button/link/accordion/cmd/shortcut/drawer/tab

### Pass B — Capture (4 fixture states × 3 viewports × 2 auth-states)
- Fixtures: `empty`, `healthy`, `degraded`, `broken`
- Viewports: laptop (1440×900), wide (1920×1080), mobile (390×844)
- Auth: signed-out, signed-in (admin)
- Per cell: full-page PNG + console log + DOM snapshot + clickwalk.json

### Pass C — Spec-vs-shipped delta
- Read UI-SPEC.md, ARCHITECTURE.md, README.md, every phase HANDOFF
- For every spec'd feature: does it appear in capture set? Where?
- Output: SPEC-GAP.md with rows `feature → spec'd in → status (visible | hidden | missing | broken)`

### Pass D — Data-vs-rendered delta
- For every data source: enumerate fields available
- For every component reading the source: enumerate fields rendered
- Delta = unrendered data = depth gap
- Output: DATA-GAP.md

### Pass E — Pillar scoring
- For each pillar × route, score 1-5 with one-line evidence pointing at a capture
- Output: SCORES.md heatmap

### Pass F — Findings → fixes
- Every score ≤3 generates a finding
- Each finding mapped to: pure-CSS / restructure / new component / new data path / new copy
- Severity: P0 (lies / broken) > P1 (missing core craft) > P2 (polish)
- Output: FIX-PLAN.md

---

# Cycle 4 — adversarial: where would Eric still call this thin?

**Likely Eric pushback on Cycle 3:**

1. *"You scored my dashboard 4/5 on craft — bullshit, look at it."* → scoring is too subjective. Need anchored rubric per score: 5 = "indistinguishable from Linear"; 1 = "1995 admin panel". And every score ≤4 must include a screenshot crop showing the specific problem.
2. *"You audited the routes I navigate, missed the ones I don't because they're broken."* → Pass A must include orphan detection: routes that exist in the codebase but have no inbound link.
3. *"You compared to Linear but Linear's not the right reference."* → Each pillar needs Eric-confirmable reference. Add: which references would Eric himself cite as "this is what good looks like"? Resolve before scoring.
4. *"5-6 cycles of review and you still missed motion/sound/haptics."* → Add motion-language audit: what animates, how, easing, duration, reduced-motion fallback. Add sound: any? (Probably not — flag absence.)
5. *"You looked at single-page; you didn't look at the journey."* → Add user-journey passes: "first-time founder onboards", "operator deploys a workflow", "admin reviews audit log". Each journey is a sequence of routes/clicks; capture as continuous video/PNG-strip not isolated frames.
6. *"What about the dashboard's actual job — running CAE? Did you test that?"* → Add: end-to-end "fire a real workflow, watch every panel that should reflect it, check propagation latency + correctness."
7. *"How do I know fixes actually fixed?"* → Add: re-capture after each fix, diff vs baseline, attach to FIX-PLAN as evidence.

---

# Cycle 5 — operational reality check

**Constraints:**

- **Auth.** Same blocker as Phase 13: Playwright storage-state.json absent in headless env. ~70% of routes auth-gated. Two options:
  - (A) Defer auth-gated capture until Eric runs `authsetup.sh` once
  - (B) Use NEXTAUTH_SECRET to mint a session cookie programmatically for the test env only
  - **Decision:** Pursue (B) for harness; (A) acceptable as fallback. Will write `tests/auth/mint-session.ts` that creates a JWT signed with the dev NEXTAUTH_SECRET, drops it into Playwright context cookies. No Eric interaction required.

- **Dev server state mutation.** Seeding fixtures into `.cae/` mutates Eric's working state. Per Phase 15 original plan: spawn isolated test server on a random port with `CAE_HOME` pointed at a tmp dir. Confirm now: yes, mandatory.

- **Cycle bandwidth.** 5-6 cycles of full capture + score + fix would take days. **Front-load methodology cycles (this doc, no code) until locked, then 1 capture pass, then scored fix waves, then 1 re-capture cycle.** Not 5-6 capture cycles.

- **Reference comparison.** Cannot screenshot Linear/Vercel/etc. headlessly without violating their TOS / hitting auth. Use **published design-system docs + public-marketing screenshots** captured from each company's own /design-system or /docs page. Inline as JPGs in audit.

- **Fonts.** Currently using Geist Sans + Geist Mono via `next/font`. Eric says trash. Need Eric's call: stick with Geist (tweak weights/sizes/spacing) or swap to Inter / IBM Plex Sans / GT America / etc. Will propose 3 candidates with side-by-side captures.

- **Pixel agents.** Live Floor (Phase 11) is the pixel-agent surface. Eric "can't see them anywhere" — likely means: not surfaced in main IA. Currently entry is via top-nav `Floor` icon button. Possible fixes: pop-out button on every agent card → opens scoped Floor view of that agent.

---

# Cycle 6 — locked methodology

## Phases of execution (ordered)

1. **Inventory** — write `INVENTORY.md` (routes, components, data sources, interactive elements, orphans).
2. **Auth harness** — `tests/auth/mint-session.ts` produces signed cookie for headless capture.
3. **Reference set** — Eric confirms the 5 dashboards we benchmark against (default: Linear, Vercel, Railway, Resend, Supabase). Public design-system PNGs collected.
4. **Capture matrix** — 4 fixtures × 3 viewports × 2 auth = 24 cells per route. Per cell: PNG + console + DOM + clickwalk.
5. **Spec-vs-shipped delta** — `SPEC-GAP.md`.
6. **Data-vs-rendered delta** — `DATA-GAP.md`.
7. **Pillar scoring** — `SCORES.md` with rubric anchors + screenshot evidence per non-5 score.
8. **Journey passes** — onboarding / deploy-workflow / audit-log journeys captured as PNG-strip + journal.
9. **Findings + fix plan** — `FIX-PLAN.md` ranked P0/P1/P2 with severity, change-type, and effort.
10. **Eric checkpoint** — present FIX-PLAN, get pruning + ordering.
11. **Implementation waves** — atomic commits per fix, re-capture after each wave to prove fix landed.
12. **Re-score** — final pass against same rubric. Diff vs baseline. Anything still ≤3 gets a follow-up.

## Pillar scoring rubric (anchored)

| Score | Truth | Depth | Liveness | Voice | Craft | Reliability | IA |
|-------|-------|-------|----------|-------|-------|-------------|-----|
| 5 | Every value matches state | Detail = 3× summary, clickthrough deep | All 5 states (loading/fresh/stale/dead/error) explicit | Reads like Resend/Stripe | Indistinguishable from Linear | 0 errors, 0 warnings | Indistinguishable from Linear sidebar |
| 4 | Minor drift on edge cases | Detail = 2× summary | 4/5 states | Mostly human, some boilerplate | Minor inconsistencies | <3 warnings, 0 errors | Discoverable, minor friction |
| 3 | Some staleness | Detail ≈ summary | 3/5 states | Mixed boilerplate | Visibly amateur in places | <5 warnings, no breaks | Workable but unclear |
| 2 | Lies in places | Detail < summary | 2/5 states | Generic | Tacky | Errors present | Confusing |
| 1 | Lies pervasively | No detail | 1/5 states | Lorem-ipsum tier | "1995 admin panel" | Broken | Hidden / orphan |

## Fix-plan severity

- **P0** = truth/reliability score 1-2 (lies, breaks)
- **P1** = depth/liveness/IA score 1-2 (missing core)
- **P2** = voice/craft score 1-2 (polish)

P0 ships first. P1 next wave. P2 batched.

## User personas (Eric mandate: every cycle scored from multiple lenses)

Each audit cycle scores routes from each persona's POV. A route can score 5/5 for an admin and 1/5 for a first-time founder; both scores ship.

| # | Persona | Mental model | What they want | What breaks them |
|---|---------|--------------|---------------|------------------|
| P1 | **First-time founder** | "I bought a tool to ship things; I don't know what's running" | Unambiguous "what is happening right now"; one-click to action | Tech jargon, empty states with no CTA, hidden navigation |
| P2 | **Returning founder (week 2)** | "I shipped 3 things last week; what changed since I logged off?" | Diff since last visit; activity timeline; trust signals | Stale data, missing changes, no "since you were gone" surface |
| P3 | **Operator / PM** | "I'm running workflows on behalf of the team; I need to see fleet state" | Multi-project view, queue depth, who's blocked | Single-project tunnel vision, no batch ops, no SLA surface |
| P4 | **Senior dev (the embedded engineer)** | "Founder asked me to debug; I need raw signal fast" | Logs, traces, SSE streams, JSON dumps, jump-to-code | Founder-speak hiding the actual error, no copy-as-cURL, no permalink to log line |
| P5 | **Admin / security reviewer** | "Audit. What did the agent actually do?" | Full audit log, RBAC visibility, every tool call recorded | Missing audit hook, redaction holes, role badge unclear |
| P6 | **Live spectator (Eric's specific lens)** | "I AM running this right now; show me MY agents working" | Live floor with named agents, real-time event stream, cost ticker, "you are here" indicator | "Nothing active" copy when something IS active (the explicit complaint) |

Persona scoring runs as a 7×6 matrix (pillars × personas) per route. A route's bottleneck is the lowest cell.

## Audit→fix cycles after implementation (Eric mandate: 4-6 full cycles, not just R-prefix)

Each **C-cycle** is a complete loop: capture → score → critique → fix → recapture. Not bucketed by pillar (R1-R6 above are now superseded).

- **Cycle C1 — baseline.** Full capture matrix + all 7 pillars × all 6 personas scored. Output: `C1-SCORES.md` + `C1-FINDINGS.md`. Ship P0 fixes only this cycle (truth + reliability).
- **Cycle C2 — depth + IA pass.** Recapture, re-score. Focus fix wave on detail-expand depth, sidebar IA, loading states. Ship as wave C2-fix.
- **Cycle C3 — craft pass.** Recapture, re-score. Fix wave on type system, color, scrollbars, micro-interactions. Ship as wave C3-fix.
- **Cycle C4 — voice + character pass.** Recapture, re-score. Fix wave on copy, empty/error/loading character, brand voice. Ship as wave C4-fix.
- **Cycle C5 — adversarial cross-persona.** Each persona walks a critical journey end-to-end. Score from THAT persona's lens. Fix wave addresses persona-specific bottlenecks (e.g., P6 "live spectator" gets the named-agents-on-floor + active-now panel).
- **Cycle C6 — Eric live walkthrough.** Eric drives, captures complaints in real-time, harness records the walk. Final fix wave addresses Eric's residual complaints.

If after C6 any route × persona × pillar is still ≤3, **add C7+ cycles until none are**. No predetermined ceiling.

---

# Open questions for Eric

1. **Reference set** — Linear / Vercel / Railway / Resend / Supabase as the 5 benchmarks, or swap any?
2. **Font** — keep Geist (tune) or swap to Inter / IBM Plex Sans / Söhne / GT America? Will propose with side-by-side.
3. **Pixel agents surface** — main floor only, or per-agent-card pop-out into scoped floor view?
4. **Sidebar** — Linear-style collapse with hover-tooltip labels, or always-expanded with section headers?
5. **Color identity** — current cyan accent: keep, soften, or swap? (Will mock 3 alternatives.)
6. **Scrollbar treatment** — hide entirely (overlay scroll like macOS) or styled-thin like Linear?
7. **Loading character** — skeleton screens (Vercel-style) or typed-shimmer (Linear-style) or branded animated (own character)?

---

# Status

- [x] Methodology drafted (Cycle 1)
- [x] Self-critique (Cycle 2)
- [x] Refined framework (Cycle 3)
- [x] Adversarial check (Cycle 4)
- [x] Operational reality (Cycle 5)
- [x] Locked methodology (Cycle 6)
- [x] Personas added + audit-cycles redefined as C1–C6+ (post-Eric clarification)
- [ ] Eric answers 7 open questions (or auto-defaults applied)
- [ ] Inventory pass
- [ ] Auth harness shipped
- [ ] C1: baseline capture + score + P0 fix wave
- [ ] C2: depth + IA fix wave
- [ ] C3: craft fix wave
- [ ] C4: voice + character fix wave
- [ ] C5: persona cross-walk fix wave
- [ ] C6: Eric live walkthrough fix wave
- [ ] C7+: only if any cell still ≤3
