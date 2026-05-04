---
phase: 20
plan: 03-skills-timestamps
wave: 2
name: Skills tab — per-skill last-updated + recent edits timeline
---

# 03-skills-timestamps — Add timestamps to Skills tab

## Context
`/build/skills` shows a static catalog with no temporal data. Need per-skill
last-updated timestamps and a recent edits timeline. Source from git log on
skill directories or a skills-changelog.jsonl if it exists.

## Task

<task>
<name>Add last-updated timestamps and recent edits to skills</name>

<files>
app/build/skills/page.tsx
app/build/skills/**/*.tsx
components/skills/**/*.tsx
lib/skills/last-updated.ts
lib/cae-skills-local.ts
app/api/skills/route.ts
</files>

<action>
1. Check if `lib/skills/last-updated.ts` exists — it may already have the logic.
2. For locally installed skills (in ~/.hermes/skills/), get the modification time of each SKILL.md file using fs.stat.
3. Add `lastUpdated` field to the skill list API response.
4. In the skills UI, display the last-updated timestamp on each skill card.
5. Add a "Recent edits" section or sort option that shows most recently modified skills first.
</action>

<verify>
1. `/build/skills` page shows a timestamp on each skill card.
2. Skills are sortable or show "recently edited" section.
3. `pnpm vitest run` passes.
</verify>
</task>

