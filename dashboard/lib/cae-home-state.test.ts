/**
 * cae-home-state.test.ts — Rollup ecosystem-aggregation invariant.
 *
 * Background (session-14 bug investigation):
 *   Eric opened /build?project=/home/cae/ctrl-alt-elite/dashboard and saw
 *   shipped_today = 0 even though 16 commits landed TODAY in the CAE root's
 *   activity.jsonl (/home/cae/ctrl-alt-elite/.cae/metrics/activity.jsonl).
 *   The dashboard subtree's activity.jsonl is empty / missing, so any
 *   per-project scan scoped to the dashboard returns 0.
 *
 *   Root audit: getHomeState() already iterates listProjects() and unions
 *   across every project. The bug didn't actually manifest in code under
 *   test (my direct repro returned 16). The gap was that NOTHING enforced
 *   the invariant — a future refactor that adds a `project` arg to
 *   getHomeState() or scopes buildRollup to a single project would silently
 *   reintroduce the exact bug Eric reported.
 *
 * Invariant under test:
 *   shipped_today / tokens_today MUST union across EVERY project returned
 *   by listProjects(), regardless of any `project=` query on /api/state.
 *   Per-project scoping applies only to phases[] + events_recent[] (which
 *   correctly describe "this project right now").
 *
 * Strategy:
 *   Mock cae-state.listProjects + tailJsonl + listOutbox so we control the
 *   project set and the jsonl rows each project sees. Mock cae-phase-detail
 *   so buildPhases no-ops (we don't want phase-detail reads in this unit).
 *   Assert rollup.shipped_today === SUM(commits across projects), not just
 *   the "selected" project's count.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// Stub collaborators BEFORE importing the module under test. vi.mock is
// hoisted so this applies even though it reads as "later" than the import.
vi.mock("./cae-state", () => ({
  listProjects: vi.fn(),
  tailJsonl: vi.fn(),
  listOutbox: vi.fn(),
  listPhases: vi.fn(),
}))

vi.mock("./cae-phase-detail", () => ({
  getPhaseDetail: vi.fn(),
}))

// Child-process exec is the "legacy git-log fallback" inside buildRollup.
// It fires ONLY when shipped_today is still 0 after outbox + activity
// counts. Our happy-path tests seed activity commits so the fallback
// shouldn't fire — but we stub it defensively so a stray git call never
// hits the real filesystem. `importOriginal` is required because
// cae-home-state imports `exec` as a NAMED export and also uses
// `promisify(exec)`, which inspects util.promisify.custom — a partial
// mock preserves the shape promisify needs.
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>()
  return {
    ...actual,
    exec: (
      _cmd: string,
      _opts: unknown,
      cb: (err: Error | null, out: { stdout: string; stderr: string }) => void,
    ) => {
      cb(null, { stdout: "0", stderr: "" })
    },
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ---- Helpers ----

const TODAY = new Date()
const TODAY_ISO = new Date(
  TODAY.getFullYear(),
  TODAY.getMonth(),
  TODAY.getDate(),
  12, 0, 0, 0, // noon local — safely inside today's local-midnight bounds
).toISOString()

function commitRow(sha: string, tsIso: string = TODAY_ISO) {
  return {
    ts: tsIso,
    type: "commit",
    source: "git-post-commit",
    actor: "CAE Build System",
    summary: `${sha.slice(0, 7)} feat: something shipped`,
    meta: {
      sha,
      short_sha: sha.slice(0, 7),
      subject: "feat: something shipped",
      files_changed_count: 1,
    },
  }
}

// activity.jsonl path helper matching the prod code's join layout.
function activityPathFor(projectPath: string): string {
  return `${projectPath}/.cae/metrics/activity.jsonl`
}

describe("getHomeState.rollup — ecosystem aggregation", () => {
  it(
    "unions shipped_today across ALL projects, not just the selected one",
    async () => {
      // Ground-truth scenario Eric hit:
      //   project 1 (CAE root) has 3 commits today
      //   project 2 (dashboard subtree) has 0 commits
      //   rollup.shipped_today MUST be 3 — NOT 0 (dashboard-scoped) and NOT
      //   just project-1's count if some other scoping silently filtered.
      const caeState = await import("./cae-state")
      const phaseDetail = await import("./cae-phase-detail")

      const PROJECT_1 = "/home/cae/ctrl-alt-elite"
      const PROJECT_2 = "/home/cae/ctrl-alt-elite/dashboard"

      vi.mocked(caeState.listProjects).mockResolvedValue([
        { name: "ctrl-alt-elite", path: PROJECT_1, hasPlanning: false },
        { name: "cae-dashboard", path: PROJECT_2, hasPlanning: false },
      ] as never)

      vi.mocked(caeState.listOutbox).mockResolvedValue([])
      vi.mocked(caeState.listPhases).mockResolvedValue([])
      vi.mocked(phaseDetail.getPhaseDetail).mockResolvedValue({
        tasks: [],
        yaml: null,
      } as never)

      // Route tailJsonl by path. project-1 has 3 commit rows today;
      // project-2's activity.jsonl is empty (matches the real dashboard
      // subtree state on disk). circuit-breakers.jsonl is empty everywhere
      // so tokens_today = 0 and the rollup's in_flight guard can't trip.
      vi.mocked(caeState.tailJsonl).mockImplementation(async (path: string): Promise<unknown[]> => {
        if (path === activityPathFor(PROJECT_1)) {
          return [commitRow("aaaaaaa1111111111111111111111111"),
                  commitRow("bbbbbbb2222222222222222222222222"),
                  commitRow("ccccccc3333333333333333333333333")]
        }
        return []
      })

      // Import AFTER mocks are set + reset the 1s cache so previous test
      // runs in the same file can't poison this assertion.
      const { getHomeState, __resetHomeStateCacheForTests } =
        await import("./cae-home-state")
      __resetHomeStateCacheForTests()

      const state = await getHomeState()

      expect(state.rollup.shipped_today).toBe(3)
    },
  )

  it(
    "still aggregates even when ONLY the CAE root project has commits (Eric's exact repro)",
    async () => {
      // Direct reproduction of the session-14 symptom: the project the user
      // has selected in the URL (dashboard subtree) has 0 local commits,
      // but the ecosystem — via CAE root — has 5. The rollup must reflect
      // the ecosystem, not the selected project.
      const caeState = await import("./cae-state")
      const phaseDetail = await import("./cae-phase-detail")

      const CAE_ROOT = "/home/cae/ctrl-alt-elite"
      const DASHBOARD = "/home/cae/ctrl-alt-elite/dashboard"

      vi.mocked(caeState.listProjects).mockResolvedValue([
        { name: "cae-dashboard", path: DASHBOARD, hasPlanning: false },
        { name: "ctrl-alt-elite", path: CAE_ROOT, hasPlanning: false },
      ] as never)

      vi.mocked(caeState.listOutbox).mockResolvedValue([])
      vi.mocked(caeState.listPhases).mockResolvedValue([])
      vi.mocked(phaseDetail.getPhaseDetail).mockResolvedValue({
        tasks: [], yaml: null,
      } as never)

      vi.mocked(caeState.tailJsonl).mockImplementation(async (path: string): Promise<unknown[]> => {
        if (path === activityPathFor(CAE_ROOT)) {
          return Array.from({ length: 5 }, (_, i) =>
            commitRow(`${i}`.padEnd(40, `${i}`))
          )
        }
        return []
      })

      const { getHomeState, __resetHomeStateCacheForTests } =
        await import("./cae-home-state")
      __resetHomeStateCacheForTests()

      const state = await getHomeState()

      expect(state.rollup.shipped_today).toBe(5)
    },
  )

  it(
    "deduplicates commits by sha across projects (same commit surfaced twice doesn't double-count)",
    async () => {
      // Edge case uncovered by code read: buildRollup uses a Set<sha> keyed
      // by meta.sha / meta.short_sha to dedupe. If the same sha appears in
      // two projects' activity.jsonl (a subtree mirror, e.g.), we must
      // count it once — otherwise "shipped_today" inflates on repos that
      // share history.
      const caeState = await import("./cae-state")
      const phaseDetail = await import("./cae-phase-detail")

      vi.mocked(caeState.listProjects).mockResolvedValue([
        { name: "a", path: "/p/a", hasPlanning: false },
        { name: "b", path: "/p/b", hasPlanning: false },
      ] as never)
      vi.mocked(caeState.listOutbox).mockResolvedValue([])
      vi.mocked(caeState.listPhases).mockResolvedValue([])
      vi.mocked(phaseDetail.getPhaseDetail).mockResolvedValue({
        tasks: [], yaml: null,
      } as never)

      const shared = commitRow("deadbeefdeadbeefdeadbeefdeadbeefdeadbeef")
      const unique = commitRow("c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00")

      vi.mocked(caeState.tailJsonl).mockImplementation(async (path: string): Promise<unknown[]> => {
        if (path === activityPathFor("/p/a")) return [shared, unique]
        if (path === activityPathFor("/p/b")) return [shared]
        return []
      })

      const { getHomeState, __resetHomeStateCacheForTests } =
        await import("./cae-home-state")
      __resetHomeStateCacheForTests()

      const state = await getHomeState()

      // 2 distinct shas across 3 row-occurrences → shipped_today = 2.
      expect(state.rollup.shipped_today).toBe(2)
    },
  )
})
