#!/usr/bin/env node

/**
 * Ctrl+Alt+Elite — Multica Status Hook
 *
 * GSD PostToolUse hook that detects phase state changes and pushes them to Multica.
 * Fires after Bash/Task tool calls to detect GSD workflow state transitions.
 *
 * Install in settings.json:
 * {
 *   "hooks": {
 *     "PostToolUse": [{
 *       "matcher": "Bash|Task",
 *       "hooks": [{
 *         "type": "command",
 *         "command": "node /home/cae/ctrl-alt-elite/hooks/cae-multica-hook.js",
 *         "timeout": 5
 *       }]
 *     }]
 *   }
 * }
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BRIDGE = '/home/cae/ctrl-alt-elite/scripts/multica-bridge.sh';
const STATE_CACHE = '/tmp/cae-multica-state.json';

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(STATE_CACHE, 'utf8'));
  } catch {
    return { phases: {}, lastCheck: 0 };
  }
}

function saveCache(cache) {
  fs.writeFileSync(STATE_CACHE, JSON.stringify(cache, null, 2));
}

function bridgeCmd(args) {
  try {
    return execSync(`bash "${BRIDGE}" ${args}`, { encoding: 'utf8', timeout: 3000 }).trim();
  } catch {
    return '';
  }
}

function main() {
  // Debounce — only check every 30 seconds
  const cache = loadCache();
  const now = Date.now();
  if (now - cache.lastCheck < 30000) return;
  cache.lastCheck = now;

  // Check if .planning/STATE.md exists (we're in a GSD project)
  const stateFile = path.join(process.cwd(), '.planning', 'STATE.md');
  if (!fs.existsSync(stateFile)) {
    saveCache(cache);
    return;
  }

  // Check if Multica is configured
  const wsFile = path.join(process.env.HOME, '.config', 'cae', 'multica-workspace');
  if (!fs.existsSync(wsFile)) {
    saveCache(cache);
    return;
  }

  // Parse STATE.md for current phase status
  const stateContent = fs.readFileSync(stateFile, 'utf8');

  // Extract current phase from STATE.md frontmatter
  const currentPhaseMatch = stateContent.match(/current_phase:\s*(\d+)/);
  const statusMatch = stateContent.match(/phase_status:\s*(\w+)/);

  if (!currentPhaseMatch) {
    saveCache(cache);
    return;
  }

  const currentPhase = currentPhaseMatch[1];
  const phaseStatus = statusMatch ? statusMatch[1] : 'unknown';
  const cacheKey = `phase-${currentPhase}`;

  // Check if status changed
  if (cache.phases[cacheKey] === phaseStatus) {
    saveCache(cache);
    return;
  }

  // Status changed — push to Multica
  const prevStatus = cache.phases[cacheKey] || 'none';
  cache.phases[cacheKey] = phaseStatus;

  // Create phase issue if we haven't seen it before
  if (prevStatus === 'none') {
    const issueId = bridgeCmd(`create-phase "Phase ${currentPhase}" "GSD Phase ${currentPhase} — ${phaseStatus}"`);
    if (issueId) {
      cache.phases[`${cacheKey}-id`] = issueId;
    }
  }

  const issueId = cache.phases[`${cacheKey}-id`];
  if (!issueId) {
    saveCache(cache);
    return;
  }

  // Map GSD phase status to Multica issue status
  switch (phaseStatus) {
    case 'planning':
    case 'executing':
      bridgeCmd(`start "${issueId}"`);
      break;
    case 'verifying':
      bridgeCmd(`comment "${issueId}" "Phase verification in progress"`);
      break;
    case 'completed':
    case 'done':
      bridgeCmd(`complete "${issueId}"`);
      break;
    case 'failed':
    case 'blocked':
      bridgeCmd(`fail "${issueId}" "Phase ${currentPhase} ${phaseStatus}"`);
      break;
  }

  saveCache(cache);
}

try {
  main();
} catch {
  // Hook must not break the session — swallow all errors
}
