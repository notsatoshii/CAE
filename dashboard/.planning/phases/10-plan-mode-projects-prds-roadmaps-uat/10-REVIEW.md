---
phase: 10-plan-mode-projects-prds-roadmaps-uat
reviewed: 2026-04-23T00:00:00Z
depth: deep
files_reviewed: 13
files_reviewed_list:
  - dashboard/lib/cae-shift.ts
  - dashboard/lib/cae-plan-gen.ts
  - dashboard/lib/cae-uat.ts
  - dashboard/lib/cae-ship.ts
  - dashboard/lib/cae-plan-home.ts
  - dashboard/lib/cae-state.ts
  - dashboard/lib/cae-types.ts
  - dashboard/lib/cae-shift.test.ts
  - dashboard/lib/cae-plan-gen.test.ts
  - dashboard/lib/cae-uat.test.ts
  - dashboard/lib/cae-ship.test.ts
  - dashboard/lib/cae-plan-home.test.ts
  - dashboard/lib/cae-state.test.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-04-23
**Depth:** deep
**Files Reviewed:** 13 (6 libs + 6 tests + 1 types extension)
**Status:** issues_found (no P0; 2xP1, 1xP2, 5xP3)

## Summary

Phase 10 ships six server-only TypeScript libs wrapping the Shift v3.0 CLI — intake wizard, PRD/ROADMAP gate approval, auto plan-gen, UAT state management, ship wizard, and a Plan-home aggregator. The code is well-structured, consistently documented, and security-conscious: every shell interpolation touching user-controlled or env-derived data flows through a POSIX `quote()` helper, user-controlled names are regex-validated before use, the answers file and `.env.local` are both created with mode `0o600` (with a defensive `chmod` follow-up), and `resolveProject` enforces a whitelist-by-reference-equality pattern that neutralises path traversal.

No P0 blockers. The three meaningful findings are:
1. **P1 (W-01)** — `runShiftNew` writes its tee log to a path inside the project directory that does **not yet exist** when tmux spawns. Depending on Shift CLI startup ordering, early log output may be lost or the pipeline may break on `SIGPIPE`. Prepend `mkdir -p` (as both `runGhRepoCreate` and `runCaeExecutePhase` already do).
2. **P1 (W-02)** — `writeEnvLocal` in `cae-ship.ts` does not itself call `validateShipInput` and does not escape newlines in values. A caller who forgets the validation step could inject extra env vars via a key or value containing `\n`. Add defence-in-depth inside `writeEnvLocal` itself: reject `\n` / `=` in keys, and quote or reject values containing `\n`.
3. **P2 (W-03)** — `loadUatState` preserves `prior.orphaned` verbatim when merging. If a bullet was flagged orphan (removed from ROADMAP), then later re-added verbatim, the re-surfaced id will still carry `orphaned: true`. Clear the flag on the re-match path.

All P3 findings are minor: non-null assertions in overload implementations, a redundant-but-harmless regex cleanup, missing invariant docs, precondition-only error paths, and an unused timestamp precision mismatch.

Shell safety was verified end-to-end: the three spawn sites in `cae-shift.ts`, the two in `cae-ship.ts`, and the one in `cae-plan-gen.ts` all use `quote()` around every caller-controlled or env-derived interpolation. Constants (`SHIFT_BIN`, `CAE_BIN`, `PLAN_GEN_MODEL`) and integer-validated phaseNum are safe to interpolate raw.

## Warnings

### WR-01: `runShiftNew` logFile path does not exist when tee is spawned (P1)

**File:** `dashboard/lib/cae-shift.ts:160-177`
**Issue:**
```ts
const projectPath = join(SHIFT_PROJECTS_HOME, name);
// logFile goes in the project root, not .shift/, because .shift/ won't exist yet
const logFile = join(projectPath, ".shift-bootstrap.log");

const inner =
  `cd ${quote(SHIFT_PROJECTS_HOME)} && ` +
  `SHIFT_NONINTERACTIVE=1 SHIFT_ANSWERS=${quote(answersFile)} ` +
  `${SHIFT_BIN} new ${quote(name)} 2>&1 | tee ${quote(logFile)}`;
```
The comment acknowledges `.shift/` won't exist — but `projectPath` itself also won't exist at the moment `tee` is spawned. `tee` opens `logFile` at startup; when the parent directory is missing, `tee` fails with `ENOENT`, writes an error to stderr, and exits. The upstream `shift new` process then takes `SIGPIPE` on its next write, which Python's default handler turns into a `BrokenPipeError` that may or may not crash the intake depending on how Shift handles stdout. Either way the bootstrap log — the one artifact needed to diagnose a failed intake — is lost.

Compare `runGhRepoCreate` (line 110) and `runCaeExecutePhase` (line 126), both of which correctly prepend `mkdir -p ${quote(logDir)} && cd ...`. `runShiftNew` and `runShiftNext` skip this step.

**Fix:**
```ts
const inner =
  `mkdir -p ${quote(projectPath)} && ` +
  `cd ${quote(SHIFT_PROJECTS_HOME)} && ` +
  `SHIFT_NONINTERACTIVE=1 SHIFT_ANSWERS=${quote(answersFile)} ` +
  `${SHIFT_BIN} new ${quote(name)} 2>&1 | tee ${quote(logFile)}`;
```
Apply the same `mkdir -p ${quote(dirname(logFile))}` pattern to `runShiftNext` (line 188-196) — its current "assumes `.shift/` already exists" precondition is a footgun if a caller invokes it on a partially-initialised project.

---

### WR-02: `writeEnvLocal` lacks defence-in-depth against key/value newline injection (P1)

**File:** `dashboard/lib/cae-ship.ts:87-94`
**Issue:**
```ts
export async function writeEnvLocal(proj: Project, values: Record<string, string>): Promise<string> {
  const file = join(proj.path, ".env.local")
  const body = Object.entries(values).map(([k, v]) => `${k}=${v}`).join("\n") + "\n"
  await writeFile(file, body, { encoding: "utf8", mode: 0o600 })
  await chmod(file, 0o600)
  return file
}
```
`validateShipInput` (line 49) validates keys against a whitelist, but it does **not** validate values — and `writeEnvLocal` accepts arbitrary `Record<string, string>` without calling `validateShipInput` itself. Two classes of injection are possible if a caller skips validation:

1. **Key injection:** a key like `"FOO\nEVIL_KEY=injected"` serialises to:
   ```
   FOO
   EVIL_KEY=injected=<value>
   ```
   In the wizard flow, keys come from `parseEnvExample` (well-formed), but defence-in-depth matters since `writeEnvLocal` is an exported lib function.

2. **Value injection:** a value containing `\n` (e.g., a multi-line pasted secret, or attacker-supplied input) appends extra `KEY=VALUE` lines. Real `.env.local` parsers (Next.js, dotenv) would accept these as new vars.

The file mode 0o600 + `chmod` follow-up is good (belt-and-suspenders against umask). The gap is input sanitisation at the boundary.

**Fix:**
```ts
export async function writeEnvLocal(proj: Project, values: Record<string, string>): Promise<string> {
  for (const [k, v] of Object.entries(values)) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(k)) {
      throw new Error(`invalid env key: ${JSON.stringify(k)}`)
    }
    if (/[\n\r]/.test(v)) {
      throw new Error(`value for ${k} contains newline`)
    }
  }
  const file = join(proj.path, ".env.local")
  const body = Object.entries(values).map(([k, v]) => `${k}=${v}`).join("\n") + "\n"
  await writeFile(file, body, { encoding: "utf8", mode: 0o600 })
  await chmod(file, 0o600)
  return file
}
```
An alternative is to require callers pass the output of `validateShipInput` via a branded type. The runtime check above is simpler and catches both failure modes.

---

### WR-03: `loadUatState` carries stale `orphaned: true` flag across re-add (P2)

**File:** `dashboard/lib/cae-uat.ts:195-209`
**Issue:**
```ts
items = [
  ...parsedItems.map((p) => {
    const prior = existingById.get(p.id);
    if (prior) {
      return {
        ...p,
        status: prior.status,
        note: prior.note,
        ts: prior.ts,
        orphaned: prior.orphaned,  // <-- stale when bullet re-appears
      };
    }
    return p;
  }),
  ...existing.items
    .filter((it) => !parsedIds.has(it.id))
    .map((it) => ({ ...it, orphaned: true })),
];
```
Because the id is `sha1(phase + ":" + text).slice(0, 8)`, the id is stable for identical bullet text. Lifecycle: bullet X is added → id matches parsed → orphaned = `undefined`. Bullet X is removed from ROADMAP → filtered into the second spread → orphaned = `true`. Bullet X is re-added verbatim in a later edit → id matches parsed again → this branch runs → `orphaned: prior.orphaned` preserves `true`.

The UI (future wave) will likely filter-out or grey-out orphaned items, so a re-added bullet appears "dead" until the user deletes the state file by hand.

**Fix:** explicitly clear the flag on the re-match path:
```ts
if (prior) {
  return {
    ...p,
    status: prior.status,
    note: prior.note,
    ts: prior.ts,
    // orphaned intentionally omitted — the bullet is live in the current ROADMAP.
  };
}
```
(Dropping the field entirely is cleaner than setting `orphaned: false` since `UatItem.orphaned` is already optional.)

## Info

### IN-01: `runPlanGen` try/catch cannot catch async spawn failures (P3)

**File:** `dashboard/lib/cae-plan-gen.ts:185-195`
**Issue:** The `try/catch` around `spawn()` only catches synchronous throws (invalid options). Real failure modes — tmux binary missing, non-zero exit from the detached session, claude CLI auth error — all surface via `child.on('error')` or the exit code, both async. Since `child.unref()` is called immediately, these are effectively unobservable by the caller. Not a security issue; a monitoring gap.

**Fix:** document the intentional fire-and-forget contract, or hook `child.once('error', ...)` to promote synchronous-feeling spawn errors into the stubPlan fallback path. Low priority — the comment on line 158 already hints at the fire-and-forget nature.

---

### IN-02: Redundant sentinel cleanup in `extractPhase1` (P3)

**File:** `dashboard/lib/cae-plan-gen.ts:85-90`
**Issue:** The regex lookahead `(?=^##\s+Phase\s+\d+\b)` is zero-width, so `m[1]` already ends before the sentinel boundary — the follow-up `.replace(/\n## Phase 999999: sentinel[\s\S]*$/, "")` on line 90 can never match the captured group. Defensively harmless but misleading.

**Fix:** drop the `.replace(...)` call and keep `.trimEnd()`, or add a comment noting the replace is defence-in-depth against pattern changes.

---

### IN-03: Non-null assertions in overload implementations (P3)

**Files:**
- `dashboard/lib/cae-plan-gen.ts:135` — `body = content!`
- `dashboard/lib/cae-plan-gen.ts:218` — `resolvedSlug = slug!`
- `dashboard/lib/cae-uat.ts:273-274` — `itemId = id!; itemStatus = status!;`

**Issue:** The non-null assertions are correct given the overload signatures — the branches are only reachable when the optional param is in fact provided. However, non-null assertions bypass TypeScript's safety net if an overload signature is later refactored. The old session's RED scaffolds apparently hit bugs of this shape, and the user flagged it as a concern.

**Fix:** runtime guard for belt-and-suspenders:
```ts
if (content === undefined) throw new Error("writeBuildplan: content required");
body = content;
```
Purely defensive — the current code is correct.

---

### IN-04: `approveGate` timestamp precision inconsistency (P3)

**File:** `dashboard/lib/cae-shift.ts:221`
**Issue:**
```ts
const ts = new Date().toISOString().replace(/\.\d+Z$/, "Z");
```
Strips milliseconds to match Shift's coarse-grained history format. But the rest of the codebase (e.g., `cae-uat.ts:281` — `new Date().toISOString()`) keeps millisecond precision. Mixed precision across state files is a minor surprise when debugging timestamps.

**Fix:** document the truncation as intentional (Shift parity) or standardise on full-precision. No correctness impact.

---

### IN-05: `listProjects` does not surface read errors on Shift state JSON (P3)

**File:** `dashboard/lib/cae-state.ts:113-118`
**Issue:** The catch block swallows all errors — including malformed JSON in a `.shift/state.json` file. Silently treating a corrupt Shift project as a plain non-Shift project hides real data corruption.

**Fix:** distinguish ENOENT (not a Shift project — fine to swallow) from SyntaxError / EACCES (real problem — log to server stderr):
```ts
} catch (err: unknown) {
  const code = (err as NodeJS.ErrnoException).code;
  if (code !== "ENOENT") {
    console.warn(`[listProjects] failed to parse ${c.path}/.shift/state.json:`, err);
  }
}
```
Not a bug (current behaviour is intentional per the "leave null" comment); a loggability gap.

## Security Checklist Verification

The security priorities listed in the phase brief all pass:

- [x] **Shell interpolation safety** — every call site of `spawn(..., [..., inner])` and every `${...}` in `inner` was audited. User-derived strings (`name`, `proj.path`, `answersFile`, `repoName`, `logDir`, `logFile`, `planDir`, `planPath`, `prompt`, `CAE_ARCH_PERSONA`, `SHIFT_PROJECTS_HOME`) flow through `quote()`. Constants (`SHIFT_BIN`, `CAE_BIN`, `PLAN_GEN_MODEL`) are fixed strings. `phaseNum` is integer-validated (1..99 inclusive). `repoName` matches `/^[a-zA-Z0-9_.-]{1,100}$/`. Project `name` matches `/^[a-zA-Z0-9_-]{1,64}$/`.
- [x] **Path traversal via `resolveProject`** — both branches covered: absolute path branch collapses via `resolve()` and matches against whitelist by exact string equality; slug branch rejects any `/` or `..`. Returns `null` on mismatch; never shell-executes the raw input.
- [x] **File-mode correctness** — `buildAnswersFile` writes `0o600`; `writeEnvLocal` writes `0o600` **and** follows up with `chmod 0o600` to override umask when overwriting.
- [x] **tmux session leaks** — session ids use `${role}-${project}-${Date.now().toString(36)}` for uniqueness; `child.unref()` prevents Node from holding the session. Leaks (long-running sessions) are functional concerns for a later ops wave, not a P10-review concern.
- [x] **SSRF / command injection via Shift CLI args** — neither Shift nor the dashboard makes outbound HTTP with user-controlled URLs in the reviewed code. The only injection vector is shell args, which pass the quote audit above.
- [x] **Async/await soundness** — every promise-returning call is `await`ed or explicitly returned. No `.then()` fire-and-forget. Non-null assertions are only used in overload implementations where the branch guarantees presence (see IN-03).

## Test Coverage Notes (not review findings)

The RED-phase scaffolds (`*.test.ts`) are structurally aligned with the implementations. `cae-plan-home.test.ts` correctly mocks `cae-state`. `cae-state.test.ts` uses tmpdir + `vi.resetModules()` to re-read `SHIFT_PROJECTS_HOME`. `cae-ship.test.ts` uses `vi.mock("child_process")` — note the mock implementation deliberately omits the `options` arg so the callback lands in position 3, matching the `execFile("gh", ["auth", "status"], cb)` call shape in `ghAuthStatus`; this is a subtle coupling but it works. Several scaffolds still have loose assertions (e.g., `cae-shift.test.ts:31` — `expect(result).toBeDefined()` on a resolveProject call that will return `null`). These are RED-phase placeholders that will be tightened when live fixtures / integration wiring land in plan 10-05+.

No test files are flagged as review findings because the user scoped the phase as wrapper-library implementation, not test hardening.

---

_Reviewed: 2026-04-23_
_Reviewer: Claude Opus 4.7 (1M) — gsd-code-reviewer_
_Depth: deep_
