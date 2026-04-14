#!/usr/bin/env bash
set -euo pipefail

# Ctrl+Alt+Elite — Project Initialization
# Sets up .planning/config.json with CAE agent skills and model routing.
# Run this AFTER /gsd-new-project has created the .planning/ directory.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAE_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="${1:-.}"

cd "$PROJECT_ROOT"

# ─── Validate ──────────────────────────────────────────────────────────
if [ ! -d ".planning" ]; then
  echo "Error: .planning/ directory not found."
  echo "Run /gsd-new-project first, then run this script."
  exit 1
fi

echo "Initializing Ctrl+Alt+Elite for $(basename "$(pwd)")..."

# ─── Copy skill files into project ────────────────────────────────────
echo "Installing CAE skills..."
mkdir -p .claude/skills

for skill_dir in "$CAE_ROOT/skills"/cae-*/; do
  if [ -d "$skill_dir" ]; then
    skill_name="$(basename "$skill_dir")"
    mkdir -p ".claude/skills/$skill_name"
    cp "$skill_dir/SKILL.md" ".claude/skills/$skill_name/SKILL.md"
    echo "  + $skill_name"
  fi
done

# ─── Smart contract detection ─────────────────────────────────────────
SMART_CONTRACT_MODE=false
SC_MARKERS=("*.sol" "*.vy" "foundry.toml" "hardhat.config.js" "hardhat.config.ts" "hardhat.config.cjs" "truffle-config.js" "remappings.txt")

for marker in "${SC_MARKERS[@]}"; do
  if compgen -G "$marker" > /dev/null 2>&1 || find . -maxdepth 3 -name "$marker" -print -quit 2>/dev/null | grep -q .; then
    SMART_CONTRACT_MODE=true
    break
  fi
done

if [ "$SMART_CONTRACT_MODE" = true ]; then
  echo ""
  echo "  Smart contracts detected! Activating Aegis security auditor."
  echo "  - Forge model override: claude-opus-4-6 for .sol/.vy files"
  echo "  - Aegis security skill injected into verifier"
  echo "  - Smart contract supplement loaded"

  # Copy smart contract supplement to project AGENTS.md
  if [ -f "$CAE_ROOT/config/smart-contract-supplement.md" ]; then
    if [ -f "AGENTS.md" ]; then
      echo "" >> AGENTS.md
      cat "$CAE_ROOT/config/smart-contract-supplement.md" >> AGENTS.md
      echo "  + Appended smart contract supplement to AGENTS.md"
    else
      cp "$CAE_ROOT/config/smart-contract-supplement.md" AGENTS.md
      echo "  + Created AGENTS.md with smart contract supplement"
    fi
  fi
fi

# ─── Write config.json additions ──────────────────────────────────────
echo ""
echo "Configuring agent skills and model routing..."

CONFIG_FILE=".planning/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo '{}' > "$CONFIG_FILE"
fi

# Build the config patch using node
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));

// Agent skills mapping — inject CAE personas into GSD agent types
config.agent_skills = config.agent_skills || {};
config.agent_skills['gsd-executor'] = (config.agent_skills['gsd-executor'] || []).concat(['.claude/skills/cae-forge']);
config.agent_skills['gsd-planner'] = (config.agent_skills['gsd-planner'] || []).concat(['.claude/skills/cae-arch']);
config.agent_skills['gsd-plan-checker'] = (config.agent_skills['gsd-plan-checker'] || []).concat(['.claude/skills/cae-arch']);
config.agent_skills['gsd-phase-researcher'] = (config.agent_skills['gsd-phase-researcher'] || []).concat(['.claude/skills/cae-scout']);
config.agent_skills['gsd-project-researcher'] = (config.agent_skills['gsd-project-researcher'] || []).concat(['.claude/skills/cae-scout']);
config.agent_skills['gsd-verifier'] = (config.agent_skills['gsd-verifier'] || []).concat(['.claude/skills/cae-sentinel']);
config.agent_skills['gsd-doc-writer'] = (config.agent_skills['gsd-doc-writer'] || []).concat(['.claude/skills/cae-scribe']);

// Add Aegis to verifier if smart contracts detected
const smartContract = ${SMART_CONTRACT_MODE};
if (smartContract) {
  config.agent_skills['gsd-verifier'].push('.claude/skills/cae-aegis');
}

// Model overrides for adversarial review diversity
// Executor uses Sonnet, Verifier uses Opus — different models catch different bugs
config.model_overrides = config.model_overrides || {};
config.model_overrides['gsd-planner'] = 'claude-opus-4-6';
config.model_overrides['gsd-plan-checker'] = 'claude-opus-4-6';
config.model_overrides['gsd-verifier'] = 'claude-opus-4-6';
config.model_overrides['gsd-debugger'] = 'claude-opus-4-6';

if (smartContract) {
  // Smart contract tasks use Opus for builders too
  config.model_overrides['gsd-executor'] = 'claude-opus-4-6';
} else {
  // Standard: Sonnet for builders (fast, adversarial vs Opus reviewer)
  config.model_overrides['gsd-executor'] = 'claude-sonnet-4-6';
}

// Enable full model ID resolution
config.resolve_model_ids = true;

// Ensure parallelization is on
config.parallelization = config.parallelization !== undefined ? config.parallelization : true;

// Deduplicate arrays
for (const [key, val] of Object.entries(config.agent_skills)) {
  config.agent_skills[key] = [...new Set(val)];
}

fs.writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2) + '\n');
console.log('  Config written to $CONFIG_FILE');
"

# ─── Create AGENTS.md if it doesn't exist ─────────────────────────────
if [ ! -f "AGENTS.md" ]; then
  cat > AGENTS.md << 'AGENTS_EOF'
# AGENTS.md — Team Knowledge Base

## Project Conventions
<!-- Scribe will populate this as the team builds -->

## Patterns That Work
<!-- Validated approaches from completed tasks -->

## Gotchas
<!-- Things that bit a builder — so the next one doesn't repeat it -->

## Library/API Notes
<!-- Technology-specific knowledge from Scout research + builder experience -->
AGENTS_EOF
  echo "  + Created AGENTS.md template"
fi

# ─── Summary ──────────────────────────────────────────────────────────
echo ""
echo "Ctrl+Alt+Elite initialized!"
echo ""
echo "Agent routing:"
echo "  Planner (Arch)     → claude-opus-4-6 + cae-arch skill"
echo "  Researcher (Scout) → profile default  + cae-scout skill"
if [ "$SMART_CONTRACT_MODE" = true ]; then
  echo "  Executor (Forge)   → claude-opus-4-6 + cae-forge skill [SMART CONTRACT MODE]"
  echo "  Verifier (Sentinel)→ claude-opus-4-6 + cae-sentinel + cae-aegis skills"
else
  echo "  Executor (Forge)   → claude-sonnet-4-6 + cae-forge skill"
  echo "  Verifier (Sentinel)→ claude-opus-4-6   + cae-sentinel skill"
fi
echo "  Doc Writer (Scribe)→ profile default  + cae-scribe skill"
echo ""
echo "Next: Use /gsd-plan-phase to start planning, or /gsd-autonomous to run all phases."
