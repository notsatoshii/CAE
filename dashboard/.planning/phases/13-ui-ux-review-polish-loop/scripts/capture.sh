#!/usr/bin/env bash
# capture.sh — Phase 13 Playwright screenshot driver.
#
# Usage:
#   capture.sh before|after [--route slug] [--viewport mobile|laptop|wide] [--mode founder|dev]
#
# Outputs:
#   shots/{phase}/{viewport}-{mode}/{slug}.png
#   shots/{phase}/MANIFEST.tsv
#
# Requires:
#   - storage-state.json (from authsetup.sh) for protected routes
#   - Production server running on :3003 (pnpm build && PORT=3003 pnpm start)
#   - Playwright Python: python3 -c "from playwright.sync_api import sync_playwright"
#
# Notes:
#   - base_url is :3003 (audit port); never touches :3002 (Eric's dev server)
#   - device_scale_factor=1 (Opus 4.7 vision cap: 3.75MP, 1920x1080@1x = 2.07MP fits)
#   - Animations + transitions disabled via injected CSS for deterministic screenshots

set -euo pipefail

PHASE_ARG="${1:-}"
shift || true

if [[ "$PHASE_ARG" == "--help" ]]; then
  grep '^#' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

if [[ "$PHASE_ARG" != "before" && "$PHASE_ARG" != "after" ]]; then
  echo "usage: capture.sh before|after [--route slug] [--viewport mobile|laptop|wide] [--mode founder|dev]" >&2
  echo "       capture.sh --help" >&2
  exit 2
fi

ROUTE_FILTER=""
VIEWPORT_FILTER=""
MODE_FILTER=""
DRY_RUN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --route)     ROUTE_FILTER="$2"; shift 2 ;;
    --viewport)  VIEWPORT_FILTER="$2"; shift 2 ;;
    --mode)      MODE_FILTER="$2"; shift 2 ;;
    --dry-run)   DRY_RUN="1"; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")"
export PLAYWRIGHT_BROWSERS_PATH="/usr/local/share/playwright-browsers"
export PHASE="$PHASE_ARG"
export ROUTE_FILTER
export VIEWPORT_FILTER
export MODE_FILTER
export DRY_RUN

python3 - <<'PY'
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright

SCRIPTS = pathlib.Path(__file__).parent if hasattr(pathlib.Path(__file__), 'parent') else pathlib.Path('.')
# When run via heredoc, __file__ is '<stdin>'; resolve from cwd (already cd'd to scripts/)
SCRIPTS = pathlib.Path.cwd()

ROUTES = json.loads((SCRIPTS / "routes.json").read_text())
PHASE = os.environ["PHASE"]
ROUTE_FILTER = os.environ.get("ROUTE_FILTER", "")
VIEWPORT_FILTER = os.environ.get("VIEWPORT_FILTER", "")
MODE_FILTER = os.environ.get("MODE_FILTER", "")
DRY_RUN = os.environ.get("DRY_RUN", "") == "1"

SHOTS_BASE = SCRIPTS.parent / "shots"
SHOTS = SHOTS_BASE / PHASE
SHOTS.mkdir(parents=True, exist_ok=True)
MANIFEST = SHOTS / "MANIFEST.tsv"

STORAGE_STATE = SCRIPTS / "storage-state.json"
HAS_AUTH = STORAGE_STATE.exists()
if not HAS_AUTH:
    print(f"[capture] WARNING: storage-state.json not found — auth routes will be skipped (run authsetup.sh first)", file=sys.stderr)

DETERMINISTIC_CSS = (
    "* { animation: none !important; transition: none !important; "
    "caret-color: transparent !important; } "
    "*::before, *::after { animation: none !important; transition: none !important; }"
)

fails = 0
shots = 0
skipped = 0

all_routes = ROUTES["routes"] + ROUTES["drawer_states"]
drawer_slugs = {r["slug"] for r in ROUTES["drawer_states"]}

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    with MANIFEST.open("w") as mf:
        mf.write("slug\tviewport\tmode\turl\tpng_path\tbytes\n")
        for mode_name, matrix_viewports in ROUTES["mode_viewport_matrix"].items():
            if MODE_FILTER and mode_name != MODE_FILTER:
                continue
            mode_cfg = ROUTES["modes"][mode_name]
            for vp_name in matrix_viewports:
                if VIEWPORT_FILTER and vp_name != VIEWPORT_FILTER:
                    continue
                w, h = map(int, ROUTES["viewports"][vp_name].split("x"))
                out_dir = SHOTS / f"{vp_name}-{mode_name}"
                out_dir.mkdir(parents=True, exist_ok=True)

                for route in all_routes:
                    if ROUTE_FILTER and route["slug"] != ROUTE_FILTER:
                        continue
                    # Drawer states only shoot laptop+founder (D-05 pruning)
                    if route["slug"] in drawer_slugs and (vp_name != "laptop" or mode_name != "founder"):
                        continue
                    # Skip auth routes if no storage-state.json
                    if route.get("auth") and not HAS_AUTH:
                        print(f"[capture:SKIP] {vp_name}/{mode_name}/{route['slug']} — auth required but no storage-state.json")
                        skipped += 1
                        continue

                    if DRY_RUN:
                        url = ROUTES["base_url"] + route["path"]
                        print(f"[capture:dry-run] would shoot {vp_name}/{mode_name}/{route['slug']} → {out_dir}/{route['slug']}.png")
                        continue

                    ctx_kwargs = {
                        "viewport": {"width": w, "height": h},
                        "device_scale_factor": 1,  # V2 §7: 1x for Opus 4.7 3.75MP cap
                    }
                    if route.get("auth"):
                        ctx_kwargs["storage_state"] = str(STORAGE_STATE)

                    ctx = browser.new_context(**ctx_kwargs)
                    ctx.add_init_script(f"""
                        localStorage.setItem('explainMode', '{mode_cfg["explainMode"]}');
                        localStorage.setItem('devMode', '{mode_cfg["devMode"]}');
                    """)
                    page = ctx.new_page()
                    url = ROUTES["base_url"] + route["path"]
                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        if route.get("wait_selector"):
                            try:
                                page.wait_for_selector(route["wait_selector"], timeout=15000)
                            except Exception as ws_err:
                                print(f"[capture:WARN] wait_selector '{route['wait_selector']}' timed out for {route['slug']}: {ws_err}", file=sys.stderr)
                        page.wait_for_timeout(int(route.get("wait_ms", 800)))
                        page.add_style_tag(content=DETERMINISTIC_CSS)
                        page.wait_for_timeout(200)
                        png_path = out_dir / f"{route['slug']}.png"
                        page.screenshot(path=str(png_path), full_page=False)
                        size = png_path.stat().st_size
                        mf.write(f"{route['slug']}\t{vp_name}\t{mode_name}\t{url}\t{png_path}\t{size}\n")
                        shots += 1
                        print(f"[capture] {vp_name}/{mode_name}/{route['slug']} → {size}B")
                    except Exception as e:
                        print(f"[capture:FAIL] {vp_name}/{mode_name}/{route['slug']}: {e}", file=sys.stderr)
                        fails += 1
                    finally:
                        ctx.close()
    browser.close()

print(f"[capture] phase={PHASE} shots={shots} skipped={skipped} fails={fails}")
sys.exit(1 if fails > 0 else 0)
PY
