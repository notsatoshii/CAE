#!/usr/bin/env bash
# Installs a pre-push hook in the current git repo that blocks pushes to
# main/master unless CAE_MERGE_TOKEN is set.
#
# Usage: install-branch-guard.sh <project_root>
set -euo pipefail

PROJECT_ROOT="${1:-.}"
cd "$PROJECT_ROOT"

if [ ! -d .git ]; then
  echo "error: not a git repo: $PROJECT_ROOT" >&2
  exit 1
fi

HOOK_PATH=".git/hooks/pre-push"
MARKER="# cae-branch-guard v1"

# Idempotent install — check if our guard is already in place
if [ -f "$HOOK_PATH" ] && grep -q "$MARKER" "$HOOK_PATH"; then
  echo "branch guard already installed at $HOOK_PATH"
  exit 0
fi

# If an existing pre-push hook exists without our marker, preserve it
EXISTING=""
if [ -f "$HOOK_PATH" ]; then
  EXISTING=$(cat "$HOOK_PATH")
fi

cat > "$HOOK_PATH" <<'HOOK_EOF'
#!/usr/bin/env bash
# cae-branch-guard v1
# Blocks pushes to protected branches unless CAE_MERGE_TOKEN is set.
# CAE orchestrator sets the token ephemerally after Sentinel approval.

PROTECTED_PATTERN='^refs/heads/(main|master)$'

while read -r local_ref local_sha remote_ref remote_sha; do
  if [[ "$remote_ref" =~ $PROTECTED_PATTERN ]]; then
    if [ -z "${CAE_MERGE_TOKEN:-}" ]; then
      echo "cae-branch-guard: REFUSING push to $remote_ref" >&2
      echo "cae-branch-guard: CAE_MERGE_TOKEN not set — this push must come from the orchestrator after Sentinel approval" >&2
      echo "cae-branch-guard: to bypass for legitimate reasons: CAE_MERGE_TOKEN=human git push ..." >&2
      exit 1
    fi
  fi
done

exit 0
HOOK_EOF

# Append preserved hook content (if any) after our guard
if [ -n "$EXISTING" ]; then
  echo "" >> "$HOOK_PATH"
  echo "# ── Preserved from previous hook ──" >> "$HOOK_PATH"
  echo "$EXISTING" >> "$HOOK_PATH"
fi

chmod +x "$HOOK_PATH"
echo "installed cae-branch-guard at $HOOK_PATH"
