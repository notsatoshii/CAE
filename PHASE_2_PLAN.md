# CAE Phase 2 Plan
**Date:** 2026-04-17
**Status:** Draft — awaiting Master approval on Shift scope

---

## What's in Phase 2 (user's explicit picks)

**IN:**
- **H1 — Herald** (gsd-doc-writer wrap; user-facing project docs)
- **H3 — Timmy bridge** (Hermes `/delegate` → CAE)
- **H-SHIFT — Shift** (normie-facing project genesis tool; expanded scope)

**OUT (postponed to Phase 3+):**
- LEVER redeployment
- Multi-project orchestration
- Shift integration v2 (templates, teams)
- Metrics UI, Slack, rollback automation

---

## H1 — Herald (~1-2 days)

**Goal:** CAE produces user-facing project docs (README.md, ARCHITECTURE.md, DEPLOYMENT.md) as a separate role from Scribe (internal AGENTS.md).

**Deliverables:**
- `skills/cae-herald/SKILL.md` — persona injected into gsd-doc-writer wraps
- `agents/cae-herald.md` — persona doc (for direct-prompt fallback)
- Uncomment `herald:` in `config/agent-models.yaml`
- Wire `gsd-bridge.gsd-doc-writer.model_from: herald`
- Add contract entry to `docs/WRAPPED_AGENT_CONTRACTS.md`
- Test via toy project: after phase completes, Herald runs on request (`cae herald <project>`)

**Acceptance:**
- `cae herald` CLI subcommand produces README.md that reflects actual code (not placeholders)
- Herald invoked with `--doc-type readme|architecture|deployment` picks the right template
- Scribe's AGENTS.md NOT touched by Herald (clean separation)

---

## H3 — Timmy bridge (~2-3 days)

**Goal:** Timmy's `/delegate` skill hands a buildplan to CAE. CAE executes async, reports completion via Hermes notification.

**Architecture:**
```
Timmy (Hermes) → /delegate "build X" →
    writes buildplan to /home/cae/inbox/<task-id>/BUILDPLAN.md →
    fires `cae execute-buildplan <task-id>` in detached tmux →
    CAE runs (long-running) →
    on completion: writes /home/cae/outbox/<task-id>/DONE.md →
    Hermes polls or filesystem-watches outbox →
    Hermes notification (Telegram/WhatsApp) to user
```

**Deliverables:**
- `skills/delegate` skill in `/home/timmy/.hermes/skills/`
- CAE orchestrator subcommand `cae execute-buildplan <task-id>`
- `/home/cae/inbox/` + `/home/cae/outbox/` directory contract
- Hermes file-watcher hook that fires notification when DONE.md appears
- Optional: buildplan validation (Claude reviews plan before CAE spins up)

**Acceptance:**
- Type `/delegate add dark mode toggle to project X` in Timmy
- Timmy writes buildplan, launches CAE, confirms "delegated" to user
- Within N minutes, user gets Telegram/WhatsApp ping "CAE finished task Y, 3 commits pushed"
- CAE output visible in repo + summary file

---

## H-SHIFT — Shift (Phase 2 hero feature)

**Explicit scope:** **Full guide for a non-dev normie.** Expanded below pending answers to 3 questions.

### Open questions (blocking — answer before building)

1. **Interface:** (a) Claude Code skill `/shift-start`, (b) web app, (c) Telegram bot?
2. **Output scope:** (a) `.planning/` artifacts only, (b) + GitHub repo, (c) + hosting/domain/deploy?
3. **Normie level:** (a) technical person who hates boilerplate, (b) founder/PM, (c) complete non-technical user?

### Default scope (if no answer in reasonable time)

**Interface:** Claude Code skill `/shift-start` (normie opens Claude Code, types one command, chat-driven intake).

**Output:** Ready-to-execute CAE project — `.planning/PROJECT.md`, `.planning/ROADMAP.md`, initial `.planning/phases/01-*` stub, GitHub repo created & pushed, `.env.example` + env-var collection flow. Stops before deploy.

**Target user:** Founder/PM (level b). Can follow click-here instructions; won't know what a git commit is; shouldn't have to know.

### Proposed Shift architecture

```
/shift-start
  ↓ [conversational intake — plain English]
  Q: "What are you building?"
  Q: "Who is it for?"
  Q: "How does someone use it? Walk me through."
  Q: "Do you have a name? (if not I'll suggest 3)"
  Q: "Any reference products it's like?"
  ↓
  [Claude synthesizes project brief]
  "Here's what I heard. Did I miss anything? [yes/no]"
  ↓
  [User confirms] → Scout (Gemini) researches domain/stack
  ↓
  [Arch proposes tech stack in plain English: "I'll use Next.js (easy hosting) + Postgres (reliable database). Sound good, or you want something else?"]
  ↓
  [Arch generates ROADMAP.md — 5-8 phases in plain English]
  "Here's the plan. [preview rendered]. Ship it? [ship it / refine / explain]"
  ↓
  [User approves] → Shift creates GitHub repo via gh CLI
  ↓
  [Shift collects needed env vars via chat, writes .env.example + secure .env]
  ↓
  [Shift prints single command: `cae autonomous` to ship everything]
  Or: [Shift offers to run autonomous mode directly]
```

**Differentiators from existing GSD `/gsd-new-project`:**
- Never shows YAML / frontmatter / file paths during intake
- Asks ONE question at a time (not "what's your milestone, requirements, and success criteria?")
- Translates jargon on the fly ("CI/CD" → "automated testing + deployment")
- Offers sensible defaults at every step — user says "whatever you recommend" → ship it
- Post-intake: generates a one-page project summary the normie can send to others
- Hand-holds through error recovery (npm errors rewritten in plain English)

**Deliverables:**
- `skills/shift-start/SKILL.md` — Claude Code skill registered for normie entry
- `skills/shift-start/intake.md` — conversational flow definition
- `skills/shift-start/stack-presets.yaml` — ~10 sensible default stacks (web app, api, mobile, discord bot, CLI tool, ML, etc.)
- `skills/shift-start/env-collection.md` — how to securely collect API keys
- `bin/shift` — optional headless entry (for scripted testing)
- Docs: `docs/SHIFT_USER_GUIDE.md` — normie-readable

**Acceptance:**
- A non-dev sits at Claude Code. Types `/shift-start`. 10 minutes later has a working CAE project with GitHub repo created.
- At no point during intake do they see a file path, YAML, or command they don't recognize.
- If they say "I don't know" to any question, Shift either offers a default or asks differently.

**Out of scope (Phase 3+):**
- Automatic deploy to Vercel/Netlify/Railway
- Custom domain purchase + DNS
- Billing integration (Stripe) templates
- Team/collaboration features

---

## Sequencing + time

| Task | Days | Dependencies |
|------|------|--------------|
| H1 Herald | 1-2 | None |
| H3 Timmy bridge | 2-3 | Hermes installed at `/home/timmy/.hermes/` (✓) |
| H-Shift core intake | 3-5 | Herald (for generated READMEs) |
| H-Shift GitHub + env flow | 1-2 | H3 not required |
| H-Shift user guide docs | 1 | Herald (eat own dog food) |
| Integration test — full normie flow | 1-2 | All above |

**Total:** ~9-15 working days.

---

## Phase 2 acceptance gate

**Dogfood test:** Take a non-developer (the user's partner, a friend), sit them at Claude Code. Watch them go from "I want to build X" → shipped MVP. Time it. If they need developer rescue more than twice, the UX failed — iterate.

**Secondary:** Timmy delegates a real task to CAE, gets Telegram ping when done. End-to-end.

**Tertiary:** Herald writes a README for the CAE repo itself that Master would actually publish.

---

## Risks

- **Shift is big.** Possible scope-creep to "make Lovable/Bolt but with CAE." Defend scope at hero feature: 10-min intake → ready-to-execute project. Deploy is Phase 3.
- **Normie testing is expensive.** Real non-devs aren't always available. Proxy: use Claude instance simulating a non-dev.
- **Timmy bridge introduces state-sync bugs.** File-mediated contract with explicit DONE.md sentinel keeps it simple; resist temptation to add pub/sub.
