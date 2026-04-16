# CAE Config Schema
**Version:** `cae_config_version: 1`
**Date:** 2026-04-16
**Stability:** PUBLIC API. See commitments below.

## Purpose
This document describes the configuration surface CAE accepts. It is the contract between CAE and any system that generates CAE configs — including **Shift** (separate project) which will generate configs for non-developer users.

## Stability commitments

Anything documented here as part of **v1** will be honored as follows for future versions:

1. **Existing field names are not renamed.** A v1 field stays addressable by that name indefinitely.
2. **Existing field types are not narrowed.** A field typed `string | null` cannot become `string` in a minor version.
3. **Defaults may change** (we reserve the right to update defaults for usability). Any default change is explicitly noted in CHANGELOG.md.
4. **New fields may be added.** Consumers that ignore unknown fields will keep working.
5. **Deprecations go through a major version bump.** A field marked deprecated stays readable (with a warning) for one full major version before removal.
6. **`cae_config_version` must be present.** Configs without it are rejected. This is how we route to the right schema validator.

Shift targets schema v1. CAE preserves backward compatibility with v1 until Shift declares support for v2.

---

## File map

A project using CAE carries these config files. All are text; comments are supported where noted.

| File | Mandatory? | Purpose |
|------|-----------|---------|
| `.planning/config.json` | Yes (GSD project requirement) | Baseline GSD config. CAE adds its own keys. |
| `config/agent-models.yaml` | Yes | Maps CAE roles (Nexus, Arch, Forge, etc.) to model + provider + invocation mode |
| `config/circuit-breakers.yaml` | Yes | Limits for turn count, retries, parallelism, tokens |
| `config/dangerous-actions.yaml` | Yes | Patterns that trigger Telegram approval gate |
| `config/cae-user.yaml` | Yes | Per-user settings (Telegram chat target, bot reference, preferred model profile) |
| `config/cae-schema.json` | No (referenced) | JSON Schema validator for all of the above |
| `AGENTS.md` | Yes (created by cae-init) | Team knowledge base; Scribe maintains it |
| `KNOWLEDGE/*.md` | No | Overflow from AGENTS.md, conditionally loaded by task tags |

---

## v1 schema — field reference

### `.planning/config.json` (CAE additions to GSD config)

```json
{
  "cae_config_version": 1,
  "agent_skills": {
    "gsd-executor": [".claude/skills/cae-forge"],
    "gsd-planner": [".claude/skills/cae-arch"],
    "gsd-verifier": [".claude/skills/cae-sentinel"],
    "gsd-doc-writer": [".claude/skills/cae-scribe"]
  },
  "model_overrides": {
    "gsd-planner": "claude-opus-4-6",
    "gsd-executor": "claude-sonnet-4-6"
  },
  "resolve_model_ids": true
}
```

| Key | Type | Required | Default | Purpose |
|-----|------|----------|---------|---------|
| `cae_config_version` | integer | **yes** | — | Must be `1` |
| `agent_skills` | object | no | `{}` | Per GSD-agent-type array of skill paths. For wrapping persona SKILL.md into GSD agents that ARE invoked from a Claude Code session. |
| `model_overrides` | object | no | `{}` | Per GSD-agent-type explicit model ID. Bypasses GSD's profile system. |
| `resolve_model_ids` | boolean | no | `true` | Map short aliases (opus/sonnet/haiku) to full IDs. Always `true` in CAE. |

### `config/agent-models.yaml`

```yaml
# CAE Role → Model + Provider + Invocation Mode
# Version: 1
#
# Fields per role:
#   model         : string  — full model ID or short alias (opus/sonnet/haiku/gemini-2.5-pro/gemini-flash)
#   provider      : enum    — claude-code | gemini-cli
#   invocation_mode:
#     type: wrap-gsd-agent
#     name: gsd-plan-checker     # which GSD agent to --agent-invoke
#   — OR —
#     type: direct-prompt
#     system_prompt_file: agents/cae-forge.md   # our own system prompt
#   effort        : optional — low | medium | high | max (default: max for Claude, n/a for Gemini)
#   modes         : optional — object mapping mode name to invocation overrides (only used by Scout currently)

roles:
  nexus:
    model: claude-opus-4-6
    provider: claude-code
    invocation_mode:
      type: direct-prompt
      system_prompt_file: agents/cae-nexus.md
    effort: max

  arch:
    model: claude-opus-4-6
    provider: claude-code
    invocation_mode:
      type: wrap-gsd-agent
      name: gsd-planner
    effort: max

  arch_plan_check:
    # Sub-role Arch uses when validating a plan (not authoring)
    model: claude-opus-4-6
    provider: claude-code
    invocation_mode:
      type: wrap-gsd-agent
      name: gsd-plan-checker
    effort: max

  forge:
    model: claude-sonnet-4-6
    provider: claude-code
    invocation_mode:
      type: direct-prompt
      system_prompt_file: agents/cae-forge.md
    effort: max

  sentinel:
    model: gemini-2.5-pro
    provider: gemini-cli
    invocation_mode:
      type: direct-prompt
      system_prompt_file: agents/cae-sentinel-gemini.md  # methodology-ported from gsd-verifier
    # Fallback declared in circuit-breakers.yaml handles Gemini JSON failure
    fallback:
      role: sentinel_fallback

  sentinel_fallback:
    model: claude-opus-4-6
    provider: claude-code
    invocation_mode:
      type: wrap-gsd-agent
      name: gsd-verifier

  scout:
    model: gemini-2.5-pro   # default for mode=project
    provider: gemini-cli    # default for mode=project
    modes:
      project:
        model: gemini-2.5-pro
        provider: gemini-cli
        invocation_mode:
          type: direct-prompt
          system_prompt_file: agents/cae-scout-gemini.md
      phase:
        model: claude-sonnet-4-6
        provider: claude-code
        invocation_mode:
          type: wrap-gsd-agent
          name: gsd-phase-researcher
      ad-hoc:
        model: claude-sonnet-4-6
        provider: claude-code
        invocation_mode:
          type: direct-prompt
          system_prompt_file: agents/cae-scout.md
    default_mode: phase

  scribe:
    model: gemini-flash
    provider: gemini-cli
    invocation_mode:
      type: direct-prompt
      system_prompt_file: agents/cae-scribe-gemini.md

  phantom:
    model: claude-sonnet-4-6
    provider: claude-code
    invocation_mode:
      type: wrap-gsd-agent
      name: gsd-debugger
    effort: max  # Phantom gets max effort because escalations are hard

  prism:
    model: claude-sonnet-4-6
    provider: claude-code
    invocation_mode:
      type: wrap-gsd-agent
      name: gsd-ui-checker

  aegis:
    model: claude-opus-4-6
    provider: claude-code
    invocation_mode:
      type: direct-prompt
      system_prompt_file: agents/cae-aegis.md
    effort: max

  flux:
    model: claude-sonnet-4-6
    provider: claude-code
    invocation_mode:
      type: direct-prompt
      system_prompt_file: agents/cae-flux.md

  # Herald deferred to Phase 2
  # herald:
  #   model: claude-sonnet-4-6
  #   provider: claude-code
  #   invocation_mode:
  #     type: wrap-gsd-agent
  #     name: gsd-doc-writer
```

### `config/circuit-breakers.yaml`

```yaml
# Version: 1
# All limits are hard stops unless noted.

per_forge:
  max_turns: 30                   # Agent tool-call turns
  max_input_tokens: 500000        # Input tokens per task
  max_output_tokens: 100000       # Output tokens per task

per_task:
  max_retries: 3                  # Forge re-spawns before escalation

parallelism:
  max_concurrent_forge: 4         # File-lock semaphore

escalation:
  forge_failures_spawn_phantom: 3
  phantom_failures_halt: 2
  on_halt:
    telegram_notify: true

sentinel:
  max_json_parse_failures: 2      # Before falling back to sentinel_fallback role

gemini_cli:
  # Gemini-specific; absent keys means "no CAE-imposed cap, only CLI defaults"
  per_call_timeout_seconds: 600

claude_code:
  per_call_timeout_seconds: 1800  # Larger because max-effort Opus is slow
```

### `config/dangerous-actions.yaml`

```yaml
# Version: 1
# Patterns that require Telegram approval before execution.

patterns:
  - name: broadcast_transaction
    regex: 'forge\s+script.*--broadcast\b'
    description: On-chain transaction broadcast
    telegram_timeout_minutes: 30

  - name: git_push_main
    regex: 'git\s+push.*\b(main|master)\b'
    description: Push to main/master branch
    telegram_timeout_minutes: 15

  - name: git_force_push
    regex: 'git\s+push.*(--force|-f\b)'
    description: Force push (destructive)
    telegram_timeout_minutes: 15

  - name: modify_github_settings
    regex: 'gh\s+(repo|api)\s+(edit|delete)'
    description: Modify GitHub repo settings
    telegram_timeout_minutes: 15

  - name: delete_files_recursive
    regex: 'rm\s+-rf\b|\brmdir\b'
    description: Recursive file deletion
    telegram_timeout_minutes: 10

  - name: deploy_command
    regex: '\bdeploy\b|\brelease\b'
    description: Generic deploy (may trigger false positives — tune)
    telegram_timeout_minutes: 15

# Patterns are evaluated against planned shell commands BEFORE execution.
# If any pattern matches: halt, send Telegram, await approval.
```

### `config/cae-user.yaml`

```yaml
# Version: 1
# Per-user settings. Shift generates this for a non-developer user.

user_id: "master"                       # Display name in logs
telegram:
  bot:
    name: "cae-dedicated"               # or "timmy" if sharing
    chat_id_env: CAE_TELEGRAM_CHAT_ID   # env var name, not the value itself
  notification_level: all               # all | important | none

profile: balanced                       # quality | balanced | budget (reserved for future)

preferences:
  auto_merge_on_approve: true           # If false, additional gate before merging approved work
  verbose_logging: false
```

---

## Required file states CAE assumes

At runtime, CAE expects:

1. `.planning/` exists and contains valid GSD state
2. `config/agent-models.yaml` parses and validates against schema
3. `config/circuit-breakers.yaml` parses and validates
4. `config/dangerous-actions.yaml` parses and validates
5. `config/cae-user.yaml` parses, Telegram env var is set
6. `AGENTS.md` exists (may be empty template)
7. `claude` CLI on PATH, authenticated (OAuth)
8. For configs that route any role to `provider: gemini-cli`: `gemini` CLI on PATH, authenticated

CAE fails fast with clear messages if any of these is missing. No silent degradation.

---

## For Shift

Shift's job is to interview a non-developer and output these files. Specifically, the five config files above are Shift's primary output. `agents/*.md` prompt files can be left as CAE defaults — Shift doesn't need to touch them unless the user has specific persona preferences.

Shift MUST:
- Emit `cae_config_version: 1` in every config file that accepts it
- Honor required fields (see field reference tables above)
- Validate the output against `config/cae-schema.json` before handing off

Shift MAY:
- Override default models per role (e.g., if user prefers Opus for Forge)
- Extend `dangerous-actions.yaml` with project-specific patterns
- Set `cae-user.yaml` preferences

Shift MUST NOT:
- Modify existing CAE persona prompts (`agents/*.md`)
- Remove required fields
- Downgrade `cae_config_version` to 0 or omit it

---

## Changelog

### v1 (2026-04-16)
Initial public schema. Matches Phase 1 implementation scope.

Known gaps to address before Phase 2:
- `herald` role (commented out pending Phase 2)
- `aegis` trigger conditions (auto-activation when `.sol` etc. detected) — currently hardcoded in cae-init.sh, should move to config
- `modes` field only exists on `scout`; may expand to other roles if needed

End of CONFIG_SCHEMA.md.
