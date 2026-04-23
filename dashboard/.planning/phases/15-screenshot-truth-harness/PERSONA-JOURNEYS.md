# Cycle 21 — Persona Journey Scripts

Layer-3 of TEST-PLAN.md ("Discover tests"). Per-persona Playwright scripts that walk a critical user journey and assert no dead ends + < 4 clicks to any data.

These run in CI gate after capture harness foundation lands.

## P1 — First-time founder

**Mental model:** "I bought a tool to ship things; I don't know what's running."
**Critical journey:** sign in → land on /build → see what's happening → drill to active phase → read 3 useful fields → optional return to home.

**Script `audit/journeys/p1-first-time-founder.spec.ts`:**
1. goto /signin (no cookie)
2. expect: "Sign in to start shipping" + GitHub + Google CTAs visible
3. mock-sign in via mint-session as a fresh user
4. goto /build
5. expect: Mission Control hero visible above-fold with at least 1 tile non-zero
6. expect: LiveActivityPanel visible
7. expect: Floor pin visible top-right (desktop)
8. click "Active" tile → expect navigate to /build/agents
9. expect: at least 1 agent card with always-visible action row
10. click first agent → expect AgentDetailDrawer opens
11. expect drawer to render: persona, model, lifetime stats, sparklines, recent invocations
12. close drawer
13. assert: 0 console errors throughout
14. assert: ≤ 4 clicks total to reach a meaningful data point

**Pass criteria:** every step succeeds + 0 console errors + ≤ 4 clicks.

## P2 — Returning founder (week 2)

**Mental model:** "I shipped 3 things last week; what changed since I logged off?"
**Critical journey:** sign in → see "since you were gone" card immediately → drill to phase summary → drill to commits.

**Script `audit/journeys/p2-returning-founder.spec.ts`:**
1. seed `.cae/sessions/last-seen.json` with timestamp 36h ago
2. seed circuit-breakers.jsonl with 5 forge-pairs in last 36h
3. mock-sign in
4. goto /build
5. expect: SinceYouLeft card visible above-fold
6. expect: card says "5 phases shipped since you left" + "$N tokens" + "M commits"
7. click "phases shipped" → expect navigate to /build/history (or active phases for now)
8. expect: timeline showing the 5 phases with status pills
9. click most-recent phase → expect drill to phase detail
10. assert: 0 console errors

**Pass criteria:** SinceYouLeft visible after >1h absence + 0 dead links + meaningful drill exists.

## P3 — Operator / PM

**Mental model:** "I'm running workflows on behalf of the team; I need to see fleet state."
**Critical journey:** sign in → ⌘K palette → "run workflow" → 1 click to fire.

**Script `audit/journeys/p3-operator.spec.ts`:**
1. mock-sign in as operator role
2. goto /build
3. press Cmd+K (or Ctrl+K depending on platform mock)
4. expect: command palette opens
5. type "run workflow"
6. expect: matching results appear
7. press Enter on first result → expect: workflow form (or run dialog) opens
8. expect: form has visible "Run" button
9. assert: ≤ 3 clicks total
10. assert: no role-gated 403 visible to operator

**Pass criteria:** palette discoverable + 1-click fire + RBAC works.

## P4 — Senior dev (embedded engineer)

**Mental model:** "Founder asked me to debug; I need raw signal fast."
**Critical journey:** sign in → toggle Dev Mode → all panels show raw IDs / paths / SHAs.

**Script `audit/journeys/p4-senior-dev.spec.ts`:**
1. mock-sign in (admin)
2. goto /build
3. expect: dev-mode toggle visible (top-nav or settings)
4. click toggle → dev-mode ON
5. observe: at least 3 visible panels now show extra raw IDs / file paths / model names that weren't visible in founder mode
6. navigate /build/security/audit
7. expect: full payload of audit entries visible (not redacted)
8. click any audit entry → expect drill to full event
9. expect: jump-to-code link present in stack traces
10. click jump-to-code → expect vscode:// URL fires (or copy fallback)
11. assert: 0 console errors

**Pass criteria:** dev-mode toggle exists + raw context visible + audit drill complete + jump-to-code present.

## P5 — Admin / security reviewer

**Mental model:** "Audit. What did the agent actually do?"
**Critical journey:** sign in → /build/security/audit → see recent entries → click one → see full payload → role badge clearly admin.

**Script `audit/journeys/p5-admin.spec.ts`:**
1. mock-sign in as admin
2. goto /build/security/audit
3. expect: audit table renders with at least 1 row (seed if needed)
4. click first row → expect drill to entry detail
5. expect detail to show: timestamp, actor (with role pill), action, full event payload (collapsible JSON)
6. expect: filter pills visible (by tool kind, by actor)
7. click a non-admin user row (seed) → expect their role pill is "operator" not "admin"
8. assert: viewer role can't see this page (separate run as viewer → 403 redirect)

**Pass criteria:** audit table renders + drill complete + role visibility correct + RBAC enforced.

## P6 — Live spectator (Eric's lens)

**Mental model:** "I AM running this right now; show me MY agents working."
**Critical journey:** sign in → see Live Activity panel pulse + Floor pin showing named pixel agents → click an agent → see what it's doing.

**Script `audit/journeys/p6-live-spectator.spec.ts`:**
1. mock-sign in
2. seed circuit-breakers.jsonl with active forge_begin events (no matching forge_end yet)
3. seed tool-calls.jsonl with last-30s of tool calls
4. goto /build
5. expect: Mission Control "Active" tile shows N > 0
6. expect: LiveActivityPanel sparkline shows recent activity (non-flat last 60s)
7. expect: Floor pin renders FloorClient
8. expect: Floor heartbeat dot pulsing
9. (post Wave 9 sprite kit ships) expect: at least 1 named pixel agent visible
10. (post Wave 9) click agent sprite → expect agent drawer opens
11. assert: 0 console errors
12. assert: live indicators do NOT lie (if 0 active agents → tile shows 0, not stale "Active 3")

**Pass criteria:** liveness signals match seed + Floor visible + (post Wave 9) clickable named agents.

## Cross-journey assertions

After each persona journey:
- Console error count = 0
- LCP (Largest Contentful Paint) < 2.5s on landing
- No layout shift > 0.1
- All interactive elements keyboard-reachable (tab through verifies)
- prefers-reduced-motion respected (run journey in motion-reduced mode and verify no jarring transitions)

## CI integration

Add to package.json scripts:
```json
"test:journeys": "playwright test audit/journeys/"
```

PR-block on any journey failure. Per VISUAL-RESEARCH §6.

## When to ship

After capture harness Cap.1-Cap.4 lands (AUTH HARNESS + FIXTURES + RUNNER + SCORERS) — these journeys reuse the auth + fixture infrastructure.

Each journey ~50-100 lines. Total ~600 lines across 6 files. Ship as one commit per persona OR all 6 in one bundle.
