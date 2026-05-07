#!/usr/bin/env bash
# timmy-stage-phase.sh — Helper for Timmy to stage phases in .planning/phases/
# Called by CAE to create a phase with proper permissions.
#
# Usage: cae stage-phase <phase-num> <phase-name> <PLAN.md-content>

set -eu

PHASE_NUM="$1"
PHASE_NAME="$2"
PLAN_CONTENT="$3"

PHASE_DIR="/home/cae/ctrl-alt-elite/.planning/phases/${PHASE_NUM}-${PHASE_NAME}"

# Create directory
mkdir -p "$PHASE_DIR"

# Write PLAN.md
echo "$PLAN_CONTENT" > "$PHASE_DIR/PLAN.md"

# Make readable by timmy
chmod 775 "$PHASE_DIR"
chmod 644 "$PHASE_DIR/PLAN.md"
chgrp -R timmy "$PHASE_DIR" || true
chmod -R g+rwX "$PHASE_DIR" || true

echo "Phase $PHASE_NUM staged at $PHASE_DIR"
