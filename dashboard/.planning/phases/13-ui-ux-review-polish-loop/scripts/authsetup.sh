#!/usr/bin/env bash
# authsetup.sh — One-time manual GitHub OAuth sign-in to produce storage-state.json.
#
# Usage:
#   1. Ensure a production build is running on port 3003:
#        cd /home/cae/ctrl-alt-elite/dashboard
#        pnpm build && PORT=3003 pnpm start > /tmp/p13-prod-3003.log 2>&1 &
#        sleep 5 && curl -sSf http://localhost:3003/signin > /dev/null && echo "audit server up"
#   2. Run this script in a terminal with X/VNC display:
#        bash authsetup.sh
#   3. Complete GitHub OAuth in the browser window that opens.
#   4. Press Enter in this terminal when signed in.
#   5. storage-state.json will be written (chmod 0600, gitignored).
#
# Fallback (no X/VNC):
#   Sign in at http://165.245.186.254:3003/signin in a real browser.
#   DevTools → Application → Cookies → copy authjs.session-token value.
#   Write a minimal storage-state.json:
#     { "cookies": [{ "name": "authjs.session-token", "value": "<paste>",
#       "domain": "localhost", "path": "/", "httpOnly": true,
#       "secure": false, "sameSite": "Lax" }], "origins": [] }
#   Verify: curl -b 'authjs.session-token=<val>' http://localhost:3003/api/state
#
# DEFERRED (Wave 0 stub): Real sign-in deferred to post-P14 consolidated UAT.
# storage-state.example.json documents the expected shape. See 13-01-SUMMARY.md.

set -euo pipefail
cd "$(dirname "$0")"
export PLAYWRIGHT_BROWSERS_PATH="/usr/local/share/playwright-browsers"

if [[ "${1:-}" == "--help" ]]; then
  grep '^#' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "[authsetup] --dry-run: would launch headed Chromium at http://localhost:3003/signin"
  echo "[authsetup] --dry-run: would wait for user to complete GitHub OAuth + MFA"
  echo "[authsetup] --dry-run: would write storage-state.json (chmod 0600)"
  exit 0
fi

python3 - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=False)
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    page = ctx.new_page()
    page.goto("http://localhost:3003/signin", wait_until="domcontentloaded")
    print("[authsetup] Chromium opened at http://localhost:3003/signin", flush=True)
    print("[authsetup] Complete GitHub sign-in in the browser window.", flush=True)
    print("[authsetup] Press Enter here when you are signed in...", flush=True)
    input()
    # Navigate to a protected route to confirm auth is active
    page.goto("http://localhost:3003/build", wait_until="domcontentloaded")
    current = page.url
    if "/signin" in current:
        print("[authsetup] ERROR: still on signin page — sign-in may not have completed.", flush=True)
        browser.close()
        raise SystemExit(1)
    ctx.storage_state(path="storage-state.json")
    print("[authsetup] Saved storage-state.json")
    browser.close()
PY

chmod 0600 storage-state.json
echo "[authsetup] Permissions: $(stat -c %a storage-state.json)"
echo "[authsetup] Cookie check: $(python3 -c "import json; s=json.load(open('storage-state.json')); c=[x for x in s['cookies'] if x['name']=='authjs.session-token']; print('authjs.session-token FOUND' if c else 'authjs.session-token MISSING')")"
