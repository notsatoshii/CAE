#!/usr/bin/env bash
# skill-install.sh — thin wrapper around `npx skills add` for the Skills Hub API route.
#
# Usage: skill-install.sh <owner/repo>
#   e.g. skill-install.sh vercel-labs/agent-skills
#
# stdout is streamed line-by-line so the SSE route (/api/skills/install) can tail it.
# SKILLS_TELEMETRY_DISABLED=1 prevents analytics calls from blocking the install.

set -euo pipefail

REPO="${1:?repo required — e.g. vercel-labs/agent-skills}"

export SKILLS_TELEMETRY_DISABLED=1

# exec replaces the shell process — stdout/stderr go straight to the caller
exec npx -y skills add "$REPO"
