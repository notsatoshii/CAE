---
phase: 18
plan: WC-security-skills-pages
wave: 3
name: Add filtering and grouping to Security and Skills pages
---

# WC — Security & Skills Page UX

## Context

Security page: 70+ items in a flat ungrouped list, all flagged red. Skills page: 68 identical cards with no categorization, redundant "local" badge on every card. Both are unusable at scale.

Reference: `/home/timmy/cae-dashboard-visual-audit.md` items #8-9

## Task

<task>
<name>Add search, filtering, and grouping to Security and Skills pages</name>

<files>
app/build/security/**/*.tsx
app/build/skills/**/*.tsx
components/security/**/*.tsx
components/skills/**/*.tsx
</files>

<action>
**Security page:**
1. Add a search bar at the top (filters by skill/rule name).
2. Add a summary dashboard row: "X critical · Y high · Z medium · W low" with color-coded badges.
3. Group items by severity (Critical first, then High, Medium, Low) with collapsible sections.
4. Use graduated severity colors: red for critical, orange for high, yellow for medium, gray for low. NOT everything red.
5. Add brief explanations of what scores mean (tooltip or legend).

**Skills page:**
1. Add a search bar at the top.
2. Group skills by category (the categories exist in the skill data — e.g., "creative", "devops", "mlops", "research"). Show category headers.
3. Remove the redundant "local" badge from every card (if all are local, the badge adds no information).
4. Differentiate card visuals: use category-colored left border or icon to break up the wall of identical cards.
</action>

<verify>
1. Security page has a working search bar and severity summary.
2. Skills page has a working search bar and category grouping.
3. Both are usable with 70+ items — you can find what you're looking for in under 5 seconds.
4. `pnpm vitest run` — all green.
</verify>
</task>