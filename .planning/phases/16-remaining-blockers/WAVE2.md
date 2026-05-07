---
phase: 16
plan: Complete remaining Phase 15 blockers (chat hydration, loading screens, herald docs)
wave: 2
name: Phase 16 Wave 2 — Restore Pikachu + Landing Screens
---

<task id="5" owner="FORGE">
### Task 5: Restore Pikachu loading screen (app/loading.tsx)

**Input:**
- Pikachu version from commit 44cadac
- /public/pikachu-loading.gif (already available, 19KB)
- Current app/loading.tsx (three-dot pulse)
- Master preference: Pikachu as suspense fallback

**Change:**
Replace app/loading.tsx with Pikachu version from 44cadac:
- Arrow-key interactive (← → to move)
- "Loading..." + "CTRL + ALT + ELITE" text
- Dark theme (uses CSS vars --bg, --text, --text-muted)
- Centered in viewport (min-h-[calc(100vh-40px)])

**Test:**
- Load /chat (fast route) — Pikachu shows briefly
- Load /memory (slow route) — Pikachu visible for 2+ seconds
- Press left/right arrows — Pikachu moves ±25px
- No console errors
- Matches --bg theme (not white box on dark)

**Acceptance:**
- Pikachu loads immediately
- Arrow key interaction works
- Disappears when route content loads
- Matches Eric's brand preference
</task>

<task id="6" owner="FORGE">
### Task 6: Add per-route Suspense skeletons (chat, memory, metrics)

**Input:**
- Per-route loading.tsx pattern (next.js suspense)
- Component-specific skeleton shapes
- Master preference: per-component skeletons + Pikachu root fallback

**Change:**
1. Create app/chat/loading.tsx → ChatPanel skeleton (message list bars)
2. Create app/memory/loading.tsx → Memory document skeleton (text blocks)
3. Create app/metrics/loading.tsx → Metrics dashboard skeleton (stat cards)
4. Each skeleton should match content layout (shimmer animation optional)

**Design:**
- Skeleton bars with --text-dim background + opacity-20
- Approximate height/width of real content
- No animation (static shimmer OK)
- Dark theme consistent with app

**Test:**
- Slow-load /chat → Pikachu shows, then ChatPanel skeleton, then content
- Slow-load /memory → Pikachu → skeleton → content
- /floor (fast) → Pikachu barely visible, direct to canvas
- Network throttle (3G) → visible progression

**Acceptance:**
- 3 per-route loading.tsx files created
- Skeleton shapes approximate real content
- Progressive loading path visible
- No blank white screen between Pikachu and content
</task>
