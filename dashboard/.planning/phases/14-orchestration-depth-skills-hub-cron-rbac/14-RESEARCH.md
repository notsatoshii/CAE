# Phase 14: Orchestration depth — Skills Hub + cron + RBAC — Research

**Researched:** 2026-04-23
**Domain:** Next.js 16 / App Router dashboard on top of CAE. Four orchestration surfaces bolted on: (1) Claude-Code skill marketplace browser/installer, (2) natural-language cron scheduler, (3) Google-SSO-gated RBAC, (4) security/audit panel.
**Confidence:** HIGH on auth (NextAuth v5 patterns are battle-tested), HIGH on cron parsing (`cronstrue` + `cron-parser` + `chrono-node` are stable), MEDIUM on Skills Hub (ecosystem is <18 months old, data shapes must be reverse-engineered from HTML/CLI because skills.sh exposes no stable JSON API), HIGH on secret-scan tooling (`gitleaks` + `trufflehog` are binaries we shell out to).

## Summary

Phase 14 adds orchestration depth to an already-shipped CAE dashboard — no new agent personas, no new core infra, just four founder-facing management surfaces on top of existing plumbing. The good news: every piece has a battle-tested path.

1. **Skills Hub.** The canonical install mechanism across the Claude Code ecosystem is `npx skills add <owner/repo>` (the [`skills`](https://www.npmjs.com/package/skills) CLI from vercel-labs, v1.5.1, 64 versions, MIT). It writes to `~/.claude/skills/<name>/` with a `SKILL.md` and optional supporting files. Three catalogs matter: **skills.sh** (the vercel-labs-hosted leaderboard — 91k installs all-time, `npx skills`-backed, **no stable JSON API**; must scrape or use unofficial `/trending`/`/hot` endpoints), **ClawHub** at `clawhub.ai` (the community Convex-backed marketplace — 52.7k tools, sign-in via GitHub), and **local `~/.claude/skills/`** (already contains 69 skills on this box — gsd-*, cae-forge, caveman). The dashboard's job: **browse** (read from skills.sh + ClawHub HTML + local filesystem), **install** (shell out to `npx skills add`), **detail** (render `SKILL.md` via react-markdown — we already have this).

2. **NL cron.** Do NOT try to convert natural language → cron with an LLM as the primary parser — it's $0.01/request, 500ms-2s latency, and an unbounded failure surface for something that should be deterministic. Use **`cronstrue`** (v3.14.0, the canonical cron↔English library, 373 dependents) for **reverse direction** (cron → "every day at 9am") and a small **rule-based parser** (`"every morning at 9am"` → `0 9 * * *`) as primary, with LLM fallback ONLY when rule-based fails. Execute via **system crontab** (`/etc/cron.d/cae-scheduled-tasks`) for survivability — Next.js dev-server restarts would kill an in-process `node-cron`. CAE already uses system cron elsewhere (`timmy-delegate/watcher.sh` runs every minute from user crontab).

3. **RBAC + Google SSO.** NextAuth v5 (`next-auth@5.0.0-beta.31`, already installed) supports multi-provider: add Google alongside GitHub. Role comes from two sources: (a) whitelist in env (`ADMIN_EMAILS="eric@..."`) resolved in the `jwt` callback, (b) optional database adapter for operator invitations (not needed for v0.1 solo-user). Roles written to session claim via `session` callback. Middleware reads `req.auth.user.role` and redirects 403 for insufficient roles. This is a well-trodden path — confidence HIGH.

4. **Security panel.** Three audit surfaces: (a) **installed-skill trust score** — heuristic per skill: is source in an allowlist of trusted owners (anthropics, vercel-labs), does `SKILL.md` declare `allowed-tools`, does it shell out via `!` prefix, is it signed/recently updated; (b) **secret scan** — run `gitleaks detect --no-git` against `~/.claude/skills/` on install and on demand (gitleaks is a Go binary, shell out); (c) **MCP/tool call audit** — we already have the Claude Code PostToolUse hook writing JSONL to `.cae/metrics/memory-consult.jsonl` (Phase 8, Session 5). Extend that hook to log ALL tool invocations → `.cae/metrics/tool-calls.jsonl` and surface in the Security panel as a filterable table.

**Primary recommendation:** 6 waves. Wave 0 scaffolding (auth split for Google, skills dir mounting, system-cron writer helper, audit-log schema). Wave 1 Skills Hub (parallel: browse + install + detail). Wave 2 cron+NL (deterministic parser first, LLM fallback). Wave 3 RBAC (provider addition + middleware guards + role UI). Wave 4 Security panel (trust score + gitleaks + audit log viewer). Wave 5 integration tests + VERIFICATION. Confidence target met.

---

<user_constraints>
## User Constraints (from Phase 14 directive — no CONTEXT.md yet)

### Locked Decisions (from user-provided phase scope)
- **Four surfaces only.** Skills Hub, NL cron, RBAC, Security panel. Nothing else.
- **Skills Hub sources.** Two externals: ClawHub (`clawhub.ai`) + skills.sh (`npx skills` ecosystem). Plus local `~/.claude/skills/`.
- **Skill install target.** Writes to `~/.claude/skills/<name>/` (personal scope — cross-project per Claude Code docs).
- **NL cron execution backend.** "CronCreate tool pattern IF AVAILABLE; otherwise `scheduled_tasks.json` registry + watcher daemon." Research finding: there is **no existing CronCreate MCP tool** in the Claude Code ecosystem or in `~/.claude/`. Falling back to the `scheduled_tasks.json` + watcher path.
- **RBAC tiers.** Exactly three: `viewer` (read), `operator` (run tasks), `admin` (edit permissions). Gated by Google SSO.
- **Security panel scope.** Trust score per skill + secrets detection + MCP call audit log.

### Claude's Discretion
- Skills Hub data shape: browse via live HTML scrape vs. local cache + periodic refresh. Recommend: **fetch-on-load with SWR + 15 min cache**. Both skills.sh and clawhub.ai lack stable JSON APIs.
- NL cron parser choice: deterministic first vs. LLM-first. Recommend: **deterministic (`cronstrue` + rule table) first, LLM fallback only when rule-based returns null**.
- Scheduler backend: system crontab vs. in-process `node-cron` vs. a dedicated watcher daemon. Recommend: **system crontab** writer + watcher script that invokes `cae execute-buildplan` from a queue file.
- Secret detection tool: `gitleaks` vs. `trufflehog` vs. `detect-secrets`. Recommend: **gitleaks** (fastest, single binary, designed for filesystem scans, 24.4k stars).
- Auth provider: keep GitHub alongside Google, or replace? Recommend: **keep both** (GitHub was shipped in Phase 1; Google is the founder-facing one from UI-SPEC audience reframe — both work, dev keeps GitHub).
- Trust score algorithm: binary allowlist vs. multi-factor heuristic. Recommend: **multi-factor heuristic** with explainable per-factor score.

### Deferred Ideas (OUT OF SCOPE)
- Publishing skills TO marketplaces (read-only direction for v0.1)
- Multi-tenant RBAC (organizations, teams) — single-user-with-roles only
- Skill signing / cryptographic verification (trust score is heuristic-only)
- Cron failover / HA scheduling (single system-cron instance is fine)
- MCP server registry management (skills only; MCPs deferred to v2)
- Database adapter for NextAuth (env whitelist is sufficient for role assignment v0.1)
- Editing / uninstalling installed skills from the UI (view-only + "open in terminal" in v0.1 — install is the only mutation)
- Billing / usage enforcement via RBAC
- Audit log retention policy / archiving (append-only JSONL, no rotation v0.1)
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 14 is not yet in REQUIREMENTS.md (project uses ROADMAP.md-driven scope). The user directive defines scope; REQ IDs are synthesized here so the planner can map tasks.

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-P14-01 | Skills Hub page at `/build/skills` with three tabs: Catalog / Installed / Publish-deferred | §1 (Skills Hub) |
| REQ-P14-02 | Catalog aggregates skills.sh + ClawHub + local view, one-click install via `npx skills add` | §1 Install flow |
| REQ-P14-03 | Per-skill detail drawer renders SKILL.md with trust score + secret-scan status | §1 Detail, §4 Trust score |
| REQ-P14-04 | `/build/schedule` page: NL textarea → parsed cron preview → confirm → scheduled_tasks.json entry | §2 NL cron |
| REQ-P14-05 | Watcher script reads scheduled_tasks.json, dispatches via `cae execute-buildplan` | §2 Scheduler backend |
| REQ-P14-06 | Google SSO provider added to `auth.ts` alongside GitHub | §3 RBAC |
| REQ-P14-07 | Three roles (viewer/operator/admin) assigned via env whitelist, stored in session claim | §3 Session callback |
| REQ-P14-08 | `middleware.ts` gates routes by role; operator-only actions (run task) 403 for viewer | §3 Middleware |
| REQ-P14-09 | Admin-only `/build/admin/roles` page to view/edit the whitelist | §3 Role UI |
| REQ-P14-10 | Security panel at `/build/security` with three sub-tabs: Skills / Secrets / Audit log | §4 |
| REQ-P14-11 | gitleaks runs on skill install + on-demand rescan, results in `.cae/metrics/skill-scans.jsonl` | §4 Secret scan |
| REQ-P14-12 | PostToolUse hook writes all tool invocations to `.cae/metrics/tool-calls.jsonl`; panel renders filterable table | §4 Audit log |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

The repo-wide CLAUDE.md at `/home/cae/ctrl-alt-elite/CLAUDE.md` is CAE architecture doctrine, not coding constraints. Extracted directives applicable to Phase 14:

1. **File-mediated communication.** All inter-agent + inter-component knowledge flows through files. Phase 14 audit log = JSONL file. scheduled_tasks.json = file. Role whitelist = env. This aligns.
2. **Fresh context per task.** Every builder spawns clean. Phase 14's watcher daemon must re-read state from files on every tick — no memoized in-process state.
3. **Adversarial review.** Sentinel ≠ Forge model. Phase 14 planner must not pre-set a single model for all tasks; keep the existing `gsd-executor` sonnet / `gsd-verifier` opus split.
4. **Right-sized tasks.** If a wave doesn't fit one context window, re-plan. Skills Hub browse + install is a plausible single wave; if it doesn't fit, split browse from install.
5. **Smart Contract Mode.** Not relevant (no .sol).
6. **UI-SPEC design law.** `dashboard/docs/UI-SPEC.md` is canonical. Dark theme, Geist fonts, cyan accent, founder-speak. Phase 14 pages conform: "Skills", "Schedules", "Permissions", "Security" in the left rail, explain-mode tooltips default ON.

## Phase 14 context from STATE.md + ROADMAP.md

- **Audience:** non-dev founders, Explain-mode ON by default. Phase 14 pages must pass "would a PM understand without a dev" — "cron expression" becomes "schedule", "RBAC tier" becomes "what they can do".
- **Current state:** Phase 10 is active mid-execution, Phase 11/13 planned, Phase 14 is the last of 14 planned. Assume 14 runs after 10/11/12/13 all green.
- **Existing plumbing Phase 14 leverages:**
  - NextAuth v5 + GitHub in `auth.ts` (extend, don't replace)
  - `middleware.ts` route protection (extend matcher + add role checks)
  - `.cae/metrics/*.jsonl` append-only pattern (add new files, same shape)
  - Claude Code PostToolUse hook at `~/.claude/hooks/` (extend, don't replace Phase 8's memory-consult hook)
  - Label dictionary `lib/copy/labels.ts` (add `skills.*`, `schedule.*`, `permissions.*`, `security.*` keys)
  - System cron (user crontab already has timmy-delegate watcher; add new cae-scheduler line)
  - shadcn/ui + base-ui primitives; react-markdown; SSE tail; dynamic imports for heavy editors

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next-auth` | 5.0.0-beta.31 | Auth + session + middleware | Already shipped in Phase 1; v5 supports multi-provider + role claims natively [VERIFIED: npm view next-auth@beta] |
| `cronstrue` | 3.14.0 | Human-readable cron descriptions | Canonical, 373 dependents, maintained since 2015, handles Quartz flags [VERIFIED: npm view cronstrue] |
| `cron-parser` | 5.5.0 | Validate + compute next-run for cron expressions | Pairs with cronstrue; needed to show "next run: Wed 9:00am" [VERIFIED: npm view cron-parser] |
| `chrono-node` | 2.9.0 | Natural-language date parsing ("tomorrow at 9am") | Dependency-free, handles most English date/time expressions [VERIFIED: npm view chrono-node] |
| `gitleaks` (system binary) | latest | Secret scanning in skill source | 24.4k stars, 150+ patterns, single binary, fast [CITED: github.com/gitleaks/gitleaks] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `skills` CLI | 1.5.1 | Skill install shell-out target | Phase 14 shells out to `npx skills add <repo>` [VERIFIED: npm view skills] |
| `react-markdown` | 10.1.0 (already installed) | Render SKILL.md in detail drawer | Reuse Phase 8 pattern |
| `@monaco-editor/react` | 4.7.0 (already installed) | Cron expression editor (Advanced mode only) | Dev-mode-gated, matches Phase 6 Monaco gate |
| `swr` or manual fetch + `useSWR` | 2.x | Cache skills.sh/clawhub browse responses | 15-min stale-while-revalidate |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `cronstrue` + rule-parser | LLM-only NL parser | LLM is $0.01+/req, 500ms-2s, non-deterministic. Deterministic wins. [ASSUMED pricing — estimate] |
| System crontab | `node-cron` in-process | node-cron dies when Next.js dev server restarts. System cron survives reboots. [CITED: crongen.com/blog/nodejs-cron-jobs-system-vs-node-cron] |
| System crontab | Dedicated daemon (pm2-cron, systemd-timer) | More moving parts. System cron is universally installed; CAE already uses it. |
| `gitleaks` binary | `detect-secrets` (Python) | detect-secrets is pre-commit-focused, slower per-run. gitleaks' "detect" subcommand is designed for ad-hoc filesystem scans. [CITED: appsecsanta.com 2026 comparison] |
| `gitleaks` binary | `trufflehog` | trufflehog verifies secrets with real API calls — too invasive for a dashboard UI feature; also 800+ detectors is overkill for skill source. [CITED: same] |
| Role-whitelist in env | Database adapter (Prisma/Drizzle) | DB adapter is overkill for single-user-with-roles v0.1. Whitelist is 5 lines. Upgrade path: add adapter in v2. |
| Google SSO provider | Clerk / Auth0 | We already have NextAuth. Adding a new IdP just for Google is ~15 lines. No reason to bring in a new vendor. [CITED: blog.logrocket.com 2026 auth comparison] |
| `skills` CLI shell-out | Re-implement install in TS | The CLI already handles git clone + subpath + package checksum + telemetry opt-out. Reinventing is waste. [CITED: vercel-labs/skills README] |

**Installation:**
```bash
pnpm add cronstrue@3.14.0 cron-parser@5.5.0 chrono-node@2.9.0
# gitleaks: binary install
curl -sSfL https://raw.githubusercontent.com/gitleaks/gitleaks/master/install.sh | sudo sh
# skills CLI: already runnable via npx, no install needed
# next-auth: already at 5.0.0-beta.31
```

**Version verification:** Confirmed via `npm view <pkg> version` on 2026-04-23:
- `cronstrue`: 3.14.0 ✓
- `cron-parser`: 5.5.0 ✓
- `chrono-node`: 2.9.0 ✓
- `skills`: 1.5.1 (64 versions, active) ✓
- `next-auth@beta`: 5.0.0-beta.31 ✓ (already installed)

## Architecture Patterns

### Recommended Project Structure

```
app/
├── build/
│   ├── skills/              # REQ-P14-01 Skills Hub
│   │   ├── page.tsx         # Catalog (server — SSR initial list)
│   │   ├── skills-client.tsx # Tabs + install state
│   │   ├── [name]/page.tsx  # Per-skill detail route
│   │   └── installed/page.tsx
│   ├── schedule/            # REQ-P14-04 NL cron
│   │   ├── page.tsx
│   │   ├── schedule-client.tsx
│   │   └── new/page.tsx
│   ├── admin/
│   │   └── roles/page.tsx   # REQ-P14-09 admin-only
│   └── security/            # REQ-P14-10 Security panel
│       ├── page.tsx
│       ├── skills/page.tsx  # trust score grid
│       ├── secrets/page.tsx # gitleaks results
│       └── audit/page.tsx   # tool-call log
├── api/
│   ├── skills/
│   │   ├── route.ts         # GET catalog (merged)
│   │   ├── install/route.ts # POST → shell skills CLI
│   │   ├── installed/route.ts
│   │   └── scan/[name]/route.ts
│   ├── schedule/
│   │   ├── route.ts         # CRUD scheduled_tasks.json
│   │   ├── parse/route.ts   # NL → cron preview
│   │   └── next-run/route.ts
│   ├── admin/
│   │   └── roles/route.ts
│   └── security/
│       ├── audit/route.ts   # read .cae/metrics/tool-calls.jsonl
│       └── scans/route.ts
lib/
├── cae-skills-catalog.ts    # skills.sh + clawhub.ai scrapers + merge
├── cae-skills-install.ts    # npx skills add shell-out
├── cae-skills-trust.ts      # heuristic trust score
├── cae-schedule-parse.ts    # NL → cron (rule-based + LLM fallback)
├── cae-schedule-store.ts    # scheduled_tasks.json r/w
├── cae-rbac.ts              # role resolution + middleware helper
├── cae-secrets-scan.ts      # gitleaks shell-out + parse
└── cae-audit-log.ts         # tool-calls.jsonl reader
components/
├── skills/
│   ├── catalog-grid.tsx
│   ├── skill-card.tsx
│   ├── skill-detail-drawer.tsx
│   ├── install-button.tsx
│   └── trust-badge.tsx
├── schedule/
│   ├── nl-input.tsx
│   ├── cron-preview.tsx
│   └── task-list.tsx
├── admin/
│   └── role-editor.tsx
└── security/
    ├── trust-grid.tsx
    ├── audit-table.tsx
    └── secrets-report.tsx
scripts/
└── cae-scheduler-watcher.sh # system-cron invoker
tools/ (project tools dir — created by Phase 8)
└── skill-install.sh         # wrapper around npx skills add with logging
auth.ts                      # extended — Google provider added
middleware.ts                # extended — role-check function
```

### Pattern 1: Multi-source Skills Catalog

**What:** Merge three sources into a single typed skill list.
**When to use:** Any read-from-external-source feature that needs local-first UX.
**Example:**
```typescript
// Source: synthesized from skills.sh HTML scrape + clawhub.ai structure + Phase 8 pattern
// lib/cae-skills-catalog.ts
export type SkillSource = "skills.sh" | "clawhub" | "local";
export type CatalogSkill = {
  name: string;
  owner: string;
  source: SkillSource;
  description: string;
  installs?: number;  // skills.sh only
  stars?: number;     // clawhub only
  installCmd: string; // "npx skills add vercel-labs/agent-skills"
  detailUrl: string;  // canonical web URL
  installed: boolean; // crosscheck against ~/.claude/skills
};

export async function getCatalog(opts: { q?: string }): Promise<CatalogSkill[]> {
  const [sh, ch, local] = await Promise.all([
    fetchSkillsSh(opts.q),       // scrape /trending
    fetchClawHub(opts.q),         // scrape /skills?sort=downloads
    readLocalSkillsDir(),         // readdir ~/.claude/skills
  ]);
  return dedupeMergeByName([...sh, ...ch, ...local]);
}
```

### Pattern 2: NL-to-cron Deterministic + LLM Fallback

**What:** Try a small rule table first; only fall back to LLM when rules fail.
**When to use:** Any constrained-grammar-with-long-tail NL parse (cron, regex, SQL).
**Example:**
```typescript
// Source: designed pattern, no direct reference
// lib/cae-schedule-parse.ts
const RULES: Array<[RegExp, string]> = [
  [/every (morning|day) at (\d+)(am|pm)?/i, (m) => `0 ${to24h(m[2], m[3])} * * *`],
  [/every weekday at (\d+)(am|pm)?/i, (m) => `0 ${to24h(m[1], m[2])} * * 1-5`],
  [/every (\d+) minutes?/i, (m) => `*/${m[1]} * * * *`],
  [/every hour/i, () => "0 * * * *"],
  // ... ~20 rules cover ~80% of founder requests
];

export async function parseSchedule(nl: string): Promise<{ cron: string; source: "rule" | "llm"; confidence: "high" | "medium" }> {
  for (const [re, gen] of RULES) {
    const m = nl.match(re);
    if (m) return { cron: typeof gen === "function" ? gen(m) : gen, source: "rule", confidence: "high" };
  }
  // Fallback: LLM (Sonnet, constrained prompt + cron-parser validation)
  const llmResult = await llmParseCron(nl);
  if (cronParser.isValidCron(llmResult.cron)) {
    return { cron: llmResult.cron, source: "llm", confidence: "medium" };
  }
  throw new Error(`Could not parse: "${nl}"`);
}
```

### Pattern 3: RBAC via JWT callback + middleware

**What:** Role resolved once at sign-in, stored in session claim, read on every request.
**When to use:** Any auth with role-based route protection in NextAuth v5.
**Example:**
```typescript
// Source: https://authjs.dev/guides/role-based-access-control
// auth.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

const ADMINS = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim());
const OPERATORS = (process.env.OPERATOR_EMAILS ?? "").split(",").map((s) => s.trim());

function resolveRole(email: string | null | undefined): "viewer" | "operator" | "admin" {
  if (!email) return "viewer";
  if (ADMINS.includes(email)) return "admin";
  if (OPERATORS.includes(email)) return "operator";
  return "viewer";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub, Google],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = resolveRole(user.email);
      return token;
    },
    session({ session, token }) {
      session.user.role = token.role as "viewer" | "operator" | "admin";
      return session;
    },
  },
});

// middleware.ts (extended)
export default auth((req) => {
  if (!req.auth) return redirectToSignin(req);
  const role = req.auth.user?.role;
  const path = req.nextUrl.pathname;
  if (path.startsWith("/build/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/403", req.url));
  }
  // operator+ required for action routes; viewer blocked
  if (req.method !== "GET" && path.startsWith("/api/queue/delegate") && role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
});
```

### Pattern 4: Skill install shell-out + stream

**What:** Shell out to `npx skills add <repo>` with stdio capture; stream to client via SSE.
**When to use:** Any long-running external process the user needs feedback on.
**Example:**
```typescript
// Source: Phase 6 tmux pattern extended to child_process
// lib/cae-skills-install.ts
import { spawn } from "child_process";
export function installSkill(repo: string): AsyncIterable<{ type: "line" | "done"; data: string }> {
  const proc = spawn("npx", ["-y", "skills", "add", repo], { env: { ...process.env, SKILLS_TELEMETRY_DISABLED: "1" } });
  async function* stream() {
    for await (const chunk of proc.stdout) yield { type: "line" as const, data: chunk.toString() };
    const code = await new Promise<number>((r) => proc.on("close", r));
    yield { type: "done" as const, data: String(code) };
  }
  return stream();
}
```

### Pattern 5: System-cron via `scheduled_tasks.json` + watcher

**What:** UI writes to `scheduled_tasks.json`. A single `* * * * *` cron entry invokes `watcher.sh` that reads the JSON, picks tasks due now, spawns them.
**When to use:** UI-driven scheduling that must survive Next.js restarts.
**Example:**
```bash
# Source: scripts/cae-scheduler-watcher.sh (new, modeled on timmy-delegate watcher.sh)
#!/usr/bin/env bash
set -euo pipefail
TASKS_FILE="${CAE_ROOT:-/home/cae/ctrl-alt-elite}/scheduled_tasks.json"
LOG="${CAE_ROOT}/.cae/metrics/scheduler.jsonl"
NOW=$(date +%s)
jq -c '.[]' "$TASKS_FILE" | while read -r task; do
  cron=$(echo "$task" | jq -r '.cron')
  last=$(echo "$task" | jq -r '.lastRun // 0')
  next=$(node -e "const p=require('cron-parser').parseExpression('$cron',{currentDate: new Date($last*1000)}); console.log(Math.floor(p.next().getTime()/1000))")
  if [[ "$NOW" -ge "$next" ]]; then
    buildplan=$(echo "$task" | jq -r '.buildplan')
    echo "{\"ts\":$NOW,\"event\":\"dispatch\",\"id\":\"$(echo "$task" | jq -r '.id')\"}" >> "$LOG"
    cae execute-buildplan < "$buildplan" &
  fi
done
```

Crontab entry (installed by Wave 0):
```
* * * * * /home/cae/ctrl-alt-elite/dashboard/scripts/cae-scheduler-watcher.sh >> /tmp/cae-scheduler.log 2>&1
```

### Anti-Patterns to Avoid

- **LLM-first NL→cron parsing.** Latency (500ms-2s), cost ($0.01+/req), non-determinism. Deterministic rules cover ~80%; LLM only for long tail.
- **In-process `node-cron` scheduler.** Dies with Next.js dev restarts. System cron is free and bulletproof.
- **Reimplementing the `skills` CLI in TypeScript.** The CLI handles git clone, subpath extraction, and checksum — reinventing it is waste and divergence risk.
- **Parsing SKILL.md YAML ourselves.** Use a YAML parser (already have `yaml@2.8.3` in deps). Frontmatter extraction is `--- ... ---` + YAML.parse.
- **Shelling out `gitleaks` on every render.** Scan on install + cache result + "rescan" button. Scan is hundreds of ms; don't gate UI on it.
- **Roles in localStorage or cookies.** Must be server-resolved. Trust boundary is the JWT signing secret — localStorage is attacker-controllable.
- **Writing audit log from the dashboard directly.** Let the Claude Code PostToolUse hook own tool-calls.jsonl; dashboard is read-only on that file. Otherwise two writers race.
- **Scraping skills.sh every request.** SWR + 15 min cache. Vercel rate-limits will trigger otherwise.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron↔English | String-concat regex | `cronstrue@3.14.0` | Handles Quartz L/W/# flags, 12+ locales, 10 years of edge cases |
| Cron validation | Custom parser | `cron-parser@5.5.0` | Computes next N runs, handles 5/6/7-field variants |
| NL date parsing | Regex soup | `chrono-node@2.9.0` | Handles "next Tuesday at 3pm", timezone math, relative dates |
| OAuth flow | Custom JWT + OAuth2 dance | `next-auth@5` (already installed) | Session mgmt + CSRF + PKCE + provider rotation all solved |
| Secret detection | Regex allowlist | `gitleaks` binary | 150+ patterns maintained, avoids AWS-key-lookalike false positives |
| Skill install | Git-clone + SKILL.md parse + deps resolve | `npx skills add` | The CLI IS the ecosystem's blessed path — Vercel-maintained, telemetry-opt-out respected |
| Markdown render | `dangerouslySetInnerHTML` + sanitize | `react-markdown@10.1.0 + remark-gfm` (already installed) | Reuse Phase 8 pattern |
| YAML frontmatter parsing | Split + regex | `yaml@2.8.3` (already installed) | Handles multi-line strings + anchors |
| Role-whitelist diff | Custom UI + file I/O | `.env.local` edit + restart | v0.1: admins edit env via SSH. v2: DB adapter. Don't middle-ground. |

**Key insight:** Every piece of Phase 14 has a mature library or CLI. The dashboard's job is glue — UI + orchestration + read-from-file. Resist every urge to "just write a small parser".

## Runtime State Inventory

Phase 14 is greenfield for the dashboard surface. However, it touches persistent state in several places. Inventory:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `~/.claude/skills/<N>/` (69 existing skills on this box) — read-only, never modify. `scheduled_tasks.json` at CAE_ROOT — NEW. `.cae/metrics/tool-calls.jsonl` — NEW. `.cae/metrics/skill-scans.jsonl` — NEW. `.cae/metrics/scheduler.jsonl` — NEW. | Wave 0 creates stub files with `[]` / empty JSONL for test fixtures. Existing skills dir: READ-ONLY from dashboard perspective. |
| Live service config | User crontab (currently: 11 entries including timmy-delegate watcher) — Phase 14 adds 1 line. Next.js dev server — extended middleware.ts requires restart on change (Next hot-reloads this fine). | Wave 0 installs crontab line via `crontab -l \| + new line \| crontab -`. Must be idempotent — check for marker comment first. |
| OS-registered state | systemd: `cron.service` active (since 2026-03-31, still running). No new systemd units needed. | None — we ride existing cron daemon. |
| Secrets/env vars | NEW: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS`, `OPERATOR_EMAILS`. EXISTING: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `NEXTAUTH_SECRET` (Phase 1). | `.env.local` edit. Document required keys in a new `docs/ENV.md` or the README. Never commit. |
| Build artifacts / installed packages | New deps: `cronstrue@3.14.0`, `cron-parser@5.5.0`, `chrono-node@2.9.0`. `skills` CLI: ran via `npx`, cached in `~/.npm/_npx/`. `gitleaks`: system binary, `which gitleaks` check before use. | `pnpm install` after deps added. Wave 0 verification: `npx skills --version` + `gitleaks version` must both succeed. |

**Nothing found in category:**
- No data migration needed — all new files are greenfield append-only. Existing `~/.claude/skills/` is read by Phase 14 but never written to (install is shell-out to a CLI that owns the writes).
- No OS-registered tasks with "phase-14" in descriptions (new feature).

## Environment Availability

Phase 14 depends on external tools. Verified on current machine:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` (>=20) | Next.js + skills CLI | ✓ | (Phase 1 baseline) | — |
| `npx` / `npm` | skills CLI invocation | ✓ | — | — |
| `cron` daemon | System crontab for watcher | ✓ | active since 2026-03-31 | — |
| `crontab` CLI | install scheduler line | ✓ | — | Manual /etc/cron.d/ drop if unavailable |
| `jq` | watcher.sh JSON parse | presumed ✓ (used by recon + timmy) | — | Rewrite watcher in Node |
| `gitleaks` | REQ-P14-11 | **✗ not verified — needs install** | — | **Skip secret scan, show "unavailable" banner; install step is Wave 0** |
| `git` | skills CLI git-clone | ✓ (CAE is a git repo) | — | — |
| `~/.claude/skills/` | skill install target | ✓ (exists, 69 entries) | — | — |
| Google OAuth client ID | REQ-P14-06 | **✗ not created — human action required** | — | **Keep GitHub-only until admin creates Google OAuth app; document in ENV.md** |

**Missing dependencies with no fallback:**
- None blocking. Google OAuth client must be created by admin before Wave 3 ships, but rest of phase can proceed without it.

**Missing dependencies with fallback:**
- **gitleaks:** Wave 0 installs via `curl ... | sh` OR we flag secret-scan tab as "disabled — install gitleaks to enable". Prefer install.
- **Google OAuth credentials:** if not available by Wave 3, keep GitHub-only; role resolution still works (whitelist by email regardless of provider).

## Common Pitfalls

### Pitfall 1: skills.sh rate-limiting on scrape
**What goes wrong:** Hammering `skills.sh/trending` on every page load triggers Vercel rate-limits (429).
**Why it happens:** No official JSON API; HTML scrape is the only path.
**How to avoid:** SWR with 15-min `dedupingInterval`; server-side cache in `.cae/cache/skills-sh-trending.json` with 15-min TTL; respect `Cache-Control` if headers present.
**Warning signs:** Empty catalog after 10+ loads; 429 in server logs.

### Pitfall 2: NextAuth v5 jwt + session callback order
**What goes wrong:** `session.user.role` is undefined on first sign-in.
**Why it happens:** `jwt` callback only receives `user` on initial sign-in; on subsequent calls it receives only `token`. If `token.role` isn't persisted, session callback has nothing to read.
**How to avoid:** Always write role to `token` in jwt callback. The example pattern (Pattern 3 above) persists correctly because `user` is checked with `if (user)` — role written once and retained.
**Warning signs:** First sign-in works, second request loses role. Check with `console.log` in session callback.

### Pitfall 3: Middleware runs on Edge, can't spawn processes
**What goes wrong:** Attempting to read `scheduled_tasks.json` or invoke `gitleaks` from middleware fails silently.
**Why it happens:** NextAuth v5 middleware runs on Vercel Edge runtime by default — no `fs`, no `child_process`.
**How to avoid:** Middleware ONLY does auth + role check. All file + shell access lives in route handlers (`app/api/*/route.ts`) which run on Node runtime by default. If you need Node runtime in middleware, add `export const config = { runtime: "nodejs" }` but prefer splitting.
**Warning signs:** `ReferenceError: fs is not defined` in middleware error logs.

### Pitfall 4: Cron expression timezones
**What goes wrong:** User sees "every morning at 9am" → cron shows "runs at 9:00 UTC" — off by N hours.
**Why it happens:** System cron runs in the server's timezone. `cron-parser` defaults to UTC unless given a `tz`.
**How to avoid:** Always pass `{ tz: Intl.DateTimeFormat().resolvedOptions().timeZone }` to cron-parser on the client; store `timezone` alongside `cron` in scheduled_tasks.json; watcher compares against `TZ=... date +%s`.
**Warning signs:** Scheduled tasks run at "wrong" times by ±5-9 hours (KST/UTC offset).

### Pitfall 5: SSR hydration mismatch on session state
**What goes wrong:** Role-gated UI renders different markup on server vs. client → React hydration warning + layout flash.
**Why it happens:** Server has access to session via `auth()`; client initially has no session → both render "viewer" → client hydrates → re-renders as "admin".
**How to avoid:** Pass role from server component down as prop; do NOT use `useSession` in the initial render path for role-gated UI; use `auth()` server-side and `<RoleGate role="admin" currentRole={role}>` pattern. If you must use `useSession`, render a skeleton while `status === "loading"`.
**Warning signs:** Dev console hydration warning; brief flash of "viewer" UI before admin UI appears.

### Pitfall 6: gitleaks false positives on SKILL.md example snippets
**What goes wrong:** Skills with API key examples in documentation trigger "leaked secret" alerts.
**Why it happens:** gitleaks pattern-matches on structure, not provenance. `sk-proj-xyz...` in an example is indistinguishable from a real key.
**How to avoid:** Use `gitleaks detect --no-git --redact --config=<custom>` with an allowlist for common doc-example patterns (`sk-proj-example`, `your-api-key-here`, etc.); show findings to the user with "likely example" tagging; never auto-delete.
**Warning signs:** Every 3rd skill flagged; admin ignores the panel.

### Pitfall 7: Scheduler watcher double-fire on slow tasks
**What goes wrong:** A task takes >60s; the next minute's watcher also fires it; two copies run.
**Why it happens:** Watcher checks `NOW >= next` but doesn't mark the task as "running".
**How to avoid:** Watcher takes a per-task flock (`flock -n /tmp/cae-scheduler-$id.lock`) before spawning; records `lastRun` timestamp only after process start (before completion); records `lastCompleted` after exit.
**Warning signs:** Same workflow appearing twice in queue within the same minute.

### Pitfall 8: skills CLI network fetches in containerised Next.js
**What goes wrong:** `npx skills add` fails in Docker — no outbound network.
**Why it happens:** Node containers without DNS/TLS configured block git clones.
**How to avoid:** Document as a "runs on dev machine, not in container" constraint for v0.1; if containerising later, pre-install to a bind-mounted `~/.claude/skills/` volume.
**Warning signs:** Install hangs or times out; logs show ENOTFOUND / EAI_AGAIN.

## Code Examples

Verified patterns from official sources:

### Skill directory structure (canonical)
```text
# Source: https://code.claude.com/docs/en/skills
~/.claude/skills/
└── my-skill/
    ├── SKILL.md        # required — YAML frontmatter + markdown body
    ├── reference.md    # optional
    └── scripts/
        └── helper.py
```

### SKILL.md frontmatter (canonical)
```yaml
---
name: deploy
description: Deploy the application to production
disable-model-invocation: true
allowed-tools: Bash(git add *) Bash(git commit *)
---
Deploy $ARGUMENTS to production...
```

### skills CLI install command (canonical)
```bash
# Source: https://github.com/vercel-labs/skills
npx skills add vercel-labs/agent-skills                  # GitHub shorthand
npx skills add https://github.com/owner/repo             # full URL
npx skills add https://github.com/owner/repo/tree/main/skills/sub   # subpath
npx skills add git@github.com:owner/repo.git             # SSH
```

### NextAuth v5 multi-provider + role callback (verified)
```typescript
// Source: https://authjs.dev/guides/role-based-access-control (verified 2026-04-23)
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";

export const { handlers, auth } = NextAuth({
  providers: [
    Google({
      profile(profile) {
        return { role: profile.role ?? "user", ...profile };
      },
    }),
    GitHub,
  ],
  callbacks: {
    jwt({ token, user }) { if (user?.role) token.role = user.role; return token; },
    session({ session, token }) { session.user.role = token.role; return session; },
  },
});
```

### gitleaks filesystem scan (no git)
```bash
# Source: https://github.com/gitleaks/gitleaks (verified CLI flags)
gitleaks detect --no-git --source ~/.claude/skills/my-skill --redact --report-format json --report-path /tmp/scan.json
```

### cronstrue basic usage (verified)
```typescript
// Source: https://github.com/bradymholt/cRonstrue (verified 2026-04-23)
import cronstrue from "cronstrue";
cronstrue.toString("0 9 * * *");           // "At 09:00 AM"
cronstrue.toString("*/15 * * * *");        // "Every 15 minutes"
cronstrue.toString("0 9 * * 1-5");         // "At 09:00 AM, Monday through Friday"
```

### PostToolUse hook extended for audit (extends Phase 8 pattern)
```bash
# Source: ~/.claude/settings.json (verified — already has PostToolUse for Write/Edit)
# tools/audit-hook.sh (new — modeled on tools/memory-consult-hook.sh)
#!/usr/bin/env bash
set -euo pipefail
: "${CAE_TASK_ID:=unknown}"
AUDIT="${CAE_ROOT:-/home/cae/ctrl-alt-elite}/.cae/metrics/tool-calls.jsonl"
TOOL="${CLAUDE_TOOL_NAME:-?}"
TS=$(date -u +%FT%TZ)
jq -nc --arg ts "$TS" --arg task "$CAE_TASK_ID" --arg tool "$TOOL" --arg cwd "$PWD" \
  '{ts:$ts,task:$task,tool:$tool,cwd:$cwd}' >> "$AUDIT"
```

Register in `~/.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Bash|Write|Edit|MultiEdit|Agent|Task|Read",
      "hooks": [{ "type": "command", "command": "bash /home/cae/ctrl-alt-elite/dashboard/tools/audit-hook.sh", "timeout": 3 }]
    }]
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom plugin registries per AI tool | Unified `SKILL.md` format + `skills` CLI (skills.sh leaderboard) | vercel-labs launched `skills` ~Jan 2026; skills.sh 91k installs by Apr 2026 | One install command works across Claude Code, OpenClaw, Cursor, Gemini CLI, etc. [CITED: skills npm keywords field] |
| Claude Code `.claude/commands/` (.md files) | Skills (`.claude/skills/<name>/SKILL.md` directories) with frontmatter | ~2026 Claude Code merge of commands → skills | Commands still work; skills are the recommended forward path [CITED: code.claude.com/docs/en/skills] |
| NextAuth v4 with getServerSession | NextAuth/Auth.js v5 with universal `auth()` function | v5 stable late 2024 | `AUTH_*` env var prefix (was `NEXTAUTH_*`); edge-compatible middleware [CITED: authjs.dev migrating-to-v5] |
| Auth.js → Better Auth migration | Auth.js project is now part of Better Auth (announced 2026) | Recent | Project banner warns of migration. For v0.1 we stay on next-auth@5 beta; Better Auth is the upgrade path for v1+. [CITED: authjs.dev header banner verified 2026-04-23] |
| `gh` CLI standalone | `gh skill` subcommand shipped Apr 16, 2026 public preview | GitHub | Alt install path `gh skill install <repo>`; not used in Phase 14 v0.1 but worth tracking [CITED: Groundy article] |
| Regex secret detection | Verified + pattern detection (gitleaks 150, trufflehog 800 with live verify) | ~2025 | Pattern-only (gitleaks) is appropriate for filesystem scan; verify (trufflehog) is overkill for dashboard feature [CITED: appsecsanta.com 2026 benchmarks] |

**Deprecated/outdated:**
- **getServerSession (next-auth v4).** Replaced by `auth()` in v5. We already ship v5.
- **CronCreate MCP tool (hypothetical).** No such tool exists in the current ecosystem despite the phase brief mentioning it. Using scheduled_tasks.json + watcher is the real path.
- **`.claude/commands/` for new features.** Still supported but skills are recommended. Phase 14 builds skill-aware UI, not command-aware.

## Assumptions Log

Claims tagged `[ASSUMED]` in this research:

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | LLM cost ~$0.01/request for NL→cron parse with Sonnet | Summary, Alternatives | Low. Even at 5x, deterministic-first is still right — latency is the bigger issue. |
| A2 | skills.sh will respond to 15-min-spaced requests without rate-limiting | Pitfall 1 | Medium. If Vercel rate-limits at 10/min from a single IP, dashboard users sharing an IP (home network) could trip it. Mitigation: server-side cache + exponential backoff. |
| A3 | Skill ecosystem naming stable ("ClawHub" not "ClawdHub") | Executive summary | Low. User's directive says "ClawdHub"; research shows "ClawHub" at clawhub.ai is the match. Worth user confirmation in Discuss phase. |
| A4 | `jq` available on target system for watcher.sh | Pattern 5, watcher | Low. Used elsewhere in CAE (recon, timmy-delegate). Can be verified in Wave 0. |
| A5 | Installing skills to `~/.claude/skills/` via `npx skills add` does not require sudo | Install flow | Low. The CLI writes to home. Tested pattern on this machine (69 existing skills all home-writable). |
| A6 | gitleaks will be acceptable to install as a system binary (not a container or npm wrapper) | Environment Availability | Low. Most Linux dev setups tolerate `curl ... | sh`. If user objects, fall back to `detect-secrets` (pip-installable) — but that changes the stack choice. |
| A7 | Google OAuth client can be created by admin in time for Wave 3 | Environment Availability | Medium. User gating requires a real Google Cloud Console client ID. Wave 3 can be delayed or GitHub-only with role whitelist if Google isn't ready. |
| A8 | User directive "CronCreate tool pattern if available" presumes such a tool exists in the ecosystem; confirmed **it does not** | Summary, State of the Art | Low. Flagged to Discuss phase. We take the explicit fallback path the user offered. |
| A9 | Phase 14 runs AFTER phases 10, 11, 12, 13 complete | Project context | Low. ROADMAP lists 14 last; STATE shows 10 active. If user reorders, some assumptions about existing surfaces (left rail nav, security panel placement) may change. |
| A10 | User wants Google SSO not just Google OAuth identity (i.e., prefers SSO terminology + broad "sign in with Google" UX) | RBAC section | Low. Both paths look the same to the user; distinction matters only if user has a corporate Google Workspace hosted-domain restriction. Ask in Discuss phase. |

## Open Questions

1. **ClawHub vs. ClawdHub — name confirmation.**
   - What we know: user directive says "ClawdHub"; research shows "ClawHub" at clawhub.ai with matching description (skills marketplace for Claude Code, community-built).
   - What's unclear: is this a typo in the directive, or does a separate ClawdHub exist?
   - Recommendation: discuss-phase ask user "ClawHub at clawhub.ai — is this the one you meant?"

2. **Google Workspace domain restriction?**
   - What we know: user wants Google SSO for founder-facing auth.
   - What's unclear: restrict to `@diiant.com` only, or any Google account?
   - Recommendation: default to any-Google; add `hd` param if user confirms corporate-only.

3. **Audit log scope — every tool call or just mutations?**
   - What we know: "audit MCP tool invocations (who called what, when)."
   - What's unclear: Read tool calls too (potentially millions per session), or just state-changing tools?
   - Recommendation: default to Bash|Write|Edit|MultiEdit|Agent|Task (6 matchers, matches existing PostToolUse registration). Read/Grep/Glob are high-volume low-signal.

4. **Security panel trust score — user-overridable?**
   - What we know: heuristic score per skill.
   - What's unclear: can the user pin a skill to "trusted" even if heuristics say otherwise?
   - Recommendation: add a per-skill override stored in `.cae/trust-overrides.json`; surface as "Mark as trusted" button with admin-only gate.

5. **Scheduler task output — where does it go?**
   - What we know: watcher spawns via `cae execute-buildplan`.
   - What's unclear: does the dashboard need to show "last run output" inline, or is tmux tail sufficient?
   - Recommendation: reuse Phase 2 tmux-tail SSE pattern; add a "last-run log" link on each scheduled task row.

6. **Skill install — per-user or machine-global?**
   - What we know: Claude Code docs distinguish personal (`~/.claude/skills/`) vs. project (`.claude/skills/` in a repo).
   - What's unclear: if the dashboard user is `eric` but the daemon user is `timmy`, which `~/.claude/` does install target?
   - Recommendation: always target the user who runs the dashboard Next.js process (`os.homedir()`); surface a warning if `cae` agent user differs.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 1.6.1 (already configured — wired in Phase 8) |
| Config file | `vitest.config.ts` at repo root |
| Quick run command | `pnpm test lib/cae-schedule-parse lib/cae-skills-trust lib/cae-rbac` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-P14-01 | Skills page renders three tabs | integration (RTL) | `pnpm test app/build/skills` | ❌ Wave 0 |
| REQ-P14-02 | Catalog merges 3 sources, dedupes by name+owner | unit | `pnpm test lib/cae-skills-catalog` | ❌ Wave 0 |
| REQ-P14-02 | Install shells out to `npx skills add` | integration (spawn mock) | `pnpm test lib/cae-skills-install` | ❌ Wave 0 |
| REQ-P14-03 | SKILL.md frontmatter parse produces typed Skill | unit | `pnpm test lib/cae-skills-parse` | ❌ Wave 0 |
| REQ-P14-04 | NL parser: "every morning at 9am" → "0 9 * * *" | unit | `pnpm test lib/cae-schedule-parse` | ❌ Wave 0 |
| REQ-P14-04 | NL parser: fallback to LLM when rule fails | unit (LLM mocked) | `pnpm test lib/cae-schedule-parse-llm` | ❌ Wave 0 |
| REQ-P14-05 | scheduled_tasks.json r/w is atomic | unit | `pnpm test lib/cae-schedule-store` | ❌ Wave 0 |
| REQ-P14-05 | watcher.sh dispatches on due task, skips not-due | integration (shell test with fixture) | `bash tests/test-scheduler-watcher.sh` | ❌ Wave 0 |
| REQ-P14-06 | Google provider appears in sign-in form | integration (RTL) | `pnpm test app/signin` | partial — signin page exists |
| REQ-P14-07 | jwt callback persists role, session callback reads it | unit | `pnpm test lib/cae-rbac` | ❌ Wave 0 |
| REQ-P14-08 | Middleware redirects viewer on POST /api/queue/delegate | integration | `pnpm test middleware` | ❌ Wave 0 |
| REQ-P14-09 | Admin-only routes 403 for operator | integration | `pnpm test app/build/admin` | ❌ Wave 0 |
| REQ-P14-10 | Security page renders three sub-tabs | integration (RTL) | `pnpm test app/build/security` | ❌ Wave 0 |
| REQ-P14-11 | gitleaks scan parses JSON report correctly | unit (fixture JSON) | `pnpm test lib/cae-secrets-scan` | ❌ Wave 0 |
| REQ-P14-12 | Audit log reader parses JSONL with date filter | unit | `pnpm test lib/cae-audit-log` | ❌ Wave 0 |
| UAT | Eric can install a skill from catalog end-to-end | manual | `pnpm dev` + manual click-through | human |
| UAT | Eric's Google sign-in works + role is admin | manual | browser sign-in | human |

### Sampling Rate
- **Per task commit:** `pnpm test` subset for the file being edited (Vitest inference)
- **Per wave merge:** `pnpm test` full suite
- **Phase gate:** Full suite green + `pnpm lint` + `pnpm build` + manual UAT before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/fixtures/gitleaks-report.json` — fake gitleaks JSON output for parser tests
- [ ] `tests/fixtures/skills-sh-trending.html` — frozen HTML snapshot for scraper parse tests
- [ ] `tests/fixtures/clawhub-skills.html` — frozen clawhub HTML snapshot
- [ ] `tests/fixtures/skill-manifest/SKILL.md` — sample SKILL.md with all frontmatter fields for parser tests
- [ ] `tests/fixtures/scheduled-tasks-sample.json` — sample tasks registry
- [ ] `tests/test-scheduler-watcher.sh` — bash test harness for watcher script
- [ ] `vitest.config.ts` — no changes needed (already supports TypeScript + jsdom)
- [ ] Mock `child_process.spawn` pattern from Phase 2's tmux tests — extract to `tests/helpers/spawn-mock.ts` if not already there
- [ ] Install `gitleaks` on dev machine as Wave 0 prereq; document in README

## Security Domain

Phase 14 is **security-adjacent** — it installs third-party code, grants role-based privileges, and audits tool calls. ASVS scoped accordingly.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **yes** | NextAuth v5 OAuth (Google + GitHub); never hand-roll token handling |
| V3 Session Management | **yes** | NextAuth JWT with `NEXTAUTH_SECRET`; httpOnly cookies; SameSite=Lax default |
| V4 Access Control | **yes** | Role whitelist in env; resolved server-side only; never trust client claim |
| V5 Input Validation | **yes** | Zod schema on scheduled_tasks.json writes; reject invalid cron; sanitize skill repo URL before shell-out |
| V6 Cryptography | partial | Session signing via NextAuth (HMAC-SHA256 default); no custom crypto |
| V7 Errors & Logging | **yes** | Structured JSONL audit log; no secrets in error messages; gitleaks redact mode |
| V8 Data Protection | partial | Secrets only in env; no DB for v0.1; never write tokens to log |
| V10 Malicious Code | **yes** | **CORE** — installed skills ARE third-party code. Trust score + secret scan = partial defense; user education (explain-mode copy) = more |
| V12 Files & Resources | **yes** | Restrict skill install path to `~/.claude/skills/` — never allow arbitrary destination |
| V14 Config | **yes** | Env var for OAuth secrets; never commit; `.env.local` in `.gitignore` (verify) |

### Known Threat Patterns for Next.js + Skill-install feature

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Attacker gets admin role by spoofing email | Spoofing | Trust only JWT.email from OAuth provider's verified response, never user input |
| Malicious skill installed from attacker repo | Tampering | Trust score UI warning; owner allowlist for "staff picks"; gitleaks scan; explain-mode popup "this skill can run arbitrary code" |
| Arbitrary command execution via skill repo URL | Injection | Validate repo matches `^[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+$` or known URL schemes; shell-escape before spawn; use argv array not shell string |
| CSRF on /api/skills/install | Tampering | NextAuth CSRF token (built in); only accept POST with valid session cookie |
| Role escalation via client cookie tampering | Tampering | Role resolved server-side in jwt callback; JWT signed; never read role from cookie by name |
| Audit log tampering to hide compromise | Tampering | Append-only JSONL; file permissions 0644; offline rotation (deferred v2) |
| Scheduled task injection (attacker writes scheduled_tasks.json directly) | Tampering | File permissions 0600 owned by dashboard user; only dashboard API can write; watcher validates JSON schema before dispatch |
| Secrets leak via gitleaks log into audit surface | Info Disclosure | Use `--redact` always; never surface raw matched text to UI, only "N secrets found" + rule name |
| Info disclosure: sign-in page shows "user exists" | Info Disclosure | NextAuth handles uniformly; don't customize error messages to differentiate |
| Rate-limit abuse on NL-parse (LLM costs) | Denial | Server-side rate-limit 10/min/user on /api/schedule/parse; client debounce 500ms |

## Proposed 4-6 Plan Waves

**Wave 0 — Scaffolding (parallel-safe, all greenfield)**
- Install deps: `cronstrue@3.14.0`, `cron-parser@5.5.0`, `chrono-node@2.9.0`
- Install gitleaks binary on dev box; document in README
- Create test fixture files (SKILL.md sample, gitleaks report, skills-sh HTML snapshot, clawhub HTML snapshot, scheduled-tasks sample)
- Create empty stub files: `scheduled_tasks.json = []`, `.cae/metrics/tool-calls.jsonl`, `.cae/metrics/skill-scans.jsonl`, `.cae/metrics/scheduler.jsonl`
- Add label dictionary keys: `skills.*`, `schedule.*`, `permissions.*`, `security.*`
- Add types: `lib/cae-types.ts` extensions for CatalogSkill, ScheduledTask, Role, AuditEntry
- Add Zod schemas for API route validation
- Create `tools/audit-hook.sh` + update `~/.claude/settings.json` PostToolUse registration (extend, don't replace)
- Extend middleware.ts matcher for `/build/skills`, `/build/schedule`, `/build/admin`, `/build/security`
- Install cae-scheduler-watcher.sh crontab line (idempotent check)

**Wave 1 — Skills Hub (3 parallel tracks)**
- 1a: Catalog aggregator (`lib/cae-skills-catalog.ts`) + scrapers (skills.sh + clawhub) + local reader + dedupe
- 1b: Install shell-out (`lib/cae-skills-install.ts`) + `/api/skills/install` SSE route
- 1c: UI — `/build/skills/page.tsx` + CatalogGrid + SkillCard + SkillDetailDrawer (SKILL.md render reuses Phase 8 markdown primitive)

**Wave 2 — NL cron scheduler (2 parallel tracks)**
- 2a: Parser — `lib/cae-schedule-parse.ts` deterministic rule table + chrono-node fallback; `lib/cae-schedule-parse-llm.ts` (mock-ready); Zod validation
- 2b: Store + watcher + UI — `lib/cae-schedule-store.ts` JSON r/w; `scripts/cae-scheduler-watcher.sh`; `/build/schedule` page + NL input + cron preview; `/api/schedule/*` routes

**Wave 3 — RBAC + Google SSO (sequential — auth is load-bearing)**
- 3a: `auth.ts` — add Google provider + jwt/session callbacks + role type augmentation
- 3b: `middleware.ts` — role gate helpers; 403 route; `.env.local` template
- 3c: `/build/admin/roles` — admin-only role viewer (env-read only for v0.1)
- 3d: RoleGate primitive + apply to operator-only actions across existing Build surface (queue delegate, workflows run-now, scheduled-task create/delete)

**Wave 4 — Security panel (3 parallel tracks)**
- 4a: Trust score — `lib/cae-skills-trust.ts` heuristic + TrustBadge component + per-skill explainer
- 4b: Secret scan — `lib/cae-secrets-scan.ts` gitleaks shell-out + JSON parse + on-install hook + on-demand rescan button
- 4c: Audit log — `lib/cae-audit-log.ts` JSONL reader + `/build/security/audit` filterable table + date range + tool-name filter

**Wave 5 — Integration + VERIFICATION**
- 5a: End-to-end tests (Playwright if already configured; otherwise RTL integration tests covering click-through)
- 5b: `14-VERIFICATION.md` with manual UAT checklist
- 5c: Update `docs/ENV.md` for Google OAuth + whitelist env vars
- 5d: Update left-rail nav (add Skills, Schedules, Security icons — Permissions lives under admin)
- 5e: Auto-approval gate: Phase 14 can auto-approve if `pnpm test` + `pnpm lint` + `pnpm build` all green AND user has signed in with Google at least once (proves Wave 3 integration worked)

**Optional Wave 6 (if scope balloons)**
- Deferred ideas realised: publishing skills upward, DB adapter for roles, or skill uninstall UI. Move to Phase 15 by default.

## Competitor Reference Links

- **skills.sh** — https://skills.sh/ (ecosystem leader, 91k installs)
- **ClawHub** — https://clawhub.ai/ (community alternative, Convex backend)
- **Skills Directory (skillsdirectory.com)** — security-focused, "grade-A" skills
- **SkillsMP (skillsmp.com)** — agent skills marketplace
- **MCP Market** — https://mcpmarket.com/tools/skills
- **Anthropic official skills repo** — https://github.com/anthropics/skills
- **Vercel Labs skills repo** — https://github.com/vercel-labs/skills (npm `skills` CLI)
- **GitHub `gh skill` preview** — announced Apr 16, 2026 (cross-tool standard push)
- **Claude Code plugin marketplace (Anthropic official)** — https://github.com/anthropics/claude-plugins-official (different mechanism: `/plugin install`, uses `marketplace.json` schema — Phase 14 deliberately picks skills over plugins per user scope, but this is the plugin parallel)
- **Caveman plugin** — https://github.com/JuliusBrussee/caveman (installed in this env — example of the plugin flow)

## Sources

### Primary (HIGH confidence)
- **Claude Code skills docs:** https://code.claude.com/docs/en/skills — canonical SKILL.md frontmatter + directory layout [VERIFIED 2026-04-23]
- **Anthropic skills repo:** https://github.com/anthropics/skills [CITED]
- **Vercel Labs skills CLI:** https://github.com/vercel-labs/skills — install commands, source formats [VERIFIED via GitHub README scrape]
- **Auth.js RBAC guide:** https://authjs.dev/guides/role-based-access-control [VERIFIED 2026-04-23]
- **Auth.js v5 migration:** https://authjs.dev/getting-started/migrating-to-v5 [CITED]
- **cronstrue:** https://github.com/bradymholt/cRonstrue — v3.14.0 [VERIFIED via npm view]
- **cron-parser:** https://www.npmjs.com/package/cron-parser — v5.5.0 [VERIFIED via npm view]
- **chrono-node:** https://github.com/wanasit/chrono — v2.9.0 [VERIFIED via npm view]
- **gitleaks:** https://github.com/gitleaks/gitleaks — 24.4k stars, filesystem scan mode [CITED]
- **Claude plugins marketplace schema:** https://anthropic.com/claude-code/marketplace.schema.json [VERIFIED on disk at /root/.claude/plugins/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json]
- **Local dashboard code:** /home/cae/ctrl-alt-elite/dashboard/{auth.ts,middleware.ts,package.json,app,lib} [VERIFIED]

### Secondary (MEDIUM confidence)
- **skills.sh HTML structure** (scraped 2026-04-23) — no stable JSON API; `/trending` and `/` return HTML with embedded JSON in `__NEXT_F__` payload
- **clawhub.ai HTML structure** (scraped 2026-04-23) — Convex-backed, auth-gated for mutations; browse is public HTML
- **LogRocket "best auth library 2026"** — https://blog.logrocket.com/best-auth-library-nextjs-2026/ — market-survey context
- **AppSecSanta gitleaks vs trufflehog 2026** — https://appsecsanta.com/sast-tools/gitleaks-vs-trufflehog — benchmark comparison
- **CronGen system-cron vs node-cron** — https://crongen.com/blog/nodejs-cron-jobs-system-vs-node-cron — tradeoff analysis
- **Felo AI ClawHub intro** — https://felo.ai/blog/clawhub-skills-marketplace-claude-code/ — community overview

### Tertiary (LOW confidence)
- **Groundy "gh skill"** — https://groundy.com/articles/github-clis-gh-skill-command-one-standard-to-rule-claude-code-copilot-cursor/ — single source, not cross-verified with github.com official announcement (search returns it in gh 2.x changelogs but I haven't hit the primary source)
- **Text2Cron** — https://text2cron.com/ — mentioned as an NL→cron service; not used in Phase 14 design, noted only for reference

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via `npm view` on 2026-04-23
- Architecture: HIGH — Next.js App Router + NextAuth v5 + file-based state is the project's established pattern; Phase 14 reuses Phase 1/2/8 plumbing
- Pitfalls: HIGH — drawn from framework docs + prior CAE experience (hydration, middleware edge runtime, cron TZ all known traps)
- Skills Hub data shape: MEDIUM — scraping is the only browse path; may break if skills.sh or clawhub redesign
- NL cron LLM fallback: MEDIUM — deterministic rules are solid, LLM fallback accuracy unverified (A1 assumption)
- Security panel gitleaks: HIGH for tool choice, MEDIUM for false-positive rate on SKILL.md examples
- RBAC env-whitelist: HIGH for v0.1 scope; would need re-research if user wants DB adapter

**Research date:** 2026-04-23
**Valid until:** 30 days for auth + cron libs (stable); 14 days for skills ecosystem (fast-moving — `gh skill` public preview just landed 2026-04-16, ecosystem may shift)
