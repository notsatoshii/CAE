#!/usr/bin/env bash
set -euo pipefail

# Ctrl+Alt+Elite Installer
# Installs agent personas, model profiles, and GSD configuration

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo ""
echo "  ██████╗████████╗██████╗ ██╗          █████╗ ██╗  ████████╗    ███████╗██╗     ██╗████████╗███████╗"
echo " ██╔════╝╚══██╔══╝██╔══██╗██║         ██╔══██╗██║  ╚══██╔══╝    ██╔════╝██║     ██║╚══██╔══╝██╔════╝"
echo " ██║        ██║   ██████╔╝██║         ███████║██║     ██║       █████╗  ██║     ██║   ██║   █████╗  "
echo " ██║        ██║   ██╔══██╗██║         ██╔══██║██║     ██║       ██╔══╝  ██║     ██║   ██║   ██╔══╝  "
echo " ╚██████╗   ██║   ██║  ██║███████╗    ██║  ██║███████╗██║       ███████╗███████╗██║   ██║   ███████╗"
echo "  ╚═════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝    ╚═╝  ╚═╝╚══════╝╚═╝       ╚══════╝╚══════╝╚═╝   ╚═╝   ╚══════╝"
echo ""
echo "  Multi-Agent Coding Team"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

command -v claude >/dev/null 2>&1 || { echo "Error: Claude Code CLI not found. Install from https://docs.anthropic.com/en/docs/claude-code"; exit 1; }
echo "  ✓ Claude Code CLI"

# Check for GSD
if [ -d "$HOME/.claude/skills" ] && ls "$HOME/.claude/skills"/gsd-* >/dev/null 2>&1; then
    echo "  ✓ GSD (Get-Shit-Done) installed"
else
    echo "  ✗ GSD not found. Installing..."
    npx get-shit-done-cc@latest --global --claude
    echo "  ✓ GSD installed"
fi

# Install Caveman plugin
echo ""
echo "Installing plugins..."
if claude plugin list 2>/dev/null | grep -q "caveman"; then
    echo "  ✓ Caveman plugin already installed"
else
    echo "  Installing Caveman (token compression)..."
    claude plugin marketplace add JuliusBrussee/caveman 2>/dev/null || true
    claude plugin install caveman@caveman 2>/dev/null || echo "  ! Caveman install failed — install manually: claude plugin marketplace add JuliusBrussee/caveman && claude plugin install caveman@caveman"
    echo "  ✓ Caveman plugin"
fi

# Install Karpathy plugin
if claude plugin list 2>/dev/null | grep -q "karpathy"; then
    echo "  ✓ Karpathy Guidelines plugin already installed"
else
    echo "  Installing Karpathy Guidelines (quality guardrails)..."
    claude plugin marketplace add forrestchang/andrej-karpathy-skills 2>/dev/null || true
    claude plugin install andrej-karpathy-skills@karpathy-skills 2>/dev/null || echo "  ! Karpathy install failed — install manually"
    echo "  ✓ Karpathy Guidelines plugin"
fi

# Copy agent personas to GSD agents directory
echo ""
echo "Installing agent personas..."
GSD_AGENTS_DIR="$HOME/.claude/agents"
mkdir -p "$GSD_AGENTS_DIR"

for agent_file in "$PROJECT_ROOT/agents"/cae-*.md; do
    if [ -f "$agent_file" ]; then
        cp "$agent_file" "$GSD_AGENTS_DIR/"
        echo "  ✓ $(basename "$agent_file" .md)"
    fi
done

# Copy model profiles
echo ""
echo "Installing model profiles..."
CONFIG_DIR="$HOME/.claude/config"
mkdir -p "$CONFIG_DIR"
cp "$PROJECT_ROOT/config/model-profiles.json" "$CONFIG_DIR/cae-model-profiles.json"
echo "  ✓ Model profiles"

# Copy smart contract supplement
cp "$PROJECT_ROOT/config/smart-contract-supplement.md" "$CONFIG_DIR/cae-smart-contract-supplement.md"
echo "  ✓ Smart contract supplement"

echo ""
echo "Done! Ctrl+Alt+Elite is installed."
echo ""
echo "Quick start:"
echo "  1. cd into your project directory"
echo "  2. Run: claude"
echo "  3. Use /gsd-new-project to start a new build"
echo ""
echo "The agent personas will automatically be used by GSD during execution."
echo "Model profiles can be switched with: /gsd-set-profile quality|balanced|budget"
echo ""
