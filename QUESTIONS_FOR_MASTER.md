# Questions Before Phase 1 Starts
**Date:** 2026-04-16
**Rules:** Don't guess. Ask.

---

## Blocker questions (Phase 1 cannot start without answers)

### Q1. Telegram bot — new or reuse Timmy's?
The Telegram approval gate needs a bot. Two options:
- **(a) Create a dedicated CAE bot.** Cleaner separation. Approvals for CAE actions never bleed into Timmy's inbox-zero flow. Requires a new bot token from @BotFather.
- **(b) Reuse Timmy's bot.** One less token to manage. But CAE approval pings mix with Timmy's daily briefs and follow-up nudges. Harder to set up auto-replies / silencing per project.

Which do you want? My recommendation: (a) — clean separation, especially when Shift starts creating CAE instances for non-developers who don't have Timmy.

### Q2. LEVER redeployment handoff doc name
The pivot message references `LEVER_Redeployment_Handoff.md`. The file that exists is `LEVER_Redeployment_Handoff_v2.md`. They appear to be the same intent but I want to confirm I'm using the right doc.

Also, CONTEXT.md at `/home/lever/lever-protocol/CONTEXT.md` already says "Bug 1 (Vault → wrong RD) — FIXED" on March 20, 2026. The v2 handoff describes the redeployment that was done. Is Phase 1's dogfood:
- **(a) Re-run a past redeployment** for validation purposes (no on-chain activity)
- **(b) A new redeployment** for a different bug/problem that's surfaced since
- **(c) Verify correctness** of the March 20 redeployment by running CAE through the handoff as if doing it for the first time, comparing against current state

If (b), I need the new handoff doc. If (a) or (c), T16 (live redeploy) doesn't make sense — should be T16: verify state matches handoff post-conditions.

### Q3. Redeployment scope: 3 contracts or 4?
The pivot message says "Vault + ExecutionEngine + SettlementEngine" (3).
`LEVER_Redeployment_Handoff_v2.md` says 4: LeverVault, ExecutionEngine, SettlementEngine, LiquidationEngine.

Is the LiquidationEngine redeployment:
- Already done (not in scope for the dogfood)?
- Separate from this pivot's dogfood?
- Or was the pivot message shorthand?

### Q4. Gemini CLI install story
Do you already have Gemini CLI installed locally with OAuth, or does CAE need to install + authenticate it on this server? If the latter, the OAuth flow requires a browser for the first-time auth — how do you want to handle that on a headless server? Options:
- **(a)** SSH tunnel a browser, do OAuth once, cache credentials
- **(b)** Use a service account JSON (violates Decision 1 "no API keys")
- **(c)** Do OAuth on your local machine, copy the cached credentials to the server

(c) is most common for headless deployments. Confirm approach.

### Q5. Where does CAE live on the file system?
Currently the CAE code is at `/home/cae/ctrl-alt-elite/`. Phase 1 adds `bin/cae`, adapters, new configs, etc.

- Do you want `bin/cae` on the system PATH (e.g., symlinked to `/usr/local/bin/cae`) so `cae execute-phase` works from any project directory?
- Or scoped to the cae user, invoked as `/home/cae/ctrl-alt-elite/bin/cae`?

Relevant because Shift users will run CAE in their own project directories, not inside `/home/cae/`.

---

## Design questions (opinions welcome but not blockers)

### Q6. Sentinel fallback behavior
If Gemini CLI produces invalid JSON for Sentinel's verdict (Decision 9 risk materializes), what should happen?

- **(a) Auto-retry with same Gemini prompt once, then fall back to Claude Opus Sentinel** (Phase 1 behavior: still cross-tier diversity even if not cross-provider)
- **(b) Hard halt, ping Telegram**, don't auto-fallback
- **(c) Auto-parse via a markdown-to-JSON converter** (Decision 9 option a)

My lean: (a) with a warning logged. Robust enough for LEVER without requiring Decision 9's parser work.

### Q7. Forge failure escalation to Phantom
Decision 6 says "3 Forge failures spawns Phantom." For Phase 1:
- Phantom uses Claude Sonnet with a debugger system prompt (existing `agents/cae-phantom.md` persona)
- Should Phantom have access to a larger tool budget or longer turn limit than Forge? (E.g., 50 turns vs. Forge's 30.)

My lean: yes, 50 turns, keep other limits same. Phantom is a specialist escalation so it deserves more room to diagnose.

### Q8. Dangerous actions list
Decision 5 lists: deploy, push-to-main, force-push, modify-github, modify-deploy, delete-files.

For LEVER specifically, "deploy" maps to `forge script --broadcast`. But Forge (the agent) also needs to run `forge script` without `--broadcast` for simulation. Should we:
- **(a) Gate on any `forge script`** (overly cautious, lots of approval pings during simulation)
- **(b) Gate only on the `--broadcast` flag** (trust simulation is safe)
- **(c) Gate on broadcast + any command that touches production wallets** (more nuanced but complex to detect)

My lean: (b) — gate on `--broadcast` and any tx submission. Simulation is always safe and common enough that (a) becomes noise.

### Q9. Model-per-role overrides — per task or per project?
Decision 2 says models are "interchangeable via config, not hardcoded." For Phase 1:
- **Project-level** override: set once in project's config, applies to all tasks.
- **Task-level** override: set per task in PLAN.md frontmatter.

My lean: both — project-level is default, task-level overrides when present. No extra work vs. just project-level, and Shift will want to do this.

### Q10. Multica: keep or defer?
Multica status bridge works. But Phase 1's safety layer uses Telegram for approvals, and observability via Telegram + logs. Multica becomes a nice-to-have for Phase 1, not essential.

- **(a) Keep wired** — status updates still flow to Multica during LEVER dogfood
- **(b) Defer** — disable the hook, re-enable in a later phase

My lean: (a). It works and it's useful for you to see progress at a glance. But if I discover it adds overhead during subprocess runs, I'll flag it.

---

## Informational — flagging things but not asking for decisions

- The new direction drops the 10-persona roster for Phase 1 (Phantom exists as escalation target, Prism/Flux not built). I'll keep the docs for those personas since they cost nothing and rebuilding them later is cheap.
- The existing agent_skills injection path stays for Arch (planning), Aegis (security review when smart contracts detected), and as a fallback for Sentinel. It's not redundant — it's the Claude-only path.
- `/home/timmy/.hermes/` (Timmy) is untouched by this pivot. The Timmy project continues on its own track.

---

## Summary

**Must answer before Phase 1 starts (blockers):** Q1-Q5.
**Should answer to remove my assumptions (design):** Q6-Q10.

I'll stop here and wait for your input on the three documents + these questions.
