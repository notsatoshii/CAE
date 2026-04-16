#!/usr/bin/env bash
# Orchestrator helpers for creating/merging/deleting forge branches.
#
# Usage:
#   forge-branch.sh create <task_id> [base-branch]
#       Creates forge/<task_id> from base-branch (default: HEAD).
#       Prints the branch name on stdout.
#
#   forge-branch.sh merge <task_id> [target-branch]
#       Merges forge/<task_id> into target-branch (default: current branch).
#       Uses CAE_MERGE_TOKEN to bypass the pre-push guard if pushing.
#       Does NOT push automatically — orchestrator decides.
#       Deletes the forge branch after successful merge.
#
#   forge-branch.sh abandon <task_id>
#       Keeps the branch (for inspection) but returns to the previous branch.
#       Used on task failure.
#
#   forge-branch.sh cleanup
#       Delete all forge/ branches whose last commit is merged into main.
#       Safety: does NOT delete unmerged forge branches.

set -euo pipefail

CMD="${1:-help}"
TASK_ID="${2:-}"

[[ "$CMD" != "help" && "$CMD" != "cleanup" && -z "$TASK_ID" ]] && { echo "error: task_id required" >&2; exit 1; }

case "$CMD" in
  create)
    BASE="${3:-HEAD}"
    BRANCH="forge/${TASK_ID}"

    # Guard: refuse only on MODIFIED tracked files (not untracked).
    # git checkout handles untracked files fine unless they'd be overwritten.
    if ! git diff --quiet HEAD 2>/dev/null; then
      echo "error: tracked files have uncommitted modifications; commit or stash first" >&2
      exit 1
    fi

    # Check if branch already exists
    if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
      echo "error: branch $BRANCH already exists" >&2
      exit 1
    fi

    git checkout -b "$BRANCH" "$BASE" >/dev/null 2>&1
    echo "$BRANCH"
    ;;

  merge)
    TARGET="${3:-}"
    BRANCH="forge/${TASK_ID}"

    if [ -z "$TARGET" ]; then
      # Figure out the branch we were on before the forge branch was created
      TARGET=$(git reflog | grep "checkout: moving from .* to $BRANCH" | head -1 | sed -E 's/.*moving from (\S+) to .*/\1/')
      [ -z "$TARGET" ] && { echo "error: could not infer target branch; pass explicitly" >&2; exit 1; }
    fi

    git rev-parse --verify "$BRANCH" >/dev/null 2>&1 || { echo "error: $BRANCH not found" >&2; exit 1; }

    git checkout "$TARGET" >/dev/null 2>&1
    # --no-ff to preserve the forge branch history as a distinct unit
    if git merge --no-ff -m "Merge $BRANCH (Sentinel-approved)" "$BRANCH"; then
      git branch -d "$BRANCH" >/dev/null 2>&1
      echo "merged and deleted $BRANCH"
    else
      echo "error: merge failed; resolve conflicts and merge manually; $BRANCH retained" >&2
      exit 1
    fi
    ;;

  abandon)
    BRANCH="forge/${TASK_ID}"
    # Return to previous branch, keep forge branch for inspection
    git checkout - >/dev/null 2>&1 || git checkout main >/dev/null 2>&1 || git checkout master >/dev/null 2>&1
    echo "abandoned: $BRANCH retained for inspection"
    ;;

  cleanup)
    # Delete merged forge branches only (safe — git branch -d refuses unmerged)
    MERGED=$(git branch --list 'forge/*' --merged | sed 's/^[* ]*//')
    if [ -z "$MERGED" ]; then
      echo "no merged forge branches to clean up"
      exit 0
    fi
    echo "$MERGED" | while read -r b; do
      [ -n "$b" ] && git branch -d "$b" >/dev/null 2>&1 && echo "deleted $b"
    done
    ;;

  help|*)
    head -25 "$0" | tail -24
    ;;
esac
