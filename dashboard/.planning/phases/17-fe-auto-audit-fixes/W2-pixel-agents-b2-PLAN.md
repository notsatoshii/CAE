---
phase: 17
plan: W2-pixel-agents-b2
wave: 2
name: Fix B2 — pixel-agents empty scene on /floor despite canvas mount + sprites 200 OK
---

# W2 — B2 pixel agents empty floor

## Context

From Session 14: `/floor` canvas mounts, sprites return 200. But there are zero rendered agents. Cause: scene-builder reads `circuit-breakers.jsonl` `forge_begin` events to materialize agents; if the file has no events (fresh sessions), the floor is empty. Scale bumps don't help an empty scene.

## Task

<task>
<name>Seed dev-mode fake events so /floor always has animated agents; audit the real event-adapter too</name>

<files>
lib/floor/event-adapter.ts
lib/floor/scene-builder.ts
lib/floor/event-adapter.test.ts
app/floor/page.tsx
components/floor/**/*.tsx
</files>

<action>
1. Read `lib/floor/event-adapter.ts`. Confirm: how do `forge_begin` / `tool_call` / `forge_complete` events become pixel-agent scene entities?
2. In dev/healthy-fixture mode, inject 4–6 synthetic agents into the scene when the real event stream produces zero entities within 2s. Synthetic agents animate between desks with light work/idle cycles.
   - Gate injection on `NODE_ENV === "development"` OR `FIXTURE === "healthy"` OR explicit `?demo=1` query param.
   - Keep production untouched: if real events exist, real events win.
3. Verify scale bump from commit 16cedb8 actually wires through: sprites render at 3× expected pixel dims (measure in devtools element panel).
4. Add a `liveness` data-truth marker on `/floor`: `floor.agents-count` + `floor.scene-state`. Populated whether agents are real or synthetic.
5. Update `audit/fixtures/healthy.ts` + the expected truth dict to match (new keys).
6. If sprites still "look like trash" at 3×, bump to 4× AND document the dim in `lib/floor/constants.ts` so future tweaks are single-edit.
</action>

<verify>
1. `pnpm vitest run lib/floor` — green.
2. Open http://localhost:3002/floor in dev — see 4–6 agents moving, not empty.
3. Re-run audit. Truth pillar on /floor must score ≥4; depth pillar ≥4.
4. `audit/score/pixel-agents-smoke.spec.ts` must still pass.
</verify>
</task>
