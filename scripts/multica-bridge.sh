#!/usr/bin/env bash
set -euo pipefail

# Ctrl+Alt+Elite — Multica Status Bridge
# Pushes GSD phase/plan status to Multica's issue tracking API.
#
# Usage:
#   multica-bridge.sh setup                     # Authenticate + create workspace
#   multica-bridge.sh create-phase <phase_name> # Create issue for a phase
#   multica-bridge.sh start <issue_id>          # Mark issue in_progress
#   multica-bridge.sh complete <issue_id>       # Mark issue done
#   multica-bridge.sh fail <issue_id> <reason>  # Mark issue blocked
#   multica-bridge.sh comment <issue_id> <text> # Add progress comment

MULTICA_URL="${MULTICA_URL:-http://localhost:8090}"
MULTICA_CONFIG_DIR="${HOME}/.config/cae"
MULTICA_TOKEN_FILE="${MULTICA_CONFIG_DIR}/multica-token"
MULTICA_WORKSPACE_FILE="${MULTICA_CONFIG_DIR}/multica-workspace"

mkdir -p "$MULTICA_CONFIG_DIR"

# ─── Helpers ──────────────────────────────────────────────────────────

get_token() {
  if [ -f "$MULTICA_TOKEN_FILE" ]; then
    cat "$MULTICA_TOKEN_FILE"
  else
    echo ""
  fi
}

get_workspace() {
  if [ -f "$MULTICA_WORKSPACE_FILE" ]; then
    cat "$MULTICA_WORKSPACE_FILE"
  else
    echo ""
  fi
}

api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local token
  token="$(get_token)"
  local workspace
  workspace="$(get_workspace)"

  local headers=(-H "Content-Type: application/json")
  [ -n "$token" ] && headers+=(-H "Authorization: Bearer $token")
  [ -n "$workspace" ] && headers+=(-H "X-Workspace-ID: $workspace")

  if [ -n "$body" ]; then
    curl -s -X "$method" "${MULTICA_URL}${path}" "${headers[@]}" -d "$body"
  else
    curl -s -X "$method" "${MULTICA_URL}${path}" "${headers[@]}"
  fi
}

# ─── Commands ─────────────────────────────────────────────────────────

cmd_setup() {
  local email="${1:-cae@ctrl-alt-elite.local}"

  echo "Setting up Multica connection..."

  # Step 1: Send verification code
  api POST "/auth/send-code" "{\"email\": \"$email\"}" > /dev/null

  # Step 2: Verify with master code (works in non-production)
  local auth_response
  auth_response=$(api POST "/auth/verify-code" "{\"email\": \"$email\", \"code\": \"888888\"}")

  # Extract token from response (Set-Cookie or response body)
  local token
  token=$(echo "$auth_response" | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
    console.log(data.token || '');
  " 2>/dev/null || echo "")

  if [ -z "$token" ]; then
    # Try getting token from cookie-based auth — create a PAT instead
    # First get a session cookie
    local cookie_jar="/tmp/multica-cookies-$$"
    curl -s -c "$cookie_jar" -X POST "${MULTICA_URL}/auth/send-code" \
      -H "Content-Type: application/json" -d "{\"email\": \"$email\"}" > /dev/null
    curl -s -c "$cookie_jar" -b "$cookie_jar" -X POST "${MULTICA_URL}/auth/verify-code" \
      -H "Content-Type: application/json" -d "{\"email\": \"$email\", \"code\": \"888888\"}" > /dev/null

    # Create a PAT using the session cookie
    local pat_response
    pat_response=$(curl -s -b "$cookie_jar" -X POST "${MULTICA_URL}/api/tokens" \
      -H "Content-Type: application/json" -d "{\"name\": \"cae-bridge\"}")
    token=$(echo "$pat_response" | node -e "
      const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
      console.log(data.token || '');
    " 2>/dev/null || echo "")
    rm -f "$cookie_jar"
  fi

  if [ -z "$token" ]; then
    echo "Error: Could not authenticate with Multica."
    echo "Response: $auth_response"
    exit 1
  fi

  echo "$token" > "$MULTICA_TOKEN_FILE"
  chmod 600 "$MULTICA_TOKEN_FILE"
  echo "  ✓ Authenticated"

  # Step 3: Create workspace for CAE
  local project_name
  project_name=$(basename "$(pwd)")
  local slug
  slug=$(echo "$project_name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')

  local ws_response
  ws_response=$(api POST "/api/workspaces" "{
    \"name\": \"$project_name\",
    \"slug\": \"$slug\",
    \"description\": \"Ctrl+Alt+Elite workspace for $project_name\",
    \"issue_prefix\": \"CAE\"
  }")

  local workspace_id
  workspace_id=$(echo "$ws_response" | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
    console.log(data.id || '');
  " 2>/dev/null || echo "")

  if [ -n "$workspace_id" ]; then
    echo "$workspace_id" > "$MULTICA_WORKSPACE_FILE"
    echo "  ✓ Workspace created: $project_name ($workspace_id)"
  else
    echo "  ! Workspace creation failed (may already exist)"
    echo "  Response: $ws_response"
    # Try to get existing workspace
    local ws_list
    ws_list=$(api GET "/api/workspaces")
    workspace_id=$(echo "$ws_list" | node -e "
      const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
      const ws = (Array.isArray(data) ? data : data.workspaces || []).find(w => w.slug === '$slug');
      console.log(ws ? ws.id : '');
    " 2>/dev/null || echo "")
    if [ -n "$workspace_id" ]; then
      echo "$workspace_id" > "$MULTICA_WORKSPACE_FILE"
      echo "  ✓ Using existing workspace: $workspace_id"
    fi
  fi

  echo ""
  echo "Multica bridge configured."
  echo "  URL: $MULTICA_URL"
  echo "  Dashboard: ${MULTICA_URL/8090/3002}"
}

cmd_create_phase() {
  local phase_name="$1"
  local description="${2:-GSD phase: $phase_name}"

  local response
  response=$(api POST "/api/issues" "{
    \"title\": \"Phase: $phase_name\",
    \"description\": \"$description\",
    \"status\": \"todo\",
    \"priority\": \"high\"
  }")

  local issue_id
  issue_id=$(echo "$response" | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
    console.log(data.id || '');
  " 2>/dev/null || echo "")

  if [ -n "$issue_id" ]; then
    echo "$issue_id"
  else
    echo "Error creating issue: $response" >&2
    echo ""
  fi
}

cmd_create_plan() {
  local plan_name="$1"
  local parent_id="${2:-}"
  local assignee="${3:-Forge}"

  local body="{
    \"title\": \"$plan_name\",
    \"status\": \"todo\",
    \"priority\": \"medium\""

  if [ -n "$parent_id" ]; then
    body="$body, \"parent_issue_id\": \"$parent_id\""
  fi

  body="$body}"

  local response
  response=$(api POST "/api/issues" "$body")

  echo "$response" | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
    console.log(data.id || '');
  " 2>/dev/null || echo ""
}

cmd_start() {
  local issue_id="$1"
  api PUT "/api/issues/$issue_id" '{"status": "in_progress"}' > /dev/null
  echo "Started: $issue_id"
}

cmd_complete() {
  local issue_id="$1"
  api PUT "/api/issues/$issue_id" '{"status": "done"}' > /dev/null
  echo "Completed: $issue_id"
}

cmd_fail() {
  local issue_id="$1"
  local reason="${2:-Build failed}"
  api PUT "/api/issues/$issue_id" '{"status": "blocked"}' > /dev/null
  api POST "/api/issues/$issue_id/comments" "{\"content\": \"Failed: $reason\"}" > /dev/null
  echo "Failed: $issue_id — $reason"
}

cmd_comment() {
  local issue_id="$1"
  local text="$2"
  api POST "/api/issues/$issue_id/comments" "{\"content\": \"$text\"}" > /dev/null
}

# ─── Dispatch ─────────────────────────────────────────────────────────
case "${1:-help}" in
  setup)        cmd_setup "${2:-}" ;;
  create-phase) cmd_create_phase "${2:?phase name required}" "${3:-}" ;;
  create-plan)  cmd_create_plan "${2:?plan name required}" "${3:-}" "${4:-}" ;;
  start)        cmd_start "${2:?issue_id required}" ;;
  complete)     cmd_complete "${2:?issue_id required}" ;;
  fail)         cmd_fail "${2:?issue_id required}" "${3:-}" ;;
  comment)      cmd_comment "${2:?issue_id required}" "${3:?text required}" ;;
  *)
    echo "Usage: multica-bridge.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  setup                      Authenticate + create workspace"
    echo "  create-phase <name> [desc] Create phase issue"
    echo "  create-plan <name> [parent_id] Create plan sub-issue"
    echo "  start <issue_id>           Mark in_progress"
    echo "  complete <issue_id>        Mark done"
    echo "  fail <issue_id> [reason]   Mark blocked with reason"
    echo "  comment <issue_id> <text>  Add progress comment"
    ;;
esac
