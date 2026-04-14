#!/usr/bin/env node

/**
 * Ctrl+Alt+Elite — Scribe Learning Loop Hook
 *
 * GSD PostToolUse hook that detects when a phase execution completes
 * and injects a reminder to run /cae-scribe to update AGENTS.md.
 *
 * Install in settings.json:
 * {
 *   "hooks": {
 *     "PostToolUse": [{
 *       "matcher": "Task",
 *       "hooks": [{
 *         "type": "command",
 *         "command": "node /home/cae/ctrl-alt-elite/hooks/cae-scribe-hook.js",
 *         "timeout": 3
 *       }]
 *     }]
 *   }
 * }
 *
 * Output: prints a user-visible message when Scribe should run.
 */

const fs = require('fs');
const path = require('path');

const DEBOUNCE_FILE = '/tmp/cae-scribe-reminded';

function main() {
  // Only check in GSD projects
  const stateFile = path.join(process.cwd(), '.planning', 'STATE.md');
  if (!fs.existsSync(stateFile)) return;

  // Check if AGENTS.md exists (CAE initialized)
  if (!fs.existsSync(path.join(process.cwd(), 'AGENTS.md'))) return;

  // Read stdin for tool result context
  let input = '';
  try {
    input = fs.readFileSync('/dev/stdin', 'utf8');
  } catch {
    return;
  }

  // Detect phase execution completion signals
  const completionSignals = [
    'SUMMARY.md',
    'All plans in wave',
    'Phase .* execution complete',
    'wave.*complete',
    'execute-phase.*done'
  ];

  const isCompletion = completionSignals.some(signal =>
    new RegExp(signal, 'i').test(input)
  );

  if (!isCompletion) return;

  // Debounce — only remind once per 5 minutes
  try {
    const lastRemind = fs.statSync(DEBOUNCE_FILE).mtimeMs;
    if (Date.now() - lastRemind < 300000) return;
  } catch {
    // File doesn't exist — continue
  }

  // Touch debounce file
  fs.writeFileSync(DEBOUNCE_FILE, new Date().toISOString());

  // Output reminder (this gets injected into the conversation)
  console.log('[CAE Scribe] Phase execution detected. Run /cae-scribe to update AGENTS.md with learnings from this phase.');
}

try {
  main();
} catch {
  // Hook must not break the session
}
