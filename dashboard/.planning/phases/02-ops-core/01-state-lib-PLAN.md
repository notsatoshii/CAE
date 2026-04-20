---
phase: 2
plan: A
wave: 1
name: Wave 1 — state-reader lib (server-only)
---

# Wave 1 — State reader library

**Goal:** Server-only TypeScript module that reads CAE state from disk. No UI yet. Consumed by later waves.

<task id="1">
<name>Create lib/cae-state.ts with disk readers</name>
<files>/home/cae/ctrl-alt-elite/dashboard/lib/cae-state.ts, /home/cae/ctrl-alt-elite/dashboard/lib/cae-config.ts</files>
<action>
Work at `/home/cae/ctrl-alt-elite/dashboard/`.

1. Create `lib/cae-config.ts`:
   - export constants `CAE_ROOT = "/home/cae/ctrl-alt-elite"`, `INBOX_ROOT = "/home/cae/inbox"`, `OUTBOX_ROOT = "/home/cae/outbox"`. These are dev-fixed absolute paths; override via env later if needed.

2. Create `lib/cae-state.ts` exporting:

   - `listPhases(projectRoot: string): Promise<Phase[]>` — scans `<projectRoot>/.planning/phases/NN-*/` dirs. Returns `{ number, name, planFiles: string[], status: 'idle' | 'active' | 'done' | 'failed' }`. Status inferred from: presence of `CAE-SUMMARY.md` (done), recent writes to `.cae/metrics/circuit-breakers.jsonl` referencing this phase (active), errors in summary (failed), else idle.

   - `listProjects(): Promise<Project[]>` — hard-coded for now: the CAE repo itself, the dashboard subdir (nested project), plus scan of `/home/cae-dashboard/` (if exists), `/tmp/bridge-test-repo/`. Return `{ name, path, hasPlanning: boolean }`.

   - `listInbox(): Promise<InboxTask[]>` — scans `INBOX_ROOT/*/` dirs. Returns `{ taskId, createdAt, buildplanPath, metaPath, hasBuildplan: boolean }`.

   - `listOutbox(): Promise<OutboxTask[]>` — scans `OUTBOX_ROOT/*/` dirs. Returns `{ taskId, hasDone, processed, status?, summary?, branch?, commits?: string[] }` (parse DONE.md frontmatter if present).

   - `tailJsonl(path: string, limit: number = 100): Promise<any[]>` — reads last N lines of a jsonl file and JSON-parses each. Tolerant of malformed lines.

   - `getCircuitBreakerState(projectRoot: string): Promise<CbState>` — parse the tail of `.cae/metrics/circuit-breakers.jsonl` to compute current state: `{ activeForgeCount, activeTaskIds[], recentFailures, recentPhantomEscalations, halted: boolean }`.

3. Define all types (`Phase`, `Project`, `InboxTask`, `OutboxTask`, `CbState`) in the same file or a sibling `lib/cae-types.ts`.

4. Use Node `fs/promises` + `yaml` (install: `pnpm add yaml`). No client-side code — these are server-only utilities.

5. Do NOT create any UI, routes, or server actions yet. Just the lib + types.

6. Run `pnpm build` — must pass with zero type errors.

7. Commit: `feat(lib): cae-state disk readers for phases/projects/inbox/outbox/metrics`.
</action>
<verify>
cd /home/cae/ctrl-alt-elite/dashboard && test -f lib/cae-state.ts && test -f lib/cae-config.ts && grep -q listPhases lib/cae-state.ts && grep -q listInbox lib/cae-state.ts && grep -q '"yaml"' package.json && pnpm build 2>&1 | grep -E "Compiled" | head -1
</verify>
</task>
