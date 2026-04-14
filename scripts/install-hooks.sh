#!/usr/bin/env bash
set -euo pipefail

# Ctrl+Alt+Elite — Hook Installer
# Adds CAE hooks to Claude Code's settings.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAE_ROOT="$(dirname "$SCRIPT_DIR")"
SETTINGS_FILE="${HOME}/.claude/settings.json"

echo "Installing CAE hooks..."

if [ ! -f "$SETTINGS_FILE" ]; then
  echo '{}' > "$SETTINGS_FILE"
fi

node -e "
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf8'));

// Ensure hooks structure exists
settings.hooks = settings.hooks || {};
settings.hooks.PostToolUse = settings.hooks.PostToolUse || [];

// Check if CAE hooks already installed
const hasMulticaHook = settings.hooks.PostToolUse.some(h =>
  h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('cae-multica-hook'))
);
const hasScribeHook = settings.hooks.PostToolUse.some(h =>
  h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('cae-scribe-hook'))
);

if (!hasMulticaHook) {
  settings.hooks.PostToolUse.push({
    matcher: 'Bash|Task',
    hooks: [{
      type: 'command',
      command: 'node \"$CAE_ROOT/hooks/cae-multica-hook.js\"',
      timeout: 5
    }]
  });
  console.log('  + Multica status hook');
}

if (!hasScribeHook) {
  settings.hooks.PostToolUse.push({
    matcher: 'Task',
    hooks: [{
      type: 'command',
      command: 'node \"$CAE_ROOT/hooks/cae-scribe-hook.js\"',
      timeout: 3
    }]
  });
  console.log('  + Scribe learning loop hook');
}

fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2) + '\n');
console.log('  Hooks installed to $SETTINGS_FILE');
"
