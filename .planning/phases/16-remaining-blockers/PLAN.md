---
phase: 16
plan: Complete remaining Phase 15 blockers (chat hydration, loading screens, herald docs)
wave: 1
name: Phase 16 Wave 1 — Hydration + Loading Screens + Herald
---

<task id="1" owner="ARCH">
### Task 1: Design chat hydration + loading screen architecture

**Input:**
- /chat page hydration warning from ROADMAP (lines 379-390)
- Loading screen requirements (lines 370-377)
- Current floor/chat/memory/metrics components
- app/loading.tsx structure

**Deliverable:**
ARCHITECTURE-amendments.md covering:
1. Chat hydration fix: either mount-gate labelFor() or server-side cookie read
2. Loading screen design: Pikachu sprite + per-route suspense fallback
3. Herald docs integration: post-phase hook execution point

**Context:**
- useDevMode() is causing SSR mismatch on mobile/wide (not laptop)
- labelFor(dev) must match between server + client render
- Loading.tsx should use existing Pikachu asset (Eric session-14 preference)
- Herald should auto-generate after phase completion

**Acceptance:**
- Design doc covers all 3 scenarios
- Decouples hydration fix from loading screens (can ship independently)
- Herald integration point identified
</task>

<task id="2" owner="FORGE">
### Task 2: Fix chat hydration warning (useDevMode mount-gating)

**Input:**
- /home/cae/ctrl-alt-elite/dashboard/app/chat/chat-layout.tsx
- /home/cae/ctrl-alt-elite/dashboard/lib/providers/dev-mode.ts
- ROADMAP lines 379-390

**Change:**
In chat-layout.tsx:
1. Move labelFor(dev) call behind useEffect + state
2. OR: Read dev-mode from cookie on server side + pass as prop
3. Ensure aria labels match between SSR + client render

**Test:**
- Build floor page (no warnings)
- Navigate to /chat with `?dev=1` param
- Check browser console for hydration warnings
- Verify labels render correctly on mobile + wide viewports

**Acceptance:**
- No hydration warnings in console
- Aria labels consistent across viewports
- Fallback shows correct label before React mounts
</task>

<task id="3" owner="FORGE">
### Task 3: Implement loading screens (Pikachu + suspense fallback)

**Input:**
- User preference: keep Pikachu from app/loading.tsx (session-14)
- Current public/brand/ assets
- app/chat/page.tsx, app/memory/page.tsx, app/metrics/page.tsx, app/floor/page.tsx
- app/layout.tsx + app/loading.tsx structure

**Change:**
1. Create per-route loading.tsx files that return Pikachu spinner
2. Update root app/loading.tsx to ensure Pikachu displays
3. Add Suspense boundaries around slow routes (chat, memory, metrics)
4. Test cold boot + route transitions

**Design:**
- Pikachu centered, animated (scale/bounce or fade)
- Dark theme matching dashboard (--bg, --text-dim)
- ~2-3 second timeout before skeleton replaces spinner
- Fallback skeleton: shimmer bars for content areas

**Test:**
- Cold boot /chat → see Pikachu → content loads
- /floor → no loading screen (fast)
- /memory → Pikachu → content
- Network throttle (3G) → Pikachu visible for 3+ seconds

**Acceptance:**
- Pikachu displays within 100ms of navigation
- Content loads behind it (no flash)
- Matches Eric's "alive and working" brand moment
</task>

<task id="4" owner="SCRIBE">
### Task 4: Integrate Herald auto-docs (post-phase hook)

**Input:**
- ROADMAP lines 402-409
- .planning/phases/16-*/SUMMARY.md structure
- CAE herald CLI (cae herald <doc-type>)
- Git workflow (main branch, push to origin)

**Change:**
1. Add post-phase hook in .planning/phases/16-*/SUMMARY.md
2. Hook runs: `cae herald README && cae herald ARCHITECTURE && git push origin main`
3. OR: Pre-commit hook in .git/hooks/pre-push that auto-runs herald

**Test:**
- Complete phase 16
- Verify README/ARCHITECTURE refreshed
- Verify commit pushed to origin
- Check git log for Herald updates

**Acceptance:**
- Herald runs after each phase automatically
- Docs stay fresh without manual intervention
- Git push happens on handoff
</task>
