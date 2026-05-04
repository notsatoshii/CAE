---
phase: 20
plan: 01-crypto-uuid
wave: 1
name: Fix crypto.randomUUID crash on non-secure context
---

# 01-crypto-uuid — Fix crypto.randomUUID crash

## Context
`crypto.randomUUID` throws when the page is served over HTTP (non-localhost).
The dashboard runs at http://165.245.186.254:3002 — no HTTPS.
Error: `crypto.randomUUID is not a function` at `components/chat/chat-panel.tsx:141` + `:147`.

## Task

<task>
<name>Replace crypto.randomUUID with a fallback</name>

<files>
components/chat/chat-panel.tsx
lib/safe-uuid.ts
</files>

<action>
1. Check if `lib/safe-uuid.ts` already exists — it may have a fallback. If so, import and use it.
2. If not, create `lib/safe-uuid.ts` with: try crypto.randomUUID(), catch fallback to crypto.getRandomValues-based UUID v4.
3. Replace all `crypto.randomUUID()` calls in `components/chat/chat-panel.tsx` with the safe import.
4. Search for any other `crypto.randomUUID` usage in the codebase and fix those too.
</action>

<verify>
1. `grep -rn 'crypto.randomUUID' components/ lib/ app/ --include='*.ts' --include='*.tsx'` returns 0 hits (all replaced).
2. `pnpm vitest run` passes.
3. `pnpm build` passes or at least no new errors related to UUID.
</verify>
</task>

