#!/usr/bin/env python3
"""Phase 13 per-route click walker. Drives every button + role=button + link, records console errors.

Usage:
    cd scripts && python3 clickwalk.py --slug build-home [--mode founder] [--viewport laptop]
Exit 0 = no console.error fired, 1 = errors detected, 2 = fatal (no auth / slug not found).
"""
import argparse, json, pathlib, sys
from playwright.sync_api import sync_playwright

# ---- paths ----
SCRIPTS = pathlib.Path(__file__).parent
ROUTES_PATH = SCRIPTS / "routes.json"
STORAGE = SCRIPTS / "storage-state.json"
AUDIT_WORKING = SCRIPTS.parent / "audit" / "working"

# ---- args ----
ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--slug",     required=True,           help="Route slug from routes.json")
ap.add_argument("--mode",     default="founder",       help="Mode: founder|dev (default: founder)")
ap.add_argument("--viewport", default="laptop",        help="Viewport: mobile|laptop|wide (default: laptop)")
ap.add_argument("--dry-run",  action="store_true",     help="Print what would be walked, skip Playwright")
args = ap.parse_args()

# ---- load routes ----
ROUTES = json.loads(ROUTES_PATH.read_text())
all_routes = ROUTES["routes"] + ROUTES["drawer_states"]
route = next((r for r in all_routes if r["slug"] == args.slug), None)
if route is None:
    print(f"[clickwalk] FATAL: slug '{args.slug}' not found in routes.json", file=sys.stderr)
    print(f"[clickwalk] Available slugs: {[r['slug'] for r in all_routes]}", file=sys.stderr)
    sys.exit(2)

if args.viewport not in ROUTES["viewports"]:
    print(f"[clickwalk] FATAL: viewport '{args.viewport}' not in routes.json viewports", file=sys.stderr)
    sys.exit(2)

if args.mode not in ROUTES["modes"]:
    print(f"[clickwalk] FATAL: mode '{args.mode}' not in routes.json modes", file=sys.stderr)
    sys.exit(2)

# ---- auth check ----
if route.get("auth") and not STORAGE.exists():
    print(f"[clickwalk] FATAL: route '{args.slug}' requires auth but storage-state.json not found.", file=sys.stderr)
    print(f"[clickwalk] Run authsetup.sh first. See 13-01-SUMMARY.md.", file=sys.stderr)
    sys.exit(2)

# ---- dry-run ----
if args.dry_run:
    url = ROUTES["base_url"] + route["path"]
    print(f"[clickwalk] --dry-run: would walk {args.slug} at {url} ({args.viewport}/{args.mode})")
    print(f"[clickwalk] --dry-run: auth={route.get('auth', False)}, wait_ms={route.get('wait_ms', 800)}")
    sys.exit(0)

# ---- setup ----
AUDIT_WORKING.mkdir(parents=True, exist_ok=True)
w, h = map(int, ROUTES["viewports"][args.viewport].split("x"))
mode_cfg = ROUTES["modes"][args.mode]
url = ROUTES["base_url"] + route["path"]

rows: list[str] = [
    "| # | Tag | Aria / Text | Clicked | Console Errors | Verdict |",
    "|---|---|---|---|---|---|",
]
err_count = 0
element_count = 0

import os
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/usr/local/share/playwright-browsers")

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    ctx_kwargs: dict = {
        "viewport": {"width": w, "height": h},
        "device_scale_factor": 1,
    }
    if route.get("auth"):
        ctx_kwargs["storage_state"] = str(STORAGE)

    ctx = browser.new_context(**ctx_kwargs)
    ctx.add_init_script(f"""
        localStorage.setItem('explainMode', '{mode_cfg["explainMode"]}');
        localStorage.setItem('devMode', '{mode_cfg["devMode"]}');
    """)
    page = ctx.new_page()
    console_errors: list[str] = []

    def on_console(msg):
        if msg.type == "error":
            console_errors.append(msg.text)

    def on_pageerror(exc):
        console_errors.append(f"pageerror: {exc}")

    page.on("console", on_console)
    page.on("pageerror", on_pageerror)

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
    except Exception as e:
        print(f"[clickwalk] FATAL: could not load {url}: {e}", file=sys.stderr)
        ctx.close(); browser.close()
        sys.exit(2)

    if route.get("wait_selector"):
        try:
            page.wait_for_selector(route["wait_selector"], timeout=10000)
        except Exception:
            pass  # best-effort; proceed even if wait_selector times out

    page.wait_for_timeout(int(route.get("wait_ms", 800)))

    # Collect all interactive elements
    elements = page.query_selector_all("button, [role='button'], a[href]")
    element_count = len(elements)
    print(f"[clickwalk] {args.slug}: {element_count} interactive elements found")

    for i, el in enumerate(elements):
        try:
            tag = el.evaluate("e => e.tagName.toLowerCase()")
        except Exception:
            tag = "?"

        try:
            aria = (
                el.get_attribute("aria-label")
                or el.get_attribute("title")
                or (el.text_content() or "").strip()
                or "?"
            )[:60]
        except Exception:
            aria = "?"

        before_errs = len(console_errors)
        clicked = "no"

        try:
            # Only click if visible + enabled; skip hidden/disabled elements
            if el.is_visible() and el.is_enabled():
                el.click(timeout=2000, force=False)
                clicked = "yes"
                page.wait_for_timeout(500)
            else:
                clicked = "skip:hidden/disabled"
        except Exception as e:
            clicked = f"FAIL:{str(e)[:40]}"

        new_errs = console_errors[before_errs:]
        if new_errs:
            err_count += len(new_errs)

        if not new_errs and clicked == "yes":
            verdict = "✅"
        elif not new_errs:
            verdict = "⚠️"  # skipped or click failed but no console error
        else:
            verdict = "❌"

        err_summary = "; ".join(new_errs[:3]) if new_errs else "—"
        rows.append(f"| {i+1} | `{tag}` | {aria} | {clicked} | {err_summary} | {verdict} |")

        # Reset: press Escape + re-navigate to close any drawers/modals opened by click
        try:
            page.keyboard.press("Escape")
        except Exception:
            pass
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(400)
        except Exception:
            break  # if we can't re-navigate, stop walking

    ctx.close()
    browser.close()

# ---- emit report ----
import datetime as dt
out_path = AUDIT_WORKING / f"CLICKWALK-{args.slug}.md"
out_path.write_text(
    f"# Clickwalk: {args.slug}\n\n"
    f"**Route:** {url}  \n"
    f"**Viewport:** {args.viewport}  \n"
    f"**Mode:** {args.mode}  \n"
    f"**Run:** {dt.datetime.now().isoformat(timespec='seconds')}  \n"
    f"**Elements found:** {element_count}  \n"
    f"**Console errors fired:** {err_count}  \n\n"
    + "\n".join(rows)
    + "\n\n---\n"
    "_Clickwalk produced by Phase 13 clickwalk.py (Wave 0 scaffold)._\n"
)

print(f"[clickwalk] {args.slug}: {element_count} elements, {err_count} console errors → {out_path}")
sys.exit(0 if err_count == 0 else 1)
