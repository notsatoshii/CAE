#!/bin/bash
set -euo pipefail

###############################################################################
# .planning/hooks/post-phase-complete.sh
#
# Post-phase completion hook: auto-generate and push fresh docs.
# 
# Runs after SUMMARY.md is written (phase closure complete).
# Updates README + ARCHITECTURE via Herald, then git push origin main.
#
# Exit codes:
#   0 = success (Herald + git push both OK)
#   1 = Herald failed (docs not updated, push blocked)
#   2 = Git push failed (Herald succeeded, but push failed)
#
# Usage: ./.planning/hooks/post-phase-complete.sh
###############################################################################

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DASHBOARD_DIR="$PROJECT_ROOT/dashboard"

echo "[post-phase-complete] Starting Herald + git push workflow..."

# =============================================================================
# 1. Run Herald to update README + ARCHITECTURE
# =============================================================================

cd "$DASHBOARD_DIR"

echo "[post-phase-complete] Running Herald..."

# README
echo "[post-phase-complete] Herald README..."
if ! cae herald README; then
    echo "❌ Herald README failed. Check:"
    echo "   1. cae CLI is installed and working"
    echo "   2. Herald agent is available"
    echo "   3. ROADMAP.md + SUMMARY.md are valid"
    exit 1
fi
echo "✅ README updated"

# ARCHITECTURE
echo "[post-phase-complete] Herald ARCHITECTURE..."
if ! cae herald ARCHITECTURE; then
    echo "❌ Herald ARCHITECTURE failed"
    exit 1
fi
echo "✅ ARCHITECTURE updated"

# =============================================================================
# 2. Verify changes before push
# =============================================================================

echo "[post-phase-complete] Verifying changes..."
if ! git diff-index --quiet HEAD -- README.md ARCHITECTURE.md 2>/dev/null; then
    echo "✅ Docs changed (ready to push)"
    git diff --stat HEAD -- README.md ARCHITECTURE.md || true
else
    echo "⚠️  No doc changes detected (Herald may not have updated)"
fi

# =============================================================================
# 3. Stage + commit
# =============================================================================

echo "[post-phase-complete] Staging + committing..."
git add README.md ARCHITECTURE.md CHANGELOG.md 2>/dev/null || git add README.md ARCHITECTURE.md 2>/dev/null

if git diff-index --quiet --cached HEAD 2>/dev/null; then
    echo "⚠️  No changes to commit"
else
    git commit -m "docs(auto): Herald auto-update after phase completion" || {
        echo "⚠️  Commit failed (likely nothing new)"
    }
fi

# =============================================================================
# 4. Git push origin main
# =============================================================================

echo "[post-phase-complete] Pushing to origin/main..."
if ! git push origin main; then
    echo "❌ Git push failed. Check:"
    echo "   1. Network connectivity"
    echo "   2. SSH key auth (if using git@github.com-cae)"
    echo "   3. Retry: git push origin main"
    exit 2
fi
echo "✅ Pushed to origin/main"

# =============================================================================
# Success
# =============================================================================

echo ""
echo "✅ Post-phase hook complete!"
echo "   • README updated"
echo "   • ARCHITECTURE updated"
echo "   • Changes pushed to origin/main"
exit 0
