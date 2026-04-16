#!/usr/bin/env bash
set -euo pipefail

# Ctrl+Alt+Elite — Project Initialization (R2)
# Reads config/agent-models.yaml and generates .planning/config.json for GSD.
# Also copies CAE skill files into project's .claude/skills/ for GSD agent_skills injection.

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

AGENT_MODELS_FILE="$CAE_ROOT/config/agent-models.yaml"
if [ ! -f "$AGENT_MODELS_FILE" ]; then
  echo "Error: $AGENT_MODELS_FILE not found. CAE install incomplete."
  exit 1
fi

# Require js-yaml (bundled with Node via dependency, fallback to python yaml if missing)
YAML_PARSER=""
if command -v python3 >/dev/null 2>&1 && python3 -c "import yaml" 2>/dev/null; then
  YAML_PARSER="python3"
elif command -v node >/dev/null 2>&1; then
  YAML_PARSER="node"
  # Install js-yaml in /tmp if needed
  if ! node -e "require('js-yaml')" 2>/dev/null; then
    echo "Installing js-yaml..."
    npm install -g js-yaml 2>/dev/null || npm install --prefix /tmp/cae-deps js-yaml 2>&1 | tail -2
  fi
else
  echo "Error: need python3 with PyYAML or node with js-yaml to parse agent-models.yaml"
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
  echo "  Smart contracts detected — activating Aegis security auditor."
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

# ─── Generate .planning/config.json from agent-models.yaml ─────────────
echo ""
echo "Configuring agent skills and model routing from agent-models.yaml..."

CONFIG_FILE=".planning/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
  echo '{}' > "$CONFIG_FILE"
fi

# Resolve model ID from alias (short → full). Matches MODEL_ALIAS_MAP in GSD core.cjs.
resolve_model_id() {
  case "$1" in
    opus) echo "claude-opus-4-6" ;;
    sonnet) echo "claude-sonnet-4-6" ;;
    haiku) echo "claude-haiku-4-5" ;;
    *) echo "$1" ;;  # Already a full ID (e.g., claude-opus-4-6, gemini-2.5-pro)
  esac
}

# Export for use in the Python/Node subshell
export CAE_SMART_CONTRACT="$SMART_CONTRACT_MODE"
export CAE_AGENT_MODELS_FILE="$AGENT_MODELS_FILE"
export CAE_CONFIG_FILE="$CONFIG_FILE"

if [ "$YAML_PARSER" = "python3" ]; then
  python3 <<'PYEOF'
import json, os, yaml

am_file = os.environ["CAE_AGENT_MODELS_FILE"]
cfg_file = os.environ["CAE_CONFIG_FILE"]
sc_mode = os.environ["CAE_SMART_CONTRACT"] == "true"

with open(am_file) as f:
    agent_models = yaml.safe_load(f)

with open(cfg_file) as f:
    cfg = json.load(f)

cfg["cae_config_version"] = 1
cfg["agent_skills"] = cfg.get("agent_skills", {})
cfg["model_overrides"] = cfg.get("model_overrides", {})
cfg["resolve_model_ids"] = True

def resolve_id(alias):
    aliases = {"opus": "claude-opus-4-6", "sonnet": "claude-sonnet-4-6", "haiku": "claude-haiku-4-5"}
    return aliases.get(alias, alias)

def lookup_model_from(path):
    """Resolve a dotted path like 'scout.modes.phase.model' in agent_models."""
    node = agent_models
    for part in path.split("."):
        if isinstance(node, dict) and part in node:
            node = node[part]
        else:
            return None
    if isinstance(node, dict) and "model" in node:
        return resolve_id(node["model"])
    return None

for gsd_agent, bridge in agent_models.get("gsd_bridge", {}).items():
    skill = bridge.get("skill")
    if skill:
        existing = cfg["agent_skills"].get(gsd_agent, [])
        if skill not in existing:
            existing.append(skill)
        cfg["agent_skills"][gsd_agent] = existing

    model_from = bridge.get("model_from")
    if model_from:
        # Build a full path: e.g., "forge" → "forge.model"; "scout.modes.phase" stays
        candidate = lookup_model_from(f"{model_from}.model") or lookup_model_from(model_from)
        if candidate:
            cfg["model_overrides"][gsd_agent] = candidate

# Smart-contract override: forge → Opus when smart contracts detected
if sc_mode:
    forge_sc = agent_models.get("forge", {}).get("smart_contract_override")
    if forge_sc:
        cfg["model_overrides"]["gsd-executor"] = resolve_id(forge_sc)
    # Inject Aegis skill into verifier
    if ".claude/skills/cae-aegis" not in cfg["agent_skills"].get("gsd-verifier", []):
        cfg["agent_skills"].setdefault("gsd-verifier", []).append(".claude/skills/cae-aegis")

# Deduplicate skill arrays
for k, v in cfg["agent_skills"].items():
    cfg["agent_skills"][k] = list(dict.fromkeys(v))

with open(cfg_file, "w") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")

print(f"  Config written to {cfg_file}")
PYEOF
else
  # Node fallback
  node <<'NODEEOF'
const fs = require('fs');
const yaml = require('js-yaml');

const amFile = process.env.CAE_AGENT_MODELS_FILE;
const cfgFile = process.env.CAE_CONFIG_FILE;
const scMode = process.env.CAE_SMART_CONTRACT === "true";

const am = yaml.load(fs.readFileSync(amFile, 'utf8'));
const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));

cfg.cae_config_version = 1;
cfg.agent_skills = cfg.agent_skills || {};
cfg.model_overrides = cfg.model_overrides || {};
cfg.resolve_model_ids = true;

const aliases = {opus: "claude-opus-4-6", sonnet: "claude-sonnet-4-6", haiku: "claude-haiku-4-5"};
const resolve = a => aliases[a] || a;

const lookup = path => {
  let node = am;
  for (const p of path.split('.')) {
    if (node && typeof node === 'object' && p in node) node = node[p];
    else return null;
  }
  return (node && node.model) ? resolve(node.model) : null;
};

for (const [gsdAgent, bridge] of Object.entries(am.gsd_bridge || {})) {
  if (bridge.skill) {
    const arr = cfg.agent_skills[gsdAgent] || [];
    if (!arr.includes(bridge.skill)) arr.push(bridge.skill);
    cfg.agent_skills[gsdAgent] = arr;
  }
  if (bridge.model_from) {
    const m = lookup(`${bridge.model_from}.model`) || lookup(bridge.model_from);
    if (m) cfg.model_overrides[gsdAgent] = m;
  }
}

if (scMode) {
  const fsc = am.forge && am.forge.smart_contract_override;
  if (fsc) cfg.model_overrides['gsd-executor'] = resolve(fsc);
  const v = cfg.agent_skills['gsd-verifier'] || [];
  if (!v.includes('.claude/skills/cae-aegis')) v.push('.claude/skills/cae-aegis');
  cfg.agent_skills['gsd-verifier'] = v;
}

for (const k of Object.keys(cfg.agent_skills)) {
  cfg.agent_skills[k] = [...new Set(cfg.agent_skills[k])];
}

fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + '\n');
console.log(`  Config written to ${cfgFile}`);
NODEEOF
fi

# ─── Create AGENTS.md if it doesn't exist ─────────────────────────────
if [ ! -f "AGENTS.md" ]; then
  cat > AGENTS.md << 'AGENTS_EOF'
# AGENTS.md — Team Knowledge Base

## Project Conventions

## Patterns That Work

## Gotchas

## Library/API Notes
AGENTS_EOF
  echo "  + Created AGENTS.md template"
fi

# ─── Summary ──────────────────────────────────────────────────────────
echo ""
echo "Ctrl+Alt+Elite initialized (config-driven from agent-models.yaml)."
if [ "$SMART_CONTRACT_MODE" = true ]; then
  echo "  [SMART CONTRACT MODE] Forge overridden to Opus, Aegis auto-activated."
fi
echo ""
echo "Next:"
echo "  /gsd-plan-phase  or  /gsd-autonomous  to proceed with Claude-side GSD workflow."
echo "  bin/cae (once built) to use CAE orchestrator with cross-provider agents."
